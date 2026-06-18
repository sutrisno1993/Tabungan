import { google } from 'googleapis'
import { pool, supabase } from '../db/pool.js'

/**
 * Authenticates with Google Sheets API via Service Account.
 */
function getAuth() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return auth
}

const MONTH_NAMES = [
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'
]

const MONTH_NAMES_MAP = {
  1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April', 5: 'Mei', 6: 'Juni',
  7: 'Juli', 8: 'Agustus', 9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember'
}

function getYearForMonth(monthName, startYear, endYear) {
  const firstHalf = ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return firstHalf.includes(monthName) ? startYear : endYear
}

function getDaysInMonth(monthName, year) {
  const monthNumMap = {
    'Januari': 1, 'Februari': 2, 'Maret': 3, 'April': 4, 'Mei': 5, 'Juni': 6,
    'Juli': 7, 'Agustus': 8, 'September': 9, 'Oktober': 10, 'November': 11, 'Desember': 12
  }
  const mNum = monthNumMap[monthName]
  return new Date(year, mNum, 0).getDate()
}

function getColLetter(day) {
  // day=1 -> Column D, day=23 -> Column Z, day=24 -> Column AA, day=31 -> Column AH
  return day <= 23 ? String.fromCharCode(67 + day) : 'A' + String.fromCharCode(41 + day)
}

/**
 * Rebuilds the Google Sheets report into monthly grid views for the academic year.
 * Grouped by class, listed with all students, showing daily SETOR transactions.
 */
export async function backupTodayToSheets(triggeredBy = 'SYSTEM') {
  const todayStr = new Date().toISOString().slice(0, 10)
  let status = 'SUCCESS'
  let recordsSynced = 0
  let errorMessage = null

  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    
    // Fetch spreadsheet ID dynamically from settings table with process.env fallback
    let spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
    try {
      const settingResult = await pool.query(
        `SELECT value FROM system_settings WHERE key = 'google_sheets_spreadsheet_id'`
      )
      if (settingResult.rows[0]?.value) {
        spreadsheetId = settingResult.rows[0].value
      }
    } catch (dbErr) {
      console.warn('[Backup] Failed to fetch spreadsheet ID from database settings, falling back to .env:', dbErr.message)
    }

    if (!spreadsheetId) {
      console.warn('[Backup] GOOGLE_SHEETS_SPREADSHEET_ID is not set — skipping backup')
      return { success: false, message: 'GOOGLE_SHEETS_SPREADSHEET_ID is not set' }
    }

    // 1. Calculate academic year boundaries
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    let startYear, endYear
    if (currentMonth >= 7) {
      startYear = currentYear
      endYear = currentYear + 1
    } else {
      startYear = currentYear - 1
      endYear = currentYear
    }

    const startDate = `${startYear}-07-01`
    const endDate = `${endYear}-06-30`

    // 2. Fetch all students
    const studResult = await pool.query(
      `SELECT nis, name, class_name FROM students ORDER BY class_name ASC, name ASC`
    )
    const students = studResult.rows

    // 3. Fetch all SETOR transactions in the academic year
    const txResult = await pool.query(
      `SELECT nis, date, amount
       FROM transactions
       WHERE type = 'SETOR'
         AND deleted_at IS NULL
         AND date >= $1 AND date <= $2`,
      [startDate, endDate]
    )
    recordsSynced = txResult.rowCount

    // 4. Index transactions by [nis][monthName][day]
    const txMap = {}
    for (const row of txResult.rows) {
      const nis = row.nis
      let dateStr = ''
      if (row.date instanceof Date) {
        dateStr = row.date.toISOString().slice(0, 10)
      } else if (typeof row.date === 'string') {
        dateStr = row.date.slice(0, 10)
      } else {
        dateStr = String(row.date)
      }
      const parts = dateStr.split('-')
      if (parts.length < 3) continue
      const m = parseInt(parts[1], 10)
      const d = parseInt(parts[2], 10)
      const monthName = MONTH_NAMES_MAP[m]

      if (!txMap[nis]) txMap[nis] = {}
      if (!txMap[nis][monthName]) txMap[nis][monthName] = {}
      txMap[nis][monthName][d] = (txMap[nis][monthName][d] || 0) + parseFloat(row.amount)
    }

    // 5. Group students by class name
    const studentsByClass = {}
    for (const s of students) {
      if (!studentsByClass[s.class_name]) {
        studentsByClass[s.class_name] = []
      }
      studentsByClass[s.class_name].push(s)
    }
    const classNames = Object.keys(studentsByClass).sort()

    // 6. Get existing tabs in Google Sheets
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId })
    const existingSheets = spreadsheet.data.sheets || []
    const existingTitles = existingSheets.map((s) => s.properties.title)

    // 7. Ensure all 12 tabs exist, are sorted Juli-Juni, and remove unused tabs
    const requests = []

    // Ensure all 12 month sheets exist in order
    for (let i = 0; i < MONTH_NAMES.length; i++) {
      const title = MONTH_NAMES[i]
      if (existingTitles.includes(title)) {
        const sheetId = existingSheets.find((s) => s.properties.title === title).properties.sheetId
        requests.push({
          updateSheetProperties: {
            properties: {
              sheetId,
              index: i,
              gridProperties: {
                frozenRowCount: 1,
                frozenColumnCount: 3,
              },
            },
            fields: 'index,gridProperties.frozenRowCount,gridProperties.frozenColumnCount',
          },
        })
      } else {
        requests.push({
          addSheet: {
            properties: {
              title,
              index: i,
              gridProperties: {
                frozenRowCount: 1,
                frozenColumnCount: 3,
              },
            },
          },
        })
      }
    }

    // Delete non-month sheets
    for (const sheet of existingSheets) {
      const title = sheet.properties.title
      if (!MONTH_NAMES.includes(title)) {
        requests.push({
          deleteSheet: {
            sheetId: sheet.properties.sheetId,
          },
        })
      }
    }

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      })
    }

    // 8. Generate values for each monthly sheet
    const dataToUpdate = []
    const rangesToClear = []

    for (const monthName of MONTH_NAMES) {
      const rows = []
      
      // Column A is NIS, B is Nama, C is Kelas, D to AH are 1-31, AI is jumlah
      const header = ['NIS', 'Nama', 'Kelas']
      for (let d = 1; d <= 31; d++) {
        header.push(String(d))
      }
      header.push('jumlah')
      rows.push(header)

      let rowNum = 2

      for (const className of classNames) {
        const classStudents = studentsByClass[className]
        const classStartRow = rowNum

        for (const student of classStudents) {
          const studentRow = [
            student.nis, // Column A
            student.name, // Column B
            student.class_name, // Column C
          ]

          const mYear = getYearForMonth(monthName, startYear, endYear)
          const daysInM = getDaysInMonth(monthName, mYear)

          for (let d = 1; d <= 31; d++) {
            if (d > daysInM) {
              studentRow.push('')
            } else {
              const amount = txMap[student.nis]?.[monthName]?.[d] || 0
              studentRow.push(amount > 0 ? amount : '')
            }
          }

          // Column AI: jumlah formula
          studentRow.push(`=SUM(D${rowNum}:AH${rowNum})`)
          rows.push(studentRow)
          rowNum++
        }

        const classEndRow = rowNum - 1
        if (classEndRow >= classStartRow) {
          // Total row for this class
          const totalRow = [
            'total',
            '',
            '',
          ]
          for (let d = 1; d <= 31; d++) {
            const colLetter = getColLetter(d)
            totalRow.push(`=SUM(${colLetter}${classStartRow}:${colLetter}${classEndRow})`)
          }
          totalRow.push(`=SUM(AI${classStartRow}:AI${classEndRow})`)
          rows.push(totalRow)
          rowNum++

          // Empty separator row
          rows.push([''])
          rowNum++
        }
      }

      dataToUpdate.push({
        range: `'${monthName}'!A1`,
        values: rows,
      })
      rangesToClear.push(`'${monthName}'!A1:AJ1000`)
    }

    // 9. Clear first to remove any old data remains
    await sheets.spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: { ranges: rangesToClear },
    })

    // 10. Write the new dataset
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: dataToUpdate,
      },
    })

    console.log(`[Backup] Successfully rebuilt ${MONTH_NAMES.length} monthly grid sheets.`)

    // 11. Write success log
    await supabase.from('google_sheets_sync_logs').insert({
      sync_date: todayStr,
      status: 'SUCCESS',
      records_synced: recordsSynced,
      triggered_by: triggeredBy,
    })

    return { success: true, count: recordsSynced }
  } catch (err) {
    status = 'FAILED'
    errorMessage = err.message
    console.error(`[Backup] Failed to backup:`, err)

    try {
      await supabase.from('google_sheets_sync_logs').insert({
        sync_date: todayStr,
        status: 'FAILED',
        records_synced: 0,
        triggered_by: triggeredBy,
        error_message: errorMessage,
      })
    } catch (dbErr) {
      console.error('[Backup] Failed to insert failure log into database:', dbErr)
    }

    throw err
  }
}

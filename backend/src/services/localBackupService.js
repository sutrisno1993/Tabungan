import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'
import { pool } from '../db/pool.js'

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

let isRunning = false
let pendingRun = false

/**
 * Triggers the local backup. Implements a lock/queue to avoid concurrent write issues on Windows.
 */
export async function triggerLocalBackup() {
  if (isRunning) {
    pendingRun = true
    return
  }
  isRunning = true
  try {
    await exportToLocalExcel()
  } catch (err) {
    console.error('[Local Backup] Error running backup:', err)
  } finally {
    isRunning = false
    if (pendingRun) {
      pendingRun = false
      // Wait a bit before running the pending backup
      setTimeout(triggerLocalBackup, 1500)
    }
  }
}

/**
 * Generates the local Excel backup mirroring the Google Sheets format.
 */
export async function exportToLocalExcel() {
  console.log('[Local Backup] Generating real-time Excel backup...')
  
  // 1. Determine local file path
  const defaultPath = 'D:\\Backup Data Tabungan\\backup_sitab.xlsx'
  const backupPath = process.env.LOCAL_EXCEL_BACKUP_PATH || defaultPath
  
  // Ensure target folder exists
  const targetDir = path.dirname(backupPath)
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  // 2. Academic year boundaries
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

  // 3. Fetch students
  const studResult = await pool.query(
    `SELECT nis, name, class_name FROM students ORDER BY class_name ASC, name ASC`
  )
  const students = studResult.rows

  // 4. Fetch SETOR transactions
  const txResult = await pool.query(
    `SELECT nis, date, amount
     FROM transactions
     WHERE type = 'SETOR'
       AND deleted_at IS NULL
       AND date >= $1 AND date <= $2`,
    [startDate, endDate]
  )

  // 5. Index transactions by [nis][monthName][day]
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

  // 6. Group students by class
  const studentsByClass = {}
  for (const s of students) {
    if (!s.class_name) continue // Skip unassigned students for monthly grid
    if (!studentsByClass[s.class_name]) {
      studentsByClass[s.class_name] = []
    }
    studentsByClass[s.class_name].push(s)
  }
  const classNames = Object.keys(studentsByClass).sort()

  // 7. Create Excel Workbook
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SITAB Local Sync Service'
  workbook.created = now

  // 7b. Generate "Laporan Harian Kelas" sheet
  const summarySheet = workbook.addWorksheet('Laporan Harian Kelas')
  summarySheet.views = [{ state: 'frozen', ySplit: 1 }]
  
  summarySheet.columns = [
    { header: 'Tanggal', key: 'tanggal', width: 15 },
    { header: 'Kelas', key: 'kelas', width: 11 },
    { header: 'Saldo Awal', key: 'saldoAwal', width: 18 },
    { header: 'Debit (Pemasukan)', key: 'debit', width: 18 },
    { header: 'Kredit (Pengeluaran)', key: 'kredit', width: 18 },
    { header: 'Saldo Akhir', key: 'saldoAkhir', width: 18 }
  ]

  const sumHeaderRow = summarySheet.getRow(1)
  sumHeaderRow.height = 25
  sumHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sumHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' } // Dark blue
  }
  sumHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' }

  // Fetch daily transactions aggregated chronologically to build the correct running balance
  const dailyReportResult = await pool.query(
    `SELECT 
       t.date,
       s.class_name,
       SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE 0 END)::numeric as debit,
       SUM(CASE WHEN t.type = 'POTONG' THEN t.amount ELSE 0 END)::numeric as kredit
     FROM transactions t
     JOIN students s ON t.nis = s.nis
     WHERE t.deleted_at IS NULL
     GROUP BY t.date, s.class_name
     ORDER BY t.date ASC, s.class_name ASC`
  )

  const runningBalances = {}
  const records = []

  for (const row of dailyReportResult.rows) {
    if (!row.class_name) continue

    let dateStr = ''
    if (row.date instanceof Date) {
      dateStr = row.date.toISOString().slice(0, 10)
    } else {
      dateStr = String(row.date).slice(0, 10)
    }

    const cls = row.class_name
    const debitVal = parseFloat(row.debit || 0)
    const kreditVal = parseFloat(row.kredit || 0)

    if (!runningBalances[cls]) {
      runningBalances[cls] = 0
    }

    const saldoAwal = runningBalances[cls]
    const netChange = debitVal - kreditVal
    runningBalances[cls] += netChange
    const saldoAkhir = runningBalances[cls]

    // Keep history filtered by academic year boundaries
    if (dateStr >= startDate && dateStr <= endDate) {
      records.push({
        dateStr,
        class_name: cls,
        saldoAwal,
        debitVal,
        kreditVal,
        saldoAkhir
      })
    }
  }

  // Sort descending by date, then ascending by class name for report presentation
  records.sort((a, b) => {
    if (a.dateStr !== b.dateStr) {
      return b.dateStr.localeCompare(a.dateStr)
    }
    return a.class_name.localeCompare(b.class_name)
  })

  let summaryRowNum = 2
  for (const rec of records) {
    const addedRow = summarySheet.addRow([
      rec.dateStr,
      rec.class_name,
      rec.saldoAwal,
      rec.debitVal > 0 ? rec.debitVal : '',
      rec.kreditVal > 0 ? rec.kreditVal : '',
      { formula: `=C${summaryRowNum}+D${summaryRowNum}-E${summaryRowNum}` }
    ])

    addedRow.getCell(3).numFmt = '"Rp"#,##0' // Saldo Awal
    addedRow.getCell(4).numFmt = '"Rp"#,##0' // Debit
    addedRow.getCell(5).numFmt = '"Rp"#,##0' // Kredit
    addedRow.getCell(6).numFmt = '"Rp"#,##0' // Saldo Akhir

    summaryRowNum++
  }

  // 8. Generate monthly worksheets
  for (const monthName of MONTH_NAMES) {
    const sheet = workbook.addWorksheet(monthName)
    
    // Freeze first row and first three columns
    sheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }]

    // Column headers
    const headers = ['NIS', 'Nama', 'Kelas']
    for (let d = 1; d <= 31; d++) {
      headers.push(String(d))
    }
    headers.push('jumlah')
    
    const headerRow = sheet.addRow(headers)
    headerRow.height = 25
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' } // Dark blue
    }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }

    let rowNum = 2

    for (const className of classNames) {
      const classStudents = studentsByClass[className]
      const classStartRow = rowNum

      for (const student of classStudents) {
        const studentRow = [
          student.nis,
          student.name,
          student.class_name
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

        // AI Formula: =SUM(D{row}:AH{row})
        studentRow.push({ formula: `=SUM(D${rowNum}:AH${rowNum})` })
        
        const row = sheet.addRow(studentRow)
        
        // Currency formatting for amounts & formula cell
        for (let colIdx = 4; colIdx <= 34; colIdx++) {
          const val = row.getCell(colIdx).value
          if (typeof val === 'number') {
            row.getCell(colIdx).numFmt = '"Rp"#,##0'
          }
        }
        row.getCell(35).numFmt = '"Rp"#,##0' // AI column

        rowNum++
      }

      const classEndRow = rowNum - 1
      if (classEndRow >= classStartRow) {
        // Class summary row
        const totalRowValues = ['total', '', '']
        for (let d = 1; d <= 31; d++) {
          const colLetter = getColLetter(d)
          totalRowValues.push({ formula: `=SUM(${colLetter}${classStartRow}:${colLetter}${classEndRow})` })
        }
        totalRowValues.push({ formula: `=SUM(AI${classStartRow}:AI${classEndRow})` })

        const totalRow = sheet.addRow(totalRowValues)
        totalRow.font = { bold: true }
        
        // Style total row cells
        for (let colIdx = 4; colIdx <= 35; colIdx++) {
          totalRow.getCell(colIdx).numFmt = '"Rp"#,##0'
        }
        
        rowNum++

        // Empty separator row
        sheet.addRow([''])
        rowNum++
      }
    }

    // Set column widths (converted from pixels to characters: px / 7.5)
    sheet.columns.forEach((column, index) => {
      if (index === 0) {
        column.width = 13 // NIS (100 px)
      } else if (index === 1) {
        column.width = 16 // Nama (120 px)
      } else if (index === 2) {
        column.width = 11 // Kelas (85 px)
      } else if (index === 34) {
        column.width = 16 // Jumlah total (120 px)
      } else {
        column.width = 11  // Day Columns (85 px)
      }
    })
  }

  // Write to local disk
  try {
    await workbook.xlsx.writeFile(backupPath)
    console.log(`[Local Backup] Excel backup written successfully to: ${backupPath}`)
  } catch (writeErr) {
    if (writeErr.code === 'EBUSY') {
      const fallbackPath = backupPath.replace('.xlsx', '_locked_tutup_excel_untuk_sync.xlsx')
      try {
        await workbook.xlsx.writeFile(fallbackPath)
        console.warn(`[Local Backup] Peringatan: Berkas utama ${backupPath} sedang terkunci (mungkin dibuka di Excel). Perubahan disimpan ke: ${fallbackPath}. Tutup berkas utama di Excel agar sinkronisasi kembali normal.`)
      } catch (fallbackErr) {
        console.error('[Local Backup] Gagal menulis ke berkas cadangan kedua:', fallbackErr.message)
      }
    } else {
      throw writeErr
    }
  }
}

import ExcelJS from 'exceljs'
import { pool } from '../db/pool.js'

const VALID_JURUSAN = ['TKJ', 'MP', 'AKL', 'TSM', 'TKR']
const VALID_GRADE = ['X', 'XI', 'XII']

/**
 * Stream-parse an uploaded .xlsx file and upsert students into PostgreSQL.
 * Uses WorkbookReader (streaming) to avoid RAM spikes on large files.
 */
export async function ExcelWorkbookReader(fileStream) {
  const classesRes = await pool.query('SELECT class_name FROM classes')
  const validClasses = new Set(classesRes.rows.map(r => r.class_name))

  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(fileStream, {
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    styles: 'ignore',
    worksheets: 'emit',
  })

  const result = { imported: 0, updated: 0, skipped: 0, errors: [] }
  let rowIndex = 0

  try {
    for await (const worksheetReader of workbookReader) {
      for await (const row of worksheetReader) {
        rowIndex++

        // Skip header row
        if (rowIndex === 1) continue

        try {
          const nis = String(row.getCell(1).value || '').trim()
          const name = String(row.getCell(2).value || '').trim()
          const class_name = String(row.getCell(3).value || '').trim()
          const jurusan = String(row.getCell(4).value || '').trim().toUpperCase()
          const grade = String(row.getCell(5).value || '').trim().toUpperCase()

          // Validation
          if (!nis || !name || !class_name || !jurusan || !grade) {
            result.errors.push({ row: rowIndex, error: 'Missing required fields', data: { nis, name } })
            result.skipped++
            continue
          }
          if (!validClasses.has(class_name)) {
            result.errors.push({ row: rowIndex, error: `Kelas '${class_name}' tidak terdaftar di database Master Kelas`, data: { nis, name } })
            result.skipped++
            continue
          }
          if (!VALID_JURUSAN.includes(jurusan)) {
            result.errors.push({ row: rowIndex, error: `Invalid jurusan: ${jurusan}`, data: { nis, name } })
            result.skipped++
            continue
          }
          if (!VALID_GRADE.includes(grade)) {
            result.errors.push({ row: rowIndex, error: `Invalid grade: ${grade}`, data: { nis, name } })
            result.skipped++
            continue
          }
          if (!/^\d{5,20}$/.test(nis)) {
            result.errors.push({ row: rowIndex, error: `Invalid NIS format: ${nis}`, data: { nis, name } })
            result.skipped++
            continue
          }

          const queryResult = await pool.query(
            `INSERT INTO students (nis, name, class_name, jurusan, grade, status)
             VALUES ($1, $2, $3, $4, $5, 'AKTIF')
             ON CONFLICT (nis) DO UPDATE
               SET name = EXCLUDED.name,
                   class_name = EXCLUDED.class_name,
                   jurusan = EXCLUDED.jurusan,
                   grade = EXCLUDED.grade,
                   status = 'AKTIF'
             RETURNING (xmax = 0) AS is_new`,
            [nis, name, class_name, jurusan, grade]
          )

          if (queryResult.rows[0]?.is_new) {
            result.imported++
          } else {
            result.updated++
          }
        } catch (rowErr) {
          result.errors.push({ row: rowIndex, error: rowErr.message })
          result.skipped++
        }
      }
      // Only process the first worksheet
      break
    }
  } catch (err) {
    throw new Error(`Excel stream parsing failed: ${err.message}`)
  }

  return result
}

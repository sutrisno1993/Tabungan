import ExcelJS from 'exceljs'
import { pool } from '../db/pool.js'

/**
 * Generate a class savings report as an Excel buffer.
 * Columns: NIS | Nama Siswa | Total Tabungan | Kekurangan | Frekuensi Menabung | Status
 */
export async function generateClassReport(class_name) {
  // Fetch students with balance and deposit frequency
  const studentsResult = await pool.query(
    `SELECT
      s.nis,
      s.name,
      COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE 0 END), 0) AS total_setor,
      COALESCE(SUM(CASE WHEN t.type = 'POTONG' THEN t.amount ELSE 0 END), 0) AS total_potong,
      COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE -t.amount END), 0) AS balance,
      COUNT(CASE WHEN t.type = 'SETOR' THEN 1 END) AS deposit_count
     FROM students s
     LEFT JOIN transactions t ON s.nis = t.nis AND t.deleted_at IS NULL
     WHERE s.class_name = $1
     GROUP BY s.nis, s.name
     ORDER BY s.name ASC`,
    [class_name]
  )

  // Fetch total agenda target for the class
  const agendaResult = await pool.query(
    'SELECT COALESCE(SUM(target_amount), 0) AS total_target FROM agendas WHERE class_name = $1',
    [class_name]
  )

  const totalTarget = parseFloat(agendaResult.rows[0]?.total_target || 0)
  const students = studentsResult.rows

  // Build Excel workbook
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Smart BANK - SMK 11 Maret'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(`Laporan ${class_name}`)

  // Header row styling
  sheet.columns = [
    { header: 'NIS', key: 'nis', width: 15 },
    { header: 'Nama Siswa', key: 'name', width: 30 },
    { header: 'Total Tabungan', key: 'total_setor', width: 20 },
    { header: 'Kekurangan', key: 'kekurangan', width: 20 },
    { header: 'Frekuensi Menabung', key: 'deposit_count', width: 20 },
    { header: 'Status', key: 'status', width: 15 },
  ]

  // Style header row
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A5F' }, // Dark blue
  }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
  headerRow.height = 25

  const isGradeXII = class_name.startsWith('XII') || class_name.split(/[- ]/)[0] === 'XII'

  // Populate data rows
  for (const student of students) {
    const balance = parseFloat(student.balance)
    const kekurangan = totalTarget > 0 ? Math.max(0, totalTarget - balance) : 0
    let status = 'Belum Lunas'
    if (balance >= totalTarget) {
      status = (isGradeXII && balance > 0) ? 'Refund' : 'Lunas'
    }

    const row = sheet.addRow({
      nis: student.nis,
      name: student.name,
      total_setor: parseFloat(student.total_setor),
      kekurangan,
      deposit_count: parseInt(student.deposit_count),
      status,
    })

    // Rupiah format for currency columns
    row.getCell('total_setor').numFmt = '"Rp"#,##0'
    row.getCell('kekurangan').numFmt = '"Rp"#,##0'

    // Color status cell
    const statusCell = row.getCell('status')
    if (status === 'Refund') {
      statusCell.font = { color: { argb: 'FF0C5460' }, bold: true }
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1ECF1' } }
    } else if (status === 'Lunas') {
      statusCell.font = { color: { argb: 'FF155724' } }
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } }
    } else {
      statusCell.font = { color: { argb: 'FF721C24' } }
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } }
    }

    // Highlight negative balances
    if (balance < 0) {
      row.getCell('total_setor').font = { color: { argb: 'FFDC3545' }, bold: true }
    }
  }

  // Auto-filter
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 6 },
  }

  // Freeze header row
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  // Summary row at the bottom
  const summaryRowNum = students.length + 3
  sheet.getCell(`A${summaryRowNum}`).value = 'Total Kelas'
  sheet.getCell(`A${summaryRowNum}`).font = { bold: true }
  sheet.getCell(`C${summaryRowNum}`).value = {
    formula: `SUM(C2:C${students.length + 1})`,
  }
  sheet.getCell(`C${summaryRowNum}`).numFmt = '"Rp"#,##0'
  sheet.getCell(`C${summaryRowNum}`).font = { bold: true }

  // Return as buffer (no temp files)
  const buffer = await workbook.xlsx.writeBuffer()
  return buffer
}

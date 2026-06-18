import { pool } from '../db/pool.js'
import { ExcelWorkbookReader } from '../services/excelService.js'
import { generateClassReport } from '../services/reportService.js'
import { triggerLocalBackup } from '../services/localBackupService.js'

export default async function excelRoutes(fastify) {
  // POST /api/excel/import-students (Admin only — streaming import)
  fastify.post('/import-students', {
    preHandler: [fastify.authorizeAdmin],
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } }, // Stricter rate limit for uploads
  }, async (request, reply) => {
    const data = await request.file()

    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' })
    }

    const mimeType = data.mimetype
    if (
      mimeType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
      mimeType !== 'application/vnd.ms-excel'
    ) {
      return reply.code(400).send({ error: 'Only .xlsx files are accepted' })
    }

    try {
      const result = await ExcelWorkbookReader(data.file)

      if (result.errors.length > 0 && result.imported === 0) {
        return reply.code(422).send({
          error: 'Import failed — file contains invalid data',
          details: result.errors.slice(0, 20), // Return first 20 errors max
        })
      }

      triggerLocalBackup()
      reply.send({
        message: 'Import completed',
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.slice(0, 20),
      })
    } catch (err) {
      fastify.log.error(err, 'Excel import error')
      return reply.code(422).send({ error: 'Failed to parse Excel file. Ensure the file is valid.' })
    }
  })

  // GET /api/excel/export-report/:class_name (Admin & WALAS)
  fastify.get('/export-report/:class_name', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { class_name } = request.params
    const user = request.user

    if (user.role === 'WALAS' && user.target_class !== class_name) {
      return reply.code(403).send({ error: 'Access denied' })
    }

    try {
      const buffer = await generateClassReport(class_name)

      const safeClassName = class_name.replace(/[^a-zA-Z0-9-]/g, '_')
      const filename = `Laporan_Tabungan_${safeClassName}_${new Date().toISOString().slice(0, 10)}.xlsx`

      reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(buffer)
    } catch (err) {
      fastify.log.error('Excel export error:', err)
      reply.code(500).send({ error: 'Failed to generate report' })
    }
  })
}

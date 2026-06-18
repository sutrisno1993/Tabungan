import { pool } from '../db/pool.js'
import { backupTodayToSheets } from '../services/googleSheetsService.js'

export default async function sheetsRoutes(fastify) {
  // GET /api/sheets/sync-status (Admin only)
  fastify.get('/sync-status', { preHandler: [fastify.authorizeAdmin] }, async (request, reply) => {
    const today = new Date().toISOString().slice(0, 10)
    try {
      const result = await pool.query(
        `SELECT COUNT(*)::integer AS count FROM google_sheets_sync_logs WHERE sync_date = $1 AND status = 'SUCCESS'`,
        [today]
      )
      const count = result.rows[0]?.count || 0

      // Fetch spreadsheet ID dynamically from settings table
      let spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
      try {
        const settingResult = await pool.query(
          `SELECT value FROM system_settings WHERE key = 'google_sheets_spreadsheet_id'`
        )
        if (settingResult.rows[0]?.value) {
          spreadsheetId = settingResult.rows[0].value
        }
      } catch (dbErr) {
        fastify.log.warn('Failed to fetch spreadsheet ID from db, using fallback:', dbErr.message)
      }

      reply.send({
        count,
        spreadsheetId
      })
    } catch (err) {
      fastify.log.error('Failed to get sync status:', err)
      reply.code(500).send({ error: 'Failed to retrieve sync status' })
    }
  })

  // POST /api/sheets/settings (Admin only)
  fastify.post('/settings', { preHandler: [fastify.authorizeAdmin] }, async (request, reply) => {
    const { spreadsheetId } = request.body
    if (!spreadsheetId) {
      return reply.code(400).send({ error: 'spreadsheetId is required' })
    }
    try {
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ('google_sheets_spreadsheet_id', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [spreadsheetId]
      )
      reply.send({ success: true, message: 'Settings saved successfully' })
    } catch (err) {
      fastify.log.error('Failed to save sheets settings:', err)
      reply.code(500).send({ error: 'Failed to save settings', message: err.message })
    }
  })

  // POST /api/sheets/sync (Admin only)
  fastify.post('/sync', {
    preHandler: [fastify.authorizeAdmin],
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } } // Prevent API rate limit spamming
  }, async (request, reply) => {
    try {
      const syncResult = await backupTodayToSheets('MANUAL')
      reply.send(syncResult)
    } catch (err) {
      fastify.log.error('Manual sheet sync failed:', err)
      reply.code(500).send({ error: 'Sync failed', message: err.message })
    }
  })
}

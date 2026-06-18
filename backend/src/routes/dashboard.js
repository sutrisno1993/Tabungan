import { pool } from '../db/pool.js'
import { GET_CLASS_SUMMARY, GET_AGENDA_PROGRESS, GET_STUDENT_HISTORY } from '../db/queries.js'

export default async function dashboardRoutes(fastify) {
  // ── Public routes MUST be registered BEFORE /:class_name to avoid param conflict ──

  // GET /api/dashboard/public-summary — Public global summary (no auth required)
  fastify.get('/public-summary', async (request, reply) => {
    try {
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

      // 1. School-wide totals
      const overviewResult = await pool.query(`
        SELECT
          (SELECT COUNT(*)::integer FROM students) AS total_students,
          (SELECT COUNT(DISTINCT class_name)::integer FROM students) AS total_classes,
          COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE 0 END), 0)::numeric AS total_collected,
          COALESCE(SUM(CASE WHEN t.type = 'POTONG' THEN t.amount ELSE 0 END), 0)::numeric AS total_debited
        FROM transactions t
        WHERE t.deleted_at IS NULL
      `)
      const overview = overviewResult.rows[0] || { total_students: 0, total_classes: 0, total_collected: 0, total_debited: 0 }
      overview.balance = parseFloat(overview.total_collected || 0) - parseFloat(overview.total_debited || 0)

      // 2. Class financial breakdown
      const breakdownResult = await pool.query(`
        SELECT
          s.class_name,
          u.nama_lengkap AS walas_name,
          COUNT(DISTINCT s.nis)::integer AS student_count,
          COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE 0 END), 0)::numeric AS total_collected,
          COALESCE(SUM(CASE WHEN t.type = 'POTONG' THEN t.amount ELSE 0 END), 0)::numeric AS total_debited,
          COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE -t.amount END), 0)::numeric AS balance
        FROM students s
        LEFT JOIN users u ON u.role = 'WALAS' AND u.target_class = s.class_name
        LEFT JOIN transactions t ON t.nis = s.nis AND t.deleted_at IS NULL
        GROUP BY s.class_name, u.nama_lengkap
        ORDER BY balance DESC
      `)

      // 3. Monthly trends for the current academic year
      const trendResult = await pool.query(`
        SELECT
          EXTRACT(YEAR FROM t.date)::integer AS year,
          EXTRACT(MONTH FROM t.date)::integer AS month,
          COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE 0 END), 0)::numeric AS total_setor,
          COALESCE(SUM(CASE WHEN t.type = 'POTONG' THEN t.amount ELSE 0 END), 0)::numeric AS total_potong
        FROM transactions t
        WHERE t.deleted_at IS NULL
          AND t.date >= $1 AND t.date <= $2
        GROUP BY EXTRACT(YEAR FROM t.date), EXTRACT(MONTH FROM t.date)
        ORDER BY year ASC, month ASC
      `, [startDate, endDate])

      reply.send({
        overview,
        classes: breakdownResult.rows,
        trends: trendResult.rows
      })
    } catch (err) {
      fastify.log.error('Failed to get public summary:', err)
      reply.code(500).send({ error: 'Failed to retrieve public summary', message: err.message })
    }
  })

  // GET /api/dashboard/public-class/:class_name — Public class details (no auth required)
  fastify.get('/public-class/:class_name', async (request, reply) => {
    const { class_name } = request.params
    try {
      const [summary, students] = await Promise.all([
        pool.query(GET_CLASS_SUMMARY, [class_name]),
        pool.query(
          `SELECT s.nis, s.name,
            COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE -t.amount END), 0) AS balance,
            COUNT(CASE WHEN t.type = 'SETOR' THEN 1 END) AS deposit_count
           FROM students s
           LEFT JOIN transactions t ON s.nis = t.nis AND t.deleted_at IS NULL
           WHERE s.class_name = $1
           GROUP BY s.nis, s.name
           ORDER BY balance DESC, s.name ASC`,
          [class_name]
        ),
      ])

      reply.send({
        class_name,
        summary: summary.rows[0],
        students: students.rows,
      })
    } catch (err) {
      fastify.log.error(`Failed to get public class details for ${class_name}:`, err)
      reply.code(500).send({ error: 'Failed to retrieve public class details', message: err.message })
    }
  })

  // GET /api/dashboard/public/:token — Public parent access (no auth required)
  fastify.get('/public/:token', async (request, reply) => {
    const { token } = request.params

    const result = await pool.query(
      'SELECT class_name FROM class_public_tokens WHERE token = $1',
      [token]
    )

    if (result.rowCount === 0) {
      return reply.code(404).send({ error: 'Invalid or expired link' })
    }

    const { class_name } = result.rows[0]

    const [summary, agendas, students] = await Promise.all([
      pool.query(GET_CLASS_SUMMARY, [class_name]),
      pool.query(GET_AGENDA_PROGRESS, [class_name]),
      pool.query(
        `SELECT s.nis, s.name,
          COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE -t.amount END), 0) AS balance,
          COUNT(CASE WHEN t.type = 'SETOR' THEN 1 END) AS deposit_count
         FROM students s
         LEFT JOIN transactions t ON s.nis = t.nis AND t.deleted_at IS NULL
         WHERE s.class_name = $1
         GROUP BY s.nis, s.name
         ORDER BY s.name ASC`,
        [class_name]
      ),
    ])

    reply.send({
      class_name,
      summary: summary.rows[0],
      agendas: agendas.rows,
      students: students.rows,
    })
  })

  // GET /api/dashboard/public/:token/student/:nis — Student deposit history (public)
  fastify.get('/public/:token/student/:nis', async (request, reply) => {
    const { token, nis } = request.params

    const tokenResult = await pool.query(
      'SELECT class_name FROM class_public_tokens WHERE token = $1',
      [token]
    )

    if (tokenResult.rowCount === 0) {
      return reply.code(404).send({ error: 'Invalid or expired link' })
    }

    const { class_name } = tokenResult.rows[0]

    const studentCheck = await pool.query(
      'SELECT nis, name FROM students WHERE nis = $1 AND class_name = $2',
      [nis, class_name]
    )

    if (studentCheck.rowCount === 0) {
      return reply.code(404).send({ error: 'Student not found' })
    }

    const history = await pool.query(GET_STUDENT_HISTORY, [nis])

    reply.send({
      student: studentCheck.rows[0],
      transactions: history.rows,
    })
  })

  // GET /api/dashboard/global-summary — Authenticated (ADMIN only)
  fastify.get('/global-summary', { preHandler: [fastify.authorizeAdmin] }, async (request, reply) => {
    try {
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

      // 1. School-wide totals
      const overviewResult = await pool.query(`
        SELECT
          (SELECT COUNT(*)::integer FROM students) AS total_students,
          (SELECT COUNT(DISTINCT class_name)::integer FROM students) AS total_classes,
          COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE 0 END), 0)::numeric AS total_collected,
          COALESCE(SUM(CASE WHEN t.type = 'POTONG' THEN t.amount ELSE 0 END), 0)::numeric AS total_debited
        FROM transactions t
        WHERE t.deleted_at IS NULL
      `)
      const overview = overviewResult.rows[0] || { total_students: 0, total_classes: 0, total_collected: 0, total_debited: 0 }
      overview.balance = parseFloat(overview.total_collected || 0) - parseFloat(overview.total_debited || 0)

      // 2. Class financial breakdown
      const breakdownResult = await pool.query(`
        SELECT
          s.class_name,
          u.nama_lengkap AS walas_name,
          u.no_wa AS walas_phone,
          COUNT(DISTINCT s.nis)::integer AS student_count,
          COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE 0 END), 0)::numeric AS total_collected,
          COALESCE(SUM(CASE WHEN t.type = 'POTONG' THEN t.amount ELSE 0 END), 0)::numeric AS total_debited,
          COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE -t.amount END), 0)::numeric AS balance
        FROM students s
        LEFT JOIN users u ON u.role = 'WALAS' AND u.target_class = s.class_name
        LEFT JOIN transactions t ON t.nis = s.nis AND t.deleted_at IS NULL
        GROUP BY s.class_name, u.nama_lengkap, u.no_wa
        ORDER BY s.class_name ASC
      `)

      // 3. Monthly trends for the current academic year
      const trendResult = await pool.query(`
        SELECT
          EXTRACT(YEAR FROM t.date)::integer AS year,
          EXTRACT(MONTH FROM t.date)::integer AS month,
          COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE 0 END), 0)::numeric AS total_setor,
          COALESCE(SUM(CASE WHEN t.type = 'POTONG' THEN t.amount ELSE 0 END), 0)::numeric AS total_potong
        FROM transactions t
        WHERE t.deleted_at IS NULL
          AND t.date >= $1 AND t.date <= $2
        GROUP BY EXTRACT(YEAR FROM t.date), EXTRACT(MONTH FROM t.date)
        ORDER BY year ASC, month ASC
      `, [startDate, endDate])

      reply.send({
        overview,
        classes: breakdownResult.rows,
        trends: trendResult.rows
      })
    } catch (err) {
      fastify.log.error('Failed to get global summary:', err)
      reply.code(500).send({ error: 'Failed to retrieve global summary', message: err.message })
    }
  })

  // GET /api/dashboard/:class_name — Authenticated (ADMIN & WALAS)
  fastify.get('/:class_name', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { class_name } = request.params
    const user = request.user

    if (user.role === 'WALAS' && user.target_class !== class_name) {
      return reply.code(403).send({ error: 'Access denied' })
    }

    const [summary, agendas, students] = await Promise.all([
      pool.query(GET_CLASS_SUMMARY, [class_name]),
      pool.query(GET_AGENDA_PROGRESS, [class_name]),
      pool.query(
        `SELECT s.nis, s.name,
          COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE -t.amount END), 0) AS balance,
          COUNT(CASE WHEN t.type = 'SETOR' THEN 1 END) AS deposit_count
         FROM students s
         LEFT JOIN transactions t ON s.nis = t.nis AND t.deleted_at IS NULL
         WHERE s.class_name = $1
         GROUP BY s.nis, s.name
         ORDER BY s.name ASC`,
        [class_name]
      ),
    ])

    reply.send({
      class_name,
      summary: summary.rows[0],
      agendas: agendas.rows,
      students: students.rows,
    })
  })
}

import { pool, supabase } from '../db/pool.js'
import { GET_GRID_TRANSACTIONS, GET_STUDENT_HISTORY } from '../db/queries.js'
import { io } from '../server.js'
import { triggerLocalBackup } from '../services/localBackupService.js'

export default async function transactionsRoutes(fastify) {
  // GET /api/transactions/grid
  fastify.get('/grid', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { class_name, year, month } = request.query
    const user = request.user
    const effectiveClass = user.role === 'WALAS' ? user.target_class : class_name

    if (!effectiveClass || !year || !month) {
      return reply.code(400).send({ error: 'class_name, year, dan month wajib diisi' })
    }

    const result = await pool.query(GET_GRID_TRANSACTIONS, [effectiveClass, year, month])
    reply.send({ transactions: result.rows })
  })

  // GET /api/transactions/student/:nis
  fastify.get('/student/:nis', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { nis } = request.params
    const user = request.user

    if (user.role === 'WALAS') {
      const { data } = await supabase.from('students').select('class_name').eq('nis', nis).single()
      if (!data || data.class_name !== user.target_class) {
        return reply.code(403).send({ error: 'Akses ditolak' })
      }
    }

    const result = await pool.query(GET_STUDENT_HISTORY, [nis])
    reply.send({ transactions: result.rows })
  })

  // POST /api/transactions — single upsert (dipakai grid)
  fastify.post('/', { preHandler: [fastify.authorizeAdmin] }, async (request, reply) => {
    const { nis, date, amount, type, description, agenda_id } = request.body

    if (!nis || amount == null || !type) {
      return reply.code(400).send({ error: 'nis, amount, dan type wajib diisi' })
    }
    if (!['SETOR', 'POTONG'].includes(type)) {
      return reply.code(400).send({ error: 'type harus SETOR atau POTONG' })
    }
    if (amount < 0) {
      return reply.code(400).send({ error: 'amount harus >= 0' })
    }

    const { data: student } = await supabase.from('students').select('class_name').eq('nis', nis).single()
    if (!student) return reply.code(404).send({ error: 'Siswa tidak ditemukan' })

    const txDate = date || new Date().toISOString().slice(0, 10)

    // Soft-delete transaksi existing untuk cell ini (upsert pattern)
    await supabase
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('nis', nis)
      .eq('date', txDate)
      .eq('type', type)
      .is('agenda_id', null)
      .is('deleted_at', null)

    let transaction = null
    if (amount > 0) {
      const { data, error } = await supabase
        .from('transactions')
        .insert({ nis, date: txDate, amount, type, description: description || null, agenda_id: agenda_id || null })
        .select()
        .single()

      if (error) throw new Error(error.message)
      transaction = data
    }

    io.to(`class:${student.class_name}`).emit('transaction:new', { transaction, className: student.class_name })
    triggerLocalBackup()
    reply.code(201).send({ transaction })
  })

  // POST /api/transactions/batch
  fastify.post('/batch', { preHandler: [fastify.authorizeAdmin] }, async (request, reply) => {
    const { transactions } = request.body

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return reply.code(400).send({ error: 'transactions array wajib diisi' })
    }
    if (transactions.length > 500) {
      return reply.code(400).send({ error: 'Maksimal 500 transaksi per batch' })
    }

    const inserted = []
    const affectedClasses = new Set()

    for (const tx of transactions) {
      const { nis, date, amount, type, description } = tx
      if (!nis || !date || amount == null || !type) continue
      if (!['SETOR', 'POTONG'].includes(type)) continue
      if (amount <= 0) continue

      const { data: student } = await supabase.from('students').select('class_name').eq('nis', nis).single()
      if (!student) continue
      affectedClasses.add(student.class_name)

      await supabase
        .from('transactions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('nis', nis).eq('date', date).eq('type', type)
        .is('agenda_id', null).is('deleted_at', null)

      const { data } = await supabase
        .from('transactions')
        .insert({ nis, date, amount, type, description: description || null })
        .select().single()

      if (data) inserted.push(data)
    }

    for (const className of affectedClasses) {
      io.to(`class:${className}`).emit('transaction:batch', { className })
    }

    triggerLocalBackup()
    reply.code(201).send({ inserted: inserted.length, transactions: inserted })
  })

  // DELETE /api/transactions/:id — soft delete
  fastify.delete('/:id', { preHandler: [fastify.authorizeAdmin] }, async (request, reply) => {
    const { id } = request.params

    const { data, error } = await supabase
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id, nis')
      .single()

    if (error || !data) {
      return reply.code(404).send({ error: 'Transaksi tidak ditemukan atau sudah dihapus' })
    }

    const { data: student } = await supabase.from('students').select('class_name').eq('nis', data.nis).single()
    if (student) {
      io.to(`class:${student.class_name}`).emit('transaction:deleted', { id: Number(id) })
    }

    triggerLocalBackup()
    reply.send({ message: 'Transaksi dihapus', id: Number(id) })
  })

  // GET /api/transactions/daily-summary (Admin & WALAS)
  fastify.get('/daily-summary', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { date } = request.query
    if (!date) {
      return reply.code(400).send({ error: 'date wajib diisi' })
    }

    const result = await pool.query(`
      SELECT 
        c.class_name,
        COALESCE(SUM(CASE WHEN t.type = 'SETOR' AND t.date = $1 THEN t.amount ELSE 0 END), 0)::numeric AS pemasukan,
        COALESCE(SUM(CASE WHEN t.type = 'POTONG' AND t.date = $1 THEN t.amount ELSE 0 END), 0)::numeric AS pengeluaran
      FROM classes c
      LEFT JOIN students s ON s.class_name = c.class_name
      LEFT JOIN transactions t ON t.nis = s.nis AND t.deleted_at IS NULL AND t.date = $1
      GROUP BY c.class_name
      ORDER BY c.class_name ASC
    `, [date])

    reply.send({ summary: result.rows })
  })

  // GET /api/transactions/daily-details (Admin & WALAS)
  fastify.get('/daily-details', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { class_name, date } = request.query
    if (!class_name || !date) {
      return reply.code(400).send({ error: 'class_name dan date wajib diisi' })
    }

    const result = await pool.query(`
      SELECT 
        t.id,
        t.nis,
        s.name AS student_name,
        t.type,
        t.amount,
        t.description,
        t.date
      FROM transactions t
      JOIN students s ON t.nis = s.nis
      WHERE s.class_name = $1
        AND t.date = $2
        AND t.deleted_at IS NULL
      ORDER BY t.type ASC, s.name ASC
    `, [class_name, date])

    reply.send({ details: result.rows })
  })
}

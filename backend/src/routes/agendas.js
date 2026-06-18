import { pool, supabase } from '../db/pool.js'
import { GET_AGENDA_PROGRESS } from '../db/queries.js'
import { io } from '../server.js'
import { triggerLocalBackup } from '../services/localBackupService.js'

export default async function agendasRoutes(fastify) {
  // GET /api/agendas?class_name=... or ?grade=...
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { class_name, grade } = request.query
    const user = request.user

    if (user.role === 'WALAS') {
      const result = await pool.query(GET_AGENDA_PROGRESS, [user.target_class])
      return reply.send({ agendas: result.rows })
    }

    if (!class_name && !grade) {
      return reply.code(400).send({ error: 'class_name atau grade wajib diisi' })
    }

    if (class_name) {
      const result = await pool.query(GET_AGENDA_PROGRESS, [class_name])
      return reply.send({ agendas: result.rows })
    }

    if (grade) {
      const result = await pool.query(`
        SELECT
          a.id,
          a.class_name,
          a.agenda_name,
          a.target_amount,
          a.due_date,
          COUNT(DISTINCT s.nis)::integer AS total_students,
          COUNT(DISTINCT CASE WHEN bal.balance >= a.target_amount THEN s.nis END)::integer AS students_met,
          COALESCE(SUM(CASE WHEN t.type = 'POTONG' AND t.agenda_id = a.id THEN t.amount ELSE 0 END), 0)::numeric AS total_debited
        FROM agendas a
        LEFT JOIN students s ON s.class_name = a.class_name
        LEFT JOIN transactions t ON t.nis = s.nis AND t.deleted_at IS NULL
        LEFT JOIN (
          SELECT nis,
            SUM(CASE WHEN type = 'SETOR' THEN amount ELSE -amount END) AS balance
          FROM transactions
          WHERE deleted_at IS NULL
          GROUP BY nis
        ) bal ON bal.nis = s.nis
        WHERE split_part(a.class_name, '-', 1) = $1 OR s.grade = $1
        GROUP BY a.id, a.class_name, a.agenda_name, a.target_amount, a.due_date
        ORDER BY a.due_date ASC, a.class_name ASC
      `, [grade])
      return reply.send({ agendas: result.rows })
    }
  })

  // POST /api/agendas
  fastify.post('/', { preHandler: [fastify.authorizeAdmin] }, async (request, reply) => {
    const { class_name, agenda_name, target_amount, due_date, scope = 'class', grade: inputGrade } = request.body

    if ((!class_name && !inputGrade) || !agenda_name || !target_amount || !due_date) {
      return reply.code(400).send({ error: 'Semua field wajib diisi' })
    }

    if (class_name) {
      const classCheck = await pool.query('SELECT 1 FROM classes WHERE class_name = $1', [class_name])
      if (classCheck.rowCount === 0) {
        return reply.code(400).send({ error: `Kelas '${class_name}' tidak terdaftar di database Master Kelas` })
      }
    }

    let targetClasses = []

    if (inputGrade) {
      if (['X', 'XI', 'XII'].includes(inputGrade)) {
        const classesRes = await pool.query('SELECT class_name FROM classes WHERE grade = $1', [inputGrade])
        if (classesRes.rowCount > 0) {
          targetClasses = classesRes.rows.map(r => r.class_name)
        }
      }
      if (targetClasses.length === 0 && class_name) {
        targetClasses = [class_name]
      }
    } else {
      targetClasses = [class_name]
      if (scope === 'grade') {
        let grade = class_name.split(/[- ]/)[0]
        if (!['X', 'XI', 'XII'].includes(grade)) {
          const qRes = await pool.query('SELECT grade FROM classes WHERE class_name = $1 LIMIT 1', [class_name])
          if (qRes.rowCount > 0) grade = qRes.rows[0].grade
        }

        if (['X', 'XI', 'XII'].includes(grade)) {
          const classesRes = await pool.query('SELECT class_name FROM classes WHERE grade = $1', [grade])
          if (classesRes.rowCount > 0) {
            targetClasses = classesRes.rows.map(r => r.class_name)
          }
        }
      }
    }

    if (targetClasses.length === 0) {
      return reply.code(400).send({ error: 'Tidak ada kelas penerima agenda yang ditemukan untuk tingkatan tersebut' })
    }

    const inserts = targetClasses.map(cls => ({
      class_name: cls,
      agenda_name,
      target_amount: Number(target_amount),
      due_date
    }))

    const { data, error } = await supabase
      .from('agendas')
      .insert(inserts)
      .select()

    if (error) throw new Error(error.message)
    
    const currentClassAgenda = data.find(a => a.class_name === class_name) || data[0]
    reply.code(201).send({ agenda: currentClassAgenda, created_count: data.length })
  })

  // PUT /api/agendas/:id
  fastify.put('/:id', { preHandler: [fastify.authorizeAdmin] }, async (request, reply) => {
    const { id } = request.params
    const { agenda_name, target_amount, due_date } = request.body

    const updates = {}
    if (agenda_name) updates.agenda_name = agenda_name
    if (target_amount) updates.target_amount = Number(target_amount)
    if (due_date) updates.due_date = due_date

    const { data, error } = await supabase
      .from('agendas').update(updates).eq('id', id).select().single()

    if (error || !data) return reply.code(404).send({ error: 'Agenda tidak ditemukan' })
    reply.send({ agenda: data })
  })

  // DELETE /api/agendas/:id
  fastify.delete('/:id', { preHandler: [fastify.authorizeAdmin] }, async (request, reply) => {
    const { id } = request.params
    const { error } = await supabase.from('agendas').delete().eq('id', id)
    if (error) throw new Error(error.message)
    reply.send({ message: 'Agenda dihapus', id: Number(id) })
  })

  // POST /api/agendas/:id/auto-debit
  fastify.post('/:id/auto-debit', { preHandler: [fastify.authorizeAdmin] }, async (request, reply) => {
    const { id } = request.params
    const { force_mode = false } = request.body

    const { data: agenda } = await supabase.from('agendas').select('*').eq('id', id).single()
    if (!agenda) return reply.code(404).send({ error: 'Agenda tidak ditemukan' })

    // Idempotency check
    const { data: existing } = await supabase
      .from('transactions').select('id').eq('agenda_id', id).eq('type', 'POTONG').limit(1)
    if (existing && existing.length > 0) {
      return reply.code(409).send({ error: 'Auto-debit sudah pernah dieksekusi untuk agenda ini' })
    }

    // Ambil semua siswa + saldo
    const balances = await pool.query(
      `SELECT s.nis, s.name,
        COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE -t.amount END), 0) AS balance
       FROM students s
       LEFT JOIN transactions t ON s.nis = t.nis AND t.deleted_at IS NULL
       WHERE s.class_name = '${agenda.class_name}'
       GROUP BY s.nis, s.name`
    )

    const debited = []
    const skipped = []

    for (const student of balances.rows) {
      const balance = parseFloat(student.balance)
      const hasEnough = balance >= parseFloat(agenda.target_amount)

      if (!hasEnough && !force_mode) {
        skipped.push({ nis: student.nis, name: student.name, balance })
        continue
      }

      const { error } = await supabase.from('transactions').insert({
        nis: student.nis,
        date: new Date().toISOString().slice(0, 10),
        amount: agenda.target_amount,
        type: 'POTONG',
        description: `Auto-debit: ${agenda.agenda_name}`,
        agenda_id: agenda.id,
      })

      if (!error) debited.push({ nis: student.nis, name: student.name, balance, force: !hasEnough })
    }

    io.to(`class:${agenda.class_name}`).emit('transaction:auto-debit', {
      agenda_id: agenda.id,
      agenda_name: agenda.agenda_name,
      debited_count: debited.length,
    })

    triggerLocalBackup()
    reply.send({
      message: 'Auto-debit selesai',
      mode: force_mode ? 'FORCE' : 'STANDARD',
      debited,
      skipped,
    })
  })
}

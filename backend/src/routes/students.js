import { pool, supabase } from '../db/pool.js'
import { GET_BALANCE_BY_NIS, GET_BALANCES_BY_CLASS } from '../db/queries.js'
import { triggerLocalBackup } from '../services/localBackupService.js'

export default async function studentsRoutes(fastify) {
  // GET /api/students?class_name=X-TKJ-1
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { class_name, grade, jurusan, status } = request.query
    const user = request.user
    const effectiveClass = user.role === 'WALAS' ? user.target_class : class_name

    let query = supabase.from('students').select('nis, name, class_name, jurusan, grade, status').order('class_name').order('name')
    
    // Filter by status (default is AKTIF)
    const effectiveStatus = status || 'AKTIF'
    if (effectiveStatus !== 'ALL') {
      query = query.eq('status', effectiveStatus)
    }

    if (effectiveClass === 'unassigned') {
      query = query.is('class_name', null)
    } else if (effectiveClass) {
      query = query.eq('class_name', effectiveClass)
    }

    if (grade && user.role === 'ADMIN') query = query.eq('grade', grade)
    if (jurusan && user.role === 'ADMIN') query = query.eq('jurusan', jurusan)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    reply.send({ students: data })
  })

  // GET /api/students/:nis
  fastify.get('/:nis', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { nis } = request.params
    const user = request.user

    const result = await pool.query(GET_BALANCE_BY_NIS, [nis])
    if (result.rowCount === 0) return reply.code(404).send({ error: 'Siswa tidak ditemukan' })

    const student = result.rows[0]
    if (user.role === 'WALAS' && student.class_name !== user.target_class) {
      return reply.code(403).send({ error: 'Akses ditolak' })
    }
    reply.send({ student })
  })

  // GET /api/students/class/:class_name/balances
  fastify.get('/class/:class_name/balances', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { class_name } = request.params
    const user = request.user

    if (user.role === 'WALAS' && user.target_class !== class_name) {
      return reply.code(403).send({ error: 'Akses ditolak' })
    }

    let sql = `
      SELECT
        s.nis,
        s.name,
        s.class_name,
        s.grade,
        s.jurusan,
        s.status,
        COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE 0 END), 0)::numeric AS total_setor,
        COALESCE(SUM(CASE WHEN t.type = 'POTONG' THEN t.amount ELSE 0 END), 0)::numeric AS total_potong,
        COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE -t.amount END), 0)::numeric AS balance
      FROM students s
      LEFT JOIN transactions t ON s.nis = t.nis AND t.deleted_at IS NULL
    `
    const params = []
    const whereClauses = []

    // Filter by status (default is AKTIF)
    const { status } = request.query
    const effectiveStatus = status || 'AKTIF'
    if (effectiveStatus !== 'ALL') {
      params.push(effectiveStatus)
      whereClauses.push(`s.status = $${params.length}`)
    }

    if (class_name === '_unassigned' || class_name === 'unassigned') {
      whereClauses.push('s.class_name IS NULL')
    } else if (class_name !== '_all' && class_name !== 'all' && class_name !== '') {
      params.push(class_name)
      whereClauses.push(`s.class_name = $${params.length}`)
    }

    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ')
    }

    sql += `
      GROUP BY s.nis, s.name, s.class_name, s.grade, s.jurusan, s.status
      ORDER BY s.class_name ASC NULLS FIRST, s.name ASC
    `

    const result = await pool.query(sql, params)
    reply.send({ students: result.rows })
  })

  // POST /api/students (Admin only)
  fastify.post('/', { preHandler: [fastify.authorizeAdmin] }, async (request, reply) => {
    const { nis, name, class_name, jurusan, grade, status } = request.body

    if (!nis || !name) {
      return reply.code(400).send({ error: 'NIS dan Nama wajib diisi' })
    }

    const { data, error } = await supabase
      .from('students')
      .upsert({
        nis,
        name,
        class_name: class_name || null,
        jurusan: jurusan || null,
        grade: grade || null,
        status: status || 'AKTIF'
      }, { onConflict: 'nis' })
      .select()
      .single()

    if (error) {
      if (error.code === '23514') return reply.code(400).send({ error: 'Nilai jurusan atau grade tidak valid' })
      throw new Error(error.message)
    }

    triggerLocalBackup()
    reply.code(201).send({ student: data })
  })

  // PUT /api/students/:nis (Admin only)
  fastify.put('/:nis', { preHandler: [fastify.authorizeAdmin] }, async (request, reply) => {
    const { nis } = request.params
    const { name, class_name, jurusan, grade, status } = request.body

    if (!name) {
      return reply.code(400).send({ error: 'Nama wajib diisi' })
    }

    const { data, error } = await supabase
      .from('students')
      .update({
        name,
        class_name: class_name || null,
        jurusan: jurusan || null,
        grade: grade || null,
        status: status || 'AKTIF'
      })
      .eq('nis', nis)
      .select()
      .single()

    if (error) {
      if (error.code === '23514') return reply.code(400).send({ error: 'Nilai jurusan atau grade tidak valid' })
      throw new Error(error.message)
    }

    triggerLocalBackup()
    reply.send({ student: data })
  })

  // DELETE /api/students/:nis (Admin only)
  fastify.delete('/:nis', { preHandler: [fastify.authorizeAdmin] }, async (request, reply) => {
    const { nis } = request.params

    const { error } = await supabase.from('students').delete().eq('nis', nis)
    if (error) throw new Error(error.message)

    triggerLocalBackup()
    reply.send({ message: 'Siswa dihapus', nis })
  })

  // POST /api/students/promote/reset (Admin only)
  fastify.post('/promote/reset', { preHandler: [fastify.authorizeAdmin] }, async (request, reply) => {
    // 1. Luluskan XII: Update status = 'LULUS', class_name/grade/jurusan = NULL untuk siswa kelas XII yang AKTIF
    const graduatesRes = await pool.query(`
      UPDATE students 
      SET status = 'LULUS', class_name = NULL, grade = NULL, jurusan = NULL
      WHERE status = 'AKTIF' AND grade = 'XII'
    `)

    // 2. Reset X & XI: Update class_name/grade/jurusan = NULL untuk siswa X & XI yang AKTIF
    const resetRes = await pool.query(`
      UPDATE students
      SET class_name = NULL, grade = NULL, jurusan = NULL
      WHERE status = 'AKTIF' AND grade IN ('X', 'XI')
    `)
    
    triggerLocalBackup()
    reply.send({
      message: 'Reset kelas dan kelulusan selesai.',
      graduated_count: graduatesRes.rowCount,
      reset_count: resetRes.rowCount
    })
  })

  // POST /api/students/promote/bulk-assign (Admin only)
  fastify.post('/promote/bulk-assign', { preHandler: [fastify.authorizeAdmin] }, async (request, reply) => {
    const { class_name, nis_list } = request.body
    if (!class_name || !Array.isArray(nis_list) || nis_list.length === 0) {
      return reply.code(400).send({ error: 'class_name dan nis_list wajib diisi' })
    }

    // Cek apakah kelas ada
    const classCheck = await pool.query('SELECT grade, jurusan FROM classes WHERE class_name = $1', [class_name])
    if (classCheck.rowCount === 0) {
      return reply.code(404).send({ error: `Kelas '${class_name}' tidak terdaftar di database Master Kelas` })
    }
    const { grade, jurusan } = classCheck.rows[0]

    // Clean up NIS: remove empty strings, whitespace, and normalize
    const cleanNisList = nis_list.map(nis => String(nis).trim()).filter(Boolean)

    // Convert JS array to Postgres array string: {"123","456"}
    const pgArrayStr = `{${cleanNisList.map(nis => `"${nis.replace(/"/g, '\\"')}"`).join(',')}}`

    // Update students bulk
    const assignResult = await pool.query(`
      UPDATE students
      SET class_name = $1, grade = $2, jurusan = $3
      WHERE nis = ANY($4::varchar[]) AND status = 'AKTIF'
      RETURNING nis
    `, [class_name, grade, jurusan, pgArrayStr])

    const assignedNisSet = new Set(assignResult.rows.map(r => r.nis))
    const notFoundNis = cleanNisList.filter(nis => !assignedNisSet.has(nis))

    triggerLocalBackup()
    reply.send({
      message: 'Bulk assign kelas selesai.',
      assigned_count: assignResult.rowCount,
      not_found_nis: notFoundNis
    })
  })
}

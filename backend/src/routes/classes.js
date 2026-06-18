import { pool, supabase } from '../db/pool.js'

export default async function classesRoutes(fastify) {
  // GET /api/classes
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const result = await pool.query(`
      SELECT 
        c.class_name, 
        c.grade, 
        c.jurusan, 
        c.created_at,
        COUNT(DISTINCT s.nis)::integer AS student_count,
        u.nama_lengkap AS walas_name
      FROM classes c
      LEFT JOIN students s ON s.class_name = c.class_name
      LEFT JOIN users u ON u.target_class = c.class_name AND u.role = 'WALAS'
      GROUP BY c.class_name, c.grade, c.jurusan, c.created_at, u.nama_lengkap
      ORDER BY c.class_name ASC
    `)
    reply.send({ classes: result.rows })
  })

  // POST /api/classes (Admin only)
  fastify.post('/', {
    preHandler: [fastify.authorizeAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['class_name', 'grade', 'jurusan'],
        properties: {
          class_name: { type: 'string', minLength: 3, maxLength: 15 },
          grade: { type: 'string', enum: ['X', 'XI', 'XII'] },
          jurusan: { type: 'string', enum: ['TKJ', 'MP', 'AKL', 'TSM', 'TKR'] },
        }
      }
    }
  }, async (request, reply) => {
    const { class_name, grade, jurusan } = request.body

    const { data, error } = await supabase
      .from('classes')
      .insert({ class_name, grade, jurusan })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return reply.code(409).send({ error: 'Nama kelas sudah terdaftar' })
      throw new Error(error.message)
    }

    // Generate public token automatically for the new class
    await supabase.from('class_public_tokens').insert({ class_name }).select().maybeSingle()

    reply.code(201).send({ class: data })
  })

  // PUT /api/classes/:class_name (Admin only)
  fastify.put('/:class_name', {
    preHandler: [fastify.authorizeAdmin],
    schema: {
      body: {
        type: 'object',
        properties: {
          grade: { type: 'string', enum: ['X', 'XI', 'XII'] },
          jurusan: { type: 'string', enum: ['TKJ', 'MP', 'AKL', 'TSM', 'TKR'] },
        }
      }
    }
  }, async (request, reply) => {
    const { class_name } = request.params
    const { grade, jurusan } = request.body

    const updates = {}
    if (grade) updates.grade = grade
    if (jurusan) updates.jurusan = jurusan

    const { data, error } = await supabase
      .from('classes')
      .update(updates)
      .eq('class_name', class_name)
      .select()
      .single()

    if (error || !data) return reply.code(404).send({ error: 'Kelas tidak ditemukan' })

    reply.send({ class: data })
  })

  // DELETE /api/classes/:class_name (Admin only)
  fastify.delete('/:class_name', { preHandler: [fastify.authorizeAdmin] }, async (request, reply) => {
    const { class_name } = request.params

    // Check if class contains any students first
    const studCheck = await pool.query('SELECT 1 FROM students WHERE class_name = $1 LIMIT 1', [class_name])
    if (studCheck.rowCount > 0) {
      return reply.code(400).send({ error: 'Kelas tidak dapat dihapus karena masih memiliki siswa terdaftar' })
    }

    const { error } = await supabase.from('classes').delete().eq('class_name', class_name)
    if (error) throw new Error(error.message)

    reply.send({ message: 'Kelas berhasil dihapus', class_name })
  })
}

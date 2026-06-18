import { pool, supabase } from '../db/pool.js'
import crypto from 'crypto'

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.createHmac('sha256', salt).update(password).digest('hex')
  return `${salt}:${hash}`
}

// Bersihkan nomor WA: hanya digit, ganti awalan 0 dengan 62
function cleanPhone(raw) {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  return digits.startsWith('0') ? '62' + digits.slice(1) : digits
}

export default async function usersRoutes(fastify) {

  // GET /api/users
  fastify.get('/', { preHandler: [fastify.authorizeAdmin] }, async (request, reply) => {
    const result = await pool.query(
      `SELECT id, username, nama_lengkap, role, target_class, no_wa, created_at
       FROM users ORDER BY role ASC, nama_lengkap ASC`
    )
    reply.send({ users: result.rows })
  })

  // POST /api/users
  fastify.post('/', {
    preHandler: [fastify.authorizeAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password', 'nama_lengkap', 'role'],
        properties: {
          username:     { type: 'string', minLength: 3, maxLength: 50 },
          password:     { type: 'string', minLength: 6 },
          nama_lengkap: { type: 'string', minLength: 2, maxLength: 100 },
          role:         { type: 'string', enum: ['ADMIN', 'WALAS'] },
          target_class: { type: 'string', maxLength: 15 },
          no_wa:        { type: 'string', maxLength: 20 },
        },
      },
    },
  }, async (request, reply) => {
    const { username, password, nama_lengkap, role, target_class, no_wa } = request.body

    if (role === 'WALAS' && !target_class) {
      return reply.code(400).send({ error: 'target_class wajib diisi untuk role WALAS' })
    }

    if (role === 'WALAS' && target_class) {
      const classCheck = await pool.query('SELECT 1 FROM classes WHERE class_name = $1', [target_class])
      if (classCheck.rowCount === 0) {
        return reply.code(400).send({ error: `Kelas '${target_class}' tidak terdaftar di database Master Kelas` })
      }
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        username,
        password_hash: hashPassword(password),
        nama_lengkap,
        role,
        target_class: target_class || null,
        no_wa: cleanPhone(no_wa),
      })
      .select('id, username, nama_lengkap, role, target_class, no_wa, created_at')
      .single()

    if (error) {
      if (error.code === '23505') return reply.code(409).send({ error: 'Username sudah digunakan' })
      throw new Error(error.message)
    }

    reply.code(201).send({ user: data })
  })

  // PUT /api/users/:id
  fastify.put('/:id', {
    preHandler: [fastify.authorizeAdmin],
    schema: {
      body: {
        type: 'object',
        properties: {
          nama_lengkap: { type: 'string', minLength: 2, maxLength: 100 },
          role:         { type: 'string', enum: ['ADMIN', 'WALAS'] },
          target_class: { type: 'string', maxLength: 15 },
          no_wa:        { type: 'string', maxLength: 20 },
          password:     { type: 'string', minLength: 6 },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params
    const { nama_lengkap, role, target_class, no_wa, password } = request.body

    if (role === 'WALAS' && target_class === '') {
      return reply.code(400).send({ error: 'target_class wajib diisi untuk role WALAS' })
    }

    if (role === 'WALAS' && target_class) {
      const classCheck = await pool.query('SELECT 1 FROM classes WHERE class_name = $1', [target_class])
      if (classCheck.rowCount === 0) {
        return reply.code(400).send({ error: `Kelas '${target_class}' tidak terdaftar di database Master Kelas` })
      }
    }

    if (String(request.user.id) === String(id) && role && role !== 'ADMIN') {
      return reply.code(400).send({ error: 'Tidak bisa mengubah role akun sendiri' })
    }

    const updates = {}
    if (nama_lengkap !== undefined)   updates.nama_lengkap = nama_lengkap
    if (role !== undefined)           updates.role = role
    if (target_class !== undefined)   updates.target_class = target_class || null
    if (no_wa !== undefined)          updates.no_wa = cleanPhone(no_wa)
    if (password)                     updates.password_hash = hashPassword(password)

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: 'Tidak ada data yang diubah' })
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, username, nama_lengkap, role, target_class, no_wa, created_at')
      .single()

    if (error || !data) return reply.code(404).send({ error: 'User tidak ditemukan' })

    reply.send({ user: data })
  })

  // DELETE /api/users/:id
  fastify.delete('/:id', { preHandler: [fastify.authorizeAdmin] }, async (request, reply) => {
    const { id } = request.params

    if (String(request.user.id) === String(id)) {
      return reply.code(400).send({ error: 'Tidak bisa menghapus akun sendiri' })
    }

    const { error } = await supabase.from('users').delete().eq('id', id)
    if (error) throw new Error(error.message)

    reply.send({ message: 'User dihapus', id: Number(id) })
  })

  // POST /api/users/:id/reset-password
  fastify.post('/:id/reset-password', {
    preHandler: [fastify.authorizeAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['password'],
        properties: { password: { type: 'string', minLength: 6 } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params
    const { password } = request.body

    const { data, error } = await supabase
      .from('users')
      .update({ password_hash: hashPassword(password) })
      .eq('id', id)
      .select('id, username, nama_lengkap')
      .single()

    if (error || !data) return reply.code(404).send({ error: 'User tidak ditemukan' })

    reply.send({ message: 'Password berhasil direset', user: data })
  })
}

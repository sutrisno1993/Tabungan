import { pool, supabase } from '../db/pool.js'
import crypto from 'crypto'

function hashPassword(password, salt) {
  return crypto.createHmac('sha256', salt).update(password).digest('hex')
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex')
}

export default async function authRoutes(fastify) {
  // POST /api/auth/login
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 50 },
          password: { type: 'string', minLength: 6 },
        },
      },
    },
  }, async (request, reply) => {
    const { username, password } = request.body

    const result = await pool.query(
      'SELECT id, username, password_hash, nama_lengkap, role, target_class FROM users WHERE username = $1',
      [username]
    )

    if (result.rowCount === 0) {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const user = result.rows[0]
    const [salt, storedHash] = user.password_hash.split(':')
    const inputHash = hashPassword(password, salt)

    if (inputHash !== storedHash) {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const token = fastify.jwt.sign({
      id: user.id,
      username: user.username,
      role: user.role,
      target_class: user.target_class,
      nama_lengkap: user.nama_lengkap,
    })

    reply
      .setCookie('token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 8,
      })
      .send({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          target_class: user.target_class,
          nama_lengkap: user.nama_lengkap,
        },
      })
  })

  // POST /api/auth/logout
  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' }).send({ message: 'Logged out successfully' })
  })

  // GET /api/auth/me
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    reply.send({ user: request.user })
  })

  // POST /api/auth/register (Admin only)
  fastify.post('/register', {
    preHandler: [fastify.authorizeAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password', 'nama_lengkap', 'role'],
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 50 },
          password: { type: 'string', minLength: 6 },
          nama_lengkap: { type: 'string', maxLength: 100 },
          role: { type: 'string', enum: ['ADMIN', 'WALAS'] },
          target_class: { type: 'string', maxLength: 15 },
        },
      },
    },
  }, async (request, reply) => {
    const { username, password, nama_lengkap, role, target_class } = request.body

    if (role === 'WALAS' && !target_class) {
      return reply.code(400).send({ error: 'target_class wajib diisi untuk role WALAS' })
    }

    const salt = generateSalt()
    const hash = hashPassword(password, salt)
    const password_hash = `${salt}:${hash}`

    const { data, error } = await supabase
      .from('users')
      .insert({ username, password_hash, nama_lengkap, role, target_class: target_class || null })
      .select('id, username, role, target_class')
      .single()

    if (error) {
      if (error.code === '23505') {
        return reply.code(409).send({ error: 'Username sudah digunakan' })
      }
      throw new Error(error.message)
    }

    reply.code(201).send({ user: data })
  })
}

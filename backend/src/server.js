import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import { Server as SocketServer } from 'socket.io'

import { pool } from './db/pool.js'
import { startCronJobs } from './jobs/cronJobs.js'
import { triggerLocalBackup } from './services/localBackupService.js'

// Routes
import authRoutes from './routes/auth.js'
import studentsRoutes from './routes/students.js'
import transactionsRoutes from './routes/transactions.js'
import agendasRoutes from './routes/agendas.js'
import excelRoutes from './routes/excel.js'
import dashboardRoutes from './routes/dashboard.js'
import usersRoutes from './routes/users.js'
import sheetsRoutes from './routes/sheets.js'
import classesRoutes from './routes/classes.js'

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  },
})

// ── Plugins ──────────────────────────────────────────────────────────────────
await fastify.register(cors, {
  origin: [process.env.FRONTEND_URL || 'http://localhost:5173'],
  credentials: true,
})

await fastify.register(cookie)

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET,
  cookie: { cookieName: 'token', signed: false },
})

await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max upload
  },
})

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
})

// ── Auth Decorator ────────────────────────────────────────────────────────────
fastify.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' })
  }
})

fastify.decorate('authorizeAdmin', async (request, reply) => {
  await fastify.authenticate(request, reply)
  if (request.user?.role !== 'ADMIN') {
    reply.code(403).send({ error: 'Forbidden', message: 'Admin access required' })
  }
})

// ── Routes ────────────────────────────────────────────────────────────────────
await fastify.register(authRoutes, { prefix: '/api/auth' })
await fastify.register(studentsRoutes, { prefix: '/api/students' })
await fastify.register(transactionsRoutes, { prefix: '/api/transactions' })
await fastify.register(agendasRoutes, { prefix: '/api/agendas' })
await fastify.register(excelRoutes, { prefix: '/api/excel' })
await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' })
await fastify.register(usersRoutes, { prefix: '/api/users' })
await fastify.register(sheetsRoutes, { prefix: '/api/sheets' })
await fastify.register(classesRoutes, { prefix: '/api/classes' })

// ── Health Check ──────────────────────────────────────────────────────────────
fastify.get('/api/health', async (request, reply) => {
  try {
    await pool.query('SELECT 1')
    return { status: 'ok', database: 'connected', timestamp: new Date().toISOString() }
  } catch (err) {
    fastify.log.error('Health check failed - database disconnected:', err)
    reply.code(500).send({ status: 'error', database: 'disconnected', error: err.message })
  }
})

// ── Socket.io Setup ───────────────────────────────────────────────────────────
// Attach Socket.io directly to Fastify's internal HTTP server
export const io = new SocketServer(fastify.server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})

io.on('connection', (socket) => {
  fastify.log.info(`Socket connected: ${socket.id}`)

  socket.on('join:class', (className) => {
    socket.join(`class:${className}`)
    fastify.log.info(`Socket ${socket.id} joined room class:${className}`)
  })

  socket.on('disconnect', () => {
    fastify.log.info(`Socket disconnected: ${socket.id}`)
  })
})

// ── Start ─────────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    // Test DB connection
    const client = await pool.connect()
    fastify.log.info('Database connection established')

    client.release()

    await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' })

    // Start cron jobs after server is up
    startCronJobs()
    fastify.log.info('Cron jobs started')
    
    // Trigger initial local backup on startup
    triggerLocalBackup()
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()

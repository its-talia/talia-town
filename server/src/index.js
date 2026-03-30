import Fastify from 'fastify'
import FastifyStatic from '@fastify/static'
import FastifyCookie from '@fastify/cookie'
import FastifySession from '@fastify/session'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import { authRoutes } from './routes/auth.js'
import { gameSocket } from './socket/gameSocket.js'
import { db } from './db/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const fastify = Fastify({ logger: true })

// Serve built client assets
fastify.register(FastifyStatic, {
  root: join(__dirname, '../../server/public'),
  prefix: '/',
})

// Session / cookie
fastify.register(FastifyCookie)
fastify.register(FastifySession, {
  secret: process.env.SESSION_SECRET || 'changeme-super-secret-32chars-min!!',
  cookie: { secure: process.env.NODE_ENV === 'production' },
})

// Discord OAuth
fastify.register(authRoutes)

// HTTP server + Socket.io
const httpServer = createServer(fastify.server)
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }
})

gameSocket(io)

// Init DB
await db.init()

const port = parseInt(process.env.PORT || '3001')
await fastify.listen({ port, host: '0.0.0.0' })
console.log(`Talia Town server running on port ${port}`)

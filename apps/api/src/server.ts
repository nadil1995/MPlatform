import { serve } from '@hono/node-server'
import { createApp } from './app'
import { loadConfig } from './config'
import { createTokenVerifier } from './lib/auth'
import { createDb } from './lib/db'
import { createLogger } from './lib/logger'

const config = loadConfig(process.env)
const log = createLogger(config.LOG_LEVEL)
const { db, close } = createDb(config.DATABASE_URL)
const app = createApp({ config, db, log, verifyToken: createTokenVerifier(config), now: () => new Date() })

const server = serve({ fetch: app.fetch, port: config.PORT, hostname: '0.0.0.0' }, (info) =>
  log.info({ port: info.port, authMode: config.AUTH_MODE }, 'api listening'),
)

/**
 * Graceful shutdown: stop accepting, let in-flight requests finish (max 25 s), close the
 * pool. ECS sends SIGTERM 30 s before SIGKILL.
 *
 * @param signal - The signal received.
 */
function shutdown(signal: string): void {
  log.info({ signal }, 'shutting down')
  const force = setTimeout(() => process.exit(1), 25_000)
  force.unref()
  server.close(() => {
    void close().finally(() => process.exit(0))
  })
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

import { and, inArray, lte } from 'drizzle-orm'
import { loadConfig } from './config'
import { enquiries, quotes } from './db/schema'
import { createDb, type Db } from './lib/db'
import { createLogger } from './lib/logger'

/**
 * Expire enquiries and quotes whose time has passed.
 *
 * Status changes follow the state machines (open/quoted → expired, sent → expired) and
 * are idempotent, so running twice or on two tasks is harmless.
 *
 * @param db - Database.
 * @param now - Current time.
 * @returns How many rows changed.
 */
export async function expireStale(db: Db, now: Date): Promise<{ enquiries: number; quotes: number }> {
  const e = await db
    .update(enquiries)
    .set({ status: 'expired' })
    .where(and(inArray(enquiries.status, ['open', 'quoted']), lte(enquiries.expiresAt, now)))
    .returning({ id: enquiries.id })
  const q = await db
    .update(quotes)
    .set({ status: 'expired' })
    .where(and(inArray(quotes.status, ['sent']), lte(quotes.expiresAt, now)))
    .returning({ id: quotes.id })
  return { enquiries: e.length, quotes: q.length }
}

/**
 * Worker entrypoint: scheduled jobs now; SQS consumers (matching, notifications, media)
 * arrive with P2-04, P2-05 and P1-05.
 *
 * @returns Never resolves while running.
 */
async function main(): Promise<void> {
  const config = loadConfig(process.env)
  const log = createLogger(config.LOG_LEVEL)
  const { db, close } = createDb(config.DATABASE_URL)
  let stopping = false
  process.on('SIGTERM', () => {
    stopping = true
    void close().finally(() => process.exit(0))
  })
  while (!stopping) {
    try {
      log.info(await expireStale(db, new Date()), 'expired stale enquiries and quotes')
    } catch (err) {
      log.error({ err: { message: err instanceof Error ? err.message : 'unknown' } }, 'expiry job failed')
    }
    await new Promise((r) => setTimeout(r, 15 * 60_000))
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main()

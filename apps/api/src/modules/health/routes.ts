import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppEnv } from '../../app-types'

/**
 * Liveness and readiness probes for the ALB and ECS.
 *
 * @returns Routes: `/healthz` (process up, no dependencies) and `/readyz` (DB reachable).
 *   Neither returns internal details.
 */
export function healthRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get('/healthz', (c) => c.json({ ok: true }))
    .get('/readyz', async (c) => {
      try {
        await c.get('deps').db.execute(sql`select 1`)
        return c.json({ ok: true })
      } catch {
        return c.json({ ok: false }, 503)
      }
    })
}

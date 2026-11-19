import { Hono } from 'hono'
import type { AppEnv } from '../../app-types'
import { actorOf, requireAuth } from '../../middleware/authenticate'
import { getDashboard } from './service'

/**
 * Musician dashboard route.
 *
 * @returns Routes: `GET /musician/dashboard` (auth: musician).
 */
export function dashboardRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>().get('/musician/dashboard', requireAuth('musician'), async (c) =>
    c.json(await getDashboard(c.get('deps'), actorOf(c))),
  )
}

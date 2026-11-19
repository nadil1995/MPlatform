import { Hono } from 'hono'
import { musicianSearchQuerySchema, songSearchQuerySchema } from '@thaala/shared'
import { z } from 'zod'
import type { AppEnv } from '../../app-types'
import { requireAuth } from '../../middleware/authenticate'
import { rateLimit } from '../../middleware/rate-limit'
import { parseOr404, query } from '../../middleware/validate'
import * as service from './service'

const slugSchema = z.string().regex(/^[a-z0-9-]{1,80}$/)

/**
 * Public discovery routes.
 *
 * @returns Routes: `GET /musicians` and `GET /musicians/:slug` (auth: public).
 *
 * @remarks
 * Security: rate-limited to slow down scraping (docs/SECURITY.md §6). Only live profiles
 * and public columns are returned.
 */
export function profileRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get('/musicians', requireAuth('public'), rateLimit(120, 60_000), async (c) => {
      const q = query(c, musicianSearchQuerySchema)
      return c.json(await service.searchMusicians(c.get('deps').db, q))
    })
    .get('/musicians/:slug', requireAuth('public'), rateLimit(120, 60_000), async (c) => {
      const slug = parseOr404(c.req.param('slug'), slugSchema)
      const { q } = query(c, songSearchQuerySchema)
      return c.json(await service.getProfile(c.get('deps').db, slug, q))
    })
}

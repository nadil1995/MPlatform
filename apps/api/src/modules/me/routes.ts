import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { Me } from '@thaala/shared'
import type { AppEnv } from '../../app-types'
import { musicianProfiles, users } from '../../db/schema'
import { actorOf, requireAuth } from '../../middleware/authenticate'
import { AppError } from '../../lib/errors'

/**
 * The signed-in user's own account.
 *
 * @returns Routes: `GET /me` (auth: user).
 */
export function meRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>().get('/me', requireAuth('user'), async (c) => {
    const actor = actorOf(c)
    const [row] = await c
      .get('deps')
      .db.select({
        id: users.id,
        displayName: users.displayName,
        roles: users.roles,
        locale: users.locale,
        musicianSlug: musicianProfiles.slug,
      })
      .from(users)
      .leftJoin(musicianProfiles, eq(musicianProfiles.ownerUserId, users.id))
      .where(eq(users.id, actor.userId))
      .limit(1)
    if (!row) throw new AppError('NOT_FOUND')
    const me: Me = { ...row, musicianSlug: row.musicianSlug ?? null }
    return c.json(me)
  })
}

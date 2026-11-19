import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { devSessionRequestSchema } from '@thaala/shared'
import type { AppEnv } from '../../app-types'
import { users } from '../../db/schema'
import { writeAudit } from '../../lib/audit'
import { ACCESS_TOKEN_TTL_SECONDS, signDevToken } from '../../lib/auth'
import { AppError } from '../../lib/errors'
import { clientIp, rateLimit } from '../../middleware/rate-limit'
import { requireAuth } from '../../middleware/authenticate'
import { jsonBody } from '../../middleware/validate'

/**
 * Development sign-in: list seeded users and issue a token for one of them.
 *
 * Stands in for phone OTP / Google / Apple until Cognito (P1-01). Mounted only when
 * AUTH_MODE=dev, and config refuses that mode in production.
 *
 * @returns Routes: `GET /users` and `POST /session` (auth: public, dev only).
 *
 * @remarks
 * Security: anyone who can reach this can act as any user, which is the point locally
 * and why it must never be deployed. Every token issued is audit-logged.
 */
export function devRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get('/users', requireAuth('public'), rateLimit(60, 60_000), async (c) => {
      const items = await c
        .get('deps')
        .db.select({ id: users.id, displayName: users.displayName, roles: users.roles })
        .from(users)
        .where(eq(users.status, 'active'))
        .orderBy(asc(users.displayName))
        .limit(50)
      return c.json({ items })
    })
    .post('/session', requireAuth('public'), rateLimit(30, 60_000), async (c) => {
      const { config, db } = c.get('deps')
      const { userId } = await jsonBody(c, devSessionRequestSchema)
      const [user] = await db
        .select({ id: users.id, sub: users.cognitoSub, status: users.status })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      if (!user || user.status !== 'active') throw new AppError('NOT_FOUND')
      // config guarantees the secret exists in dev mode; checked again for the type.
      if (!config.DEV_JWT_SECRET) throw new AppError('INTERNAL')
      const accessToken = await signDevToken(config.DEV_JWT_SECRET, user.sub)
      await writeAudit(db, config.AUDIT_IP_SALT, {
        actorUserId: user.id,
        action: 'dev.session.issued',
        entity: 'user',
        entityId: user.id,
        ip: clientIp(c.req.header('x-forwarded-for')),
      })
      return c.json({ accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS })
    })
}

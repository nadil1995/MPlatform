import { eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import type { Actor, AppEnv } from '../app-types'
import { musicianProfiles, users } from '../db/schema'
import { AppError } from '../lib/errors'

/**
 * Verify a bearer token if one is sent, and load the matching active user as the actor.
 *
 * Requests without a token continue as anonymous (`actor = null`); each route then
 * decides with {@link requireAuth}. A token that is present but invalid is rejected,
 * rather than silently treated as anonymous.
 *
 * @returns The middleware.
 * @throws {AppError} `UNAUTHENTICATED` for a bad token, or an unknown/suspended user.
 */
export const authenticate = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    const header = c.req.header('authorization')
    if (!header) {
      c.set('actor', null)
      return next()
    }
    const [scheme, token] = header.split(' ')
    if (scheme !== 'Bearer' || !token) throw new AppError('UNAUTHENTICATED')
    const { db, verifyToken } = c.get('deps')
    const { sub } = await verifyToken(token)
    const [row] = await db
      .select({ id: users.id, roles: users.roles, status: users.status, profileId: musicianProfiles.id })
      .from(users)
      .leftJoin(musicianProfiles, eq(musicianProfiles.ownerUserId, users.id))
      .where(eq(users.cognitoSub, sub))
      .limit(1)
    // Security: a deleted or suspended account loses access at once, even with a valid token.
    if (!row || row.status !== 'active') throw new AppError('UNAUTHENTICATED')
    const actor: Actor = { userId: row.id, roles: row.roles, profileId: row.profileId }
    c.set('actor', actor)
    await next()
  })

export type AuthLevel = 'public' | 'user' | 'musician' | 'admin'

/**
 * Route-level auth declaration. Every route must call this (deny by default).
 *
 * `user` means any signed-in user (everyone can book). `musician` also needs an owned
 * profile, since every musician action is scoped to it.
 *
 * @param level - Who may call the route.
 * @returns The middleware.
 * @throws {AppError} `UNAUTHENTICATED` without a user, `FORBIDDEN` without the role.
 */
export const requireAuth = (level: AuthLevel) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (level === 'public') return next()
    const actor = c.get('actor')
    if (!actor) throw new AppError('UNAUTHENTICATED')
    if (level === 'musician' && (!actor.roles.includes('musician') || !actor.profileId)) {
      throw new AppError('FORBIDDEN')
    }
    if (level === 'admin' && !actor.roles.includes('admin')) throw new AppError('FORBIDDEN')
    await next()
  })

/**
 * Read the actor inside a handler that is behind `requireAuth` (not `public`).
 *
 * @param c - Hono context.
 * @param c.get - Context getter.
 * @returns The actor.
 * @throws {AppError} `UNAUTHENTICATED` if called on an anonymous request (a wiring bug).
 */
export function actorOf(c: { get: (k: 'actor') => Actor | null }): Actor {
  const actor = c.get('actor')
  if (!actor) throw new AppError('UNAUTHENTICATED')
  return actor
}

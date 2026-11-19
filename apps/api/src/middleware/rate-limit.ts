import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../app-types'
import { hashIp } from '../lib/audit'
import { AppError } from '../lib/errors'
import { RateLimiter } from '../lib/rate-limit'

/**
 * Per-task rate limit keyed by user id when signed in, else by hashed client IP.
 *
 * @param limit - Requests per window.
 * @param windowMs - Window in milliseconds.
 * @returns The middleware.
 * @throws {AppError} `RATE_LIMITED` when over the limit.
 */
export const rateLimit = (limit: number, windowMs: number) => {
  const limiter = new RateLimiter(limit, windowMs)
  return createMiddleware<AppEnv>(async (c, next) => {
    const actor = c.get('actor')
    const key = actor ? `u:${actor.userId}` : `ip:${hashIp(clientIp(c.req.header('x-forwarded-for')), 'rl')}`
    if (!limiter.take(key)) throw new AppError('RATE_LIMITED')
    await next()
  })
}

/**
 * Pick the client IP from `X-Forwarded-For` as set by the ALB (left-most entry).
 *
 * @param xff - The header value.
 * @returns The IP, or "unknown".
 */
export function clientIp(xff: string | undefined): string {
  return xff?.split(',')[0]?.trim() || 'unknown'
}

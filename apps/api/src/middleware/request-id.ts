import { randomUUID } from 'node:crypto'
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../app-types'

const VALID_ID = /^[A-Za-z0-9-]{8,64}$/

/**
 * Give each request an id (reused from `x-request-id` if well-formed), echo it back,
 * and put it in every log line and error body so support can trace a report.
 *
 * @returns The middleware.
 */
export const requestId = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    const incoming = c.req.header('x-request-id')
    // Security: never trust an arbitrary header value into logs; accept only a safe shape.
    const id = incoming && VALID_ID.test(incoming) ? incoming : randomUUID()
    c.set('requestId', id)
    c.header('x-request-id', id)
    await next()
  })

import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import type { AppEnv, Deps } from './app-types'
import { AppError, ERROR_CODES } from './lib/errors'
import { authenticate } from './middleware/authenticate'
import { requestId } from './middleware/request-id'
import { devRoutes } from './modules/auth/dev-routes'
import { dashboardRoutes } from './modules/dashboard/routes'
import { enquiryRoutes } from './modules/enquiries/routes'
import { healthRoutes } from './modules/health/routes'
import { meRoutes } from './modules/me/routes'
import { profileRoutes } from './modules/profiles/routes'
import { quoteRoutes } from './modules/quotes/routes'

/**
 * Build the HTTP app with every middleware and module mounted.
 *
 * Middleware order follows docs/ARCHITECTURE.md: request id → security headers → CORS →
 * body limit → (rate limits per route) → token verification → route auth → validation →
 * handler → error mapper.
 *
 * @param deps - Config, database, logger, token verifier and clock.
 * @returns The Hono app (also used directly by integration tests via `app.request`).
 */
export function createApp(deps: Deps): Hono<AppEnv> {
  const app = new Hono<AppEnv>()

  app.use('*', async (c, next) => {
    c.set('deps', deps)
    await next()
  })
  app.use('*', requestId())
  app.use('*', secureHeaders())
  // Security: exact-origin allowlist; never `*` with credentials.
  app.use('*', cors({ origin: deps.config.CORS_ORIGINS, credentials: false, maxAge: 600 }))
  app.use(
    '*',
    bodyLimit({
      maxSize: 100 * 1024,
      onError: () => {
        throw new AppError('PAYLOAD_TOO_LARGE')
      },
    }),
  )
  app.use('*', async (c, next) => {
    const start = performance.now()
    await next()
    // Path only, never the query string (it can hold search terms).
    deps.log.info(
      {
        requestId: c.get('requestId'),
        method: c.req.method,
        path: c.req.routePath,
        status: c.res.status,
        ms: Math.round(performance.now() - start),
      },
      'request',
    )
  })

  app.route('/', healthRoutes())
  app.use('/v1/*', authenticate())
  app.route('/v1', meRoutes())
  app.route('/v1', profileRoutes())
  app.route('/v1', enquiryRoutes())
  app.route('/v1', quoteRoutes())
  app.route('/v1', dashboardRoutes())
  // Security: dev sign-in exists only when explicitly configured (never in production).
  if (deps.config.AUTH_MODE === 'dev') app.route('/v1/dev', devRoutes())

  app.notFound((c) =>
    c.json(
      { error: { code: 'NOT_FOUND', message: ERROR_CODES.NOT_FOUND.message, requestId: c.get('requestId') } },
      404,
    ),
  )

  app.onError((err, c) => {
    const reqId = c.get('requestId') ?? 'unknown'
    if (err instanceof AppError) {
      const def = ERROR_CODES[err.code]
      return c.json(
        {
          error: {
            code: err.code,
            message: def.message,
            requestId: reqId,
            ...(err.fields ? { fields: err.fields } : {}),
          },
        },
        def.status,
      )
    }
    if (err instanceof HTTPException && err.status < 500) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: ERROR_CODES.VALIDATION_FAILED.message,
            requestId: reqId,
          },
        },
        400,
      )
    }
    // Log once at the edge with the request id; never send internals to the client.
    deps.log.error(
      { requestId: reqId, err: { name: err.name, message: err.message, stack: err.stack } },
      'unhandled',
    )
    return c.json(
      { error: { code: 'INTERNAL', message: ERROR_CODES.INTERNAL.message, requestId: reqId } },
      500,
    )
  })

  return app
}

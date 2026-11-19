import { Hono } from 'hono'
import { createQuoteSchema, QUOTE_SORTS, uuidSchema } from '@thaala/shared'
import { z } from 'zod'
import type { AppEnv } from '../../app-types'
import { actorOf, requireAuth } from '../../middleware/authenticate'
import { clientIp, rateLimit } from '../../middleware/rate-limit'
import { jsonBody, parseOr404, query } from '../../middleware/validate'
import * as service from './service'

const sortQuery = z.object({ sort: z.enum(QUOTE_SORTS).catch('bestMatch') })

/**
 * Quote routes for clients (compare, checkout, accept) and musicians (send, decline).
 *
 * @returns Routes:
 *   `GET /enquiries/:id/quotes` (user, owner),
 *   `POST /enquiries/:id/quotes` (musician, matched),
 *   `POST /enquiries/:id/decline` (musician, matched),
 *   `GET /quotes/:id/checkout` (user, owner),
 *   `POST /quotes/:id/accept` (user, owner).
 */
export function quoteRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get('/enquiries/:id/quotes', requireAuth('user'), async (c) => {
      const id = parseOr404(c.req.param('id'), uuidSchema)
      const { sort } = query(c, sortQuery)
      return c.json(await service.getQuotesForEnquiry(c.get('deps'), actorOf(c), id, sort))
    })
    .post('/enquiries/:id/quotes', requireAuth('musician'), rateLimit(30, 60_000), async (c) => {
      const id = parseOr404(c.req.param('id'), uuidSchema)
      const input = await jsonBody(c, createQuoteSchema)
      return c.json(await service.createQuote(c.get('deps'), actorOf(c), id, input), 201)
    })
    .post('/enquiries/:id/decline', requireAuth('musician'), async (c) => {
      const id = parseOr404(c.req.param('id'), uuidSchema)
      await service.declineEnquiry(c.get('deps'), actorOf(c), id)
      return c.body(null, 204)
    })
    .get('/quotes/:id/checkout', requireAuth('user'), async (c) => {
      const id = parseOr404(c.req.param('id'), uuidSchema)
      return c.json(await service.getCheckout(c.get('deps'), actorOf(c), id))
    })
    .post('/quotes/:id/accept', requireAuth('user'), rateLimit(10, 60_000), async (c) => {
      const id = parseOr404(c.req.param('id'), uuidSchema)
      const result = await service.acceptQuote(
        c.get('deps'),
        actorOf(c),
        id,
        clientIp(c.req.header('x-forwarded-for')),
      )
      return c.json(result, 201)
    })
}

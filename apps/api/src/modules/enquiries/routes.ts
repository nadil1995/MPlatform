import { Hono } from 'hono'
import { enquiryDraftSchema } from '@thaala/shared'
import type { AppEnv } from '../../app-types'
import { actorOf, requireAuth } from '../../middleware/authenticate'
import { rateLimit } from '../../middleware/rate-limit'
import { jsonBody } from '../../middleware/validate'
import * as service from './service'

/**
 * Client enquiry routes.
 *
 * @returns Routes: `POST /enquiries` and `GET /enquiries` (auth: user).
 */
export function enquiryRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .post('/enquiries', requireAuth('user'), rateLimit(10, 60_000), async (c) => {
      const input = await jsonBody(c, enquiryDraftSchema)
      return c.json(await service.createEnquiry(c.get('deps'), actorOf(c), input), 201)
    })
    .get('/enquiries', requireAuth('user'), async (c) => {
      return c.json({ items: await service.listMyEnquiries(c.get('deps'), actorOf(c)) })
    })
}

import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { auditLog, bookings, enquiryMatches, quotes, users } from '../db/schema'
import { signDevToken } from '../lib/auth'
import {
  call,
  enquiryBody,
  makeMusician,
  makeTestApp,
  makeUser,
  quoteBody,
  resetDb,
  TEST_SECRET,
} from './helpers'

const NOW = new Date('2026-11-19T06:00:00Z')
const { app, db, close } = makeTestApp(() => NOW)

beforeEach(() => resetDb(db))
afterAll(() => close())

/** Post an enquiry as a client and return its id. */
async function postEnquiry(auth: string, overrides: Record<string, unknown> = {}) {
  const res = await call(app, 'POST', '/v1/enquiries', { auth, body: enquiryBody(NOW, overrides) })
  expect(res.status).toBe(201)
  return (await res.json()) as { id: string; matchedCount: number }
}

describe('health', () => {
  it('reports liveness and readiness without details', async () => {
    expect(await (await call(app, 'GET', '/healthz')).json()).toEqual({ ok: true })
    expect(await (await call(app, 'GET', '/readyz')).json()).toEqual({ ok: true })
  })
})

describe('authentication', () => {
  it('rejects protected routes without a token', async () => {
    const res = await call(app, 'GET', '/v1/me')
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: { code: string; requestId: string } }
    expect(body.error.code).toBe('UNAUTHENTICATED')
    expect(body.error.requestId).toBeTruthy()
  })

  it('rejects a forged token', async () => {
    const forged = await signDevToken('a-completely-different-secret-value!!', 'x')
    expect((await call(app, 'GET', '/v1/me', { auth: `Bearer ${forged}` })).status).toBe(401)
  })

  it('rejects a valid token for an unknown user', async () => {
    const token = await signDevToken(TEST_SECRET, 'nobody')
    expect((await call(app, 'GET', '/v1/me', { auth: `Bearer ${token}` })).status).toBe(401)
  })

  it('locks out a suspended account immediately', async () => {
    const u = await makeUser(db)
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, u.id))
    expect((await call(app, 'GET', '/v1/me', { auth: u.auth })).status).toBe(401)
  })

  it('returns the signed-in user', async () => {
    const u = await makeUser(db, 'Dilani Perera')
    const me = (await (await call(app, 'GET', '/v1/me', { auth: u.auth })).json()) as { displayName: string }
    expect(me.displayName).toBe('Dilani Perera')
  })
})

describe('dev sign-in', () => {
  it('lists users and issues a working token', async () => {
    const u = await makeUser(db, 'Ravi Kumar')
    const list = (await (await call(app, 'GET', '/v1/dev/users')).json()) as { items: { id: string }[] }
    expect(list.items.map((x) => x.id)).toContain(u.id)
    const res = await call(app, 'POST', '/v1/dev/session', { body: { userId: u.id } })
    const { accessToken } = (await res.json()) as { accessToken: string }
    expect((await call(app, 'GET', '/v1/me', { auth: `Bearer ${accessToken}` })).status).toBe(200)
    expect(await db.$count(auditLog)).toBe(1)
  })

  it('returns 404 for an unknown user', async () => {
    const res = await call(app, 'POST', '/v1/dev/session', {
      body: { userId: '00000000-0000-4000-8000-000000000000' },
    })
    expect(res.status).toBe(404)
  })
})

describe('GET /v1/musicians', () => {
  it('returns only live profiles', async () => {
    await makeMusician(db)
    await makeMusician(db, { status: 'draft' })
    const body = (await (await call(app, 'GET', '/v1/musicians')).json()) as { total: number }
    expect(body.total).toBe(1)
  })

  it('filters by category and district', async () => {
    await makeMusician(db, { type: 'djMc', districts: ['gampaha'] })
    await makeMusician(db, { type: 'weddingBand', districts: ['colombo'] })
    const djs = (await (await call(app, 'GET', '/v1/musicians?type=djs')).json()) as {
      items: { type: string }[]
    }
    expect(djs.items.map((m) => m.type)).toEqual(['djMc'])
    const gampaha = (await (await call(app, 'GET', '/v1/musicians?district=gampaha')).json()) as {
      total: number
    }
    expect(gampaha.total).toBe(1)
  })

  it('treats LIKE wildcards in the name search literally', async () => {
    await makeMusician(db)
    const body = (await (await call(app, 'GET', '/v1/musicians?q=%25')).json()) as { total: number }
    expect(body.total).toBe(0)
  })

  it('caps the page size', async () => {
    const body = (await (await call(app, 'GET', '/v1/musicians?pageSize=500')).json()) as { page: number }
    expect(body.page).toBe(1)
  })
})

describe('GET /v1/musicians/:slug', () => {
  it('returns a live profile with packages and songs', async () => {
    const m = await makeMusician(db)
    const body = (await (await call(app, 'GET', `/v1/musicians/${m.slug}`)).json()) as {
      packages: unknown[]
      songs: unknown[]
    }
    expect(body.packages).toHaveLength(1)
    expect(body.songs).toHaveLength(2)
  })

  it('filters songs by search text', async () => {
    const m = await makeMusician(db)
    const body = (await (await call(app, 'GET', `/v1/musicians/${m.slug}?q=baila`)).json()) as {
      songs: { title: string }[]
    }
    expect(body.songs.map((s) => s.title)).toEqual(['Baila medley'])
  })

  it('hides profiles that are not live', async () => {
    const m = await makeMusician(db, { status: 'draft' })
    expect((await call(app, 'GET', `/v1/musicians/${m.slug}`)).status).toBe(404)
  })

  it('404s on malformed slugs', async () => {
    expect((await call(app, 'GET', '/v1/musicians/..%2F..%2Fetc')).status).toBe(404)
  })
})

describe('POST /v1/enquiries', () => {
  it('creates an enquiry and matches eligible musicians', async () => {
    const client = await makeUser(db)
    await makeMusician(db) // wedding band in Colombo, LKR 80k
    await makeMusician(db, { type: 'djMc' }) // wrong style
    await makeMusician(db, { districts: ['jaffna'] }) // wrong district
    await makeMusician(db, { priceFromCents: 50_000_000 }) // over budget
    const { matchedCount } = await postEnquiry(client.auth)
    expect(matchedCount).toBe(1)
  })

  it('returns translated field keys on validation failure', async () => {
    const client = await makeUser(db)
    const res = await call(app, 'POST', '/v1/enquiries', {
      auth: client.auth,
      body: enquiryBody(NOW, { musicStyles: [] }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { fields: Record<string, string> } }
    expect(body.error.fields.musicStyles).toBe('styleRequired')
  })

  it('rejects events in the past using the server clock', async () => {
    const client = await makeUser(db)
    const res = await call(app, 'POST', '/v1/enquiries', {
      auth: client.auth,
      body: enquiryBody(NOW, { eventDate: '2026-11-18' }),
    })
    const body = (await res.json()) as { error: { fields: Record<string, string> } }
    expect(body.error.fields.eventDate).toBe('dateInPast')
  })

  it('requires sign-in', async () => {
    expect((await call(app, 'POST', '/v1/enquiries', { body: enquiryBody(NOW) })).status).toBe(401)
  })

  it('limits each user to 5 enquiries a day', async () => {
    const client = await makeUser(db)
    for (let i = 0; i < 5; i++) await postEnquiry(client.auth)
    const res = await call(app, 'POST', '/v1/enquiries', { auth: client.auth, body: enquiryBody(NOW) })
    expect(res.status).toBe(429)
  })

  it('never matches a musician to their own enquiry', async () => {
    const m = await makeMusician(db)
    const { matchedCount } = await postEnquiry(m.auth)
    expect(matchedCount).toBe(0)
  })

  it('lists only the caller’s enquiries', async () => {
    const a = await makeUser(db)
    const b = await makeUser(db)
    await postEnquiry(a.auth)
    const list = (await (await call(app, 'GET', '/v1/enquiries', { auth: b.auth })).json()) as {
      items: unknown[]
    }
    expect(list.items).toEqual([])
    const own = (await (await call(app, 'GET', '/v1/enquiries', { auth: a.auth })).json()) as {
      items: { quoteCount: number; matchedCount: number }[]
    }
    expect(own.items).toHaveLength(1)
    expect(own.items[0]).toMatchObject({ quoteCount: 0, matchedCount: 0 })
  })
})

describe('quotes and booking', () => {
  /** A client with an enquiry that one musician was matched to. */
  async function scenario() {
    const client = await makeUser(db, 'Dilani Perera')
    const musician = await makeMusician(db)
    const { id: enquiryId } = await postEnquiry(client.auth)
    return { client, musician, enquiryId }
  }

  it('lets a matched musician quote once', async () => {
    const { musician, enquiryId } = await scenario()
    const first = await call(app, 'POST', `/v1/enquiries/${enquiryId}/quotes`, {
      auth: musician.auth,
      body: quoteBody,
    })
    expect(first.status).toBe(201)
    const again = await call(app, 'POST', `/v1/enquiries/${enquiryId}/quotes`, {
      auth: musician.auth,
      body: quoteBody,
    })
    expect(again.status).toBe(409)
  })

  it('returns 404 to musicians who were not matched', async () => {
    const { enquiryId } = await scenario()
    const outsider = await makeMusician(db, { districts: ['jaffna'] })
    const res = await call(app, 'POST', `/v1/enquiries/${enquiryId}/quotes`, {
      auth: outsider.auth,
      body: quoteBody,
    })
    expect(res.status).toBe(404)
  })

  it('forbids quoting without a musician profile', async () => {
    const { client, enquiryId } = await scenario()
    const res = await call(app, 'POST', `/v1/enquiries/${enquiryId}/quotes`, {
      auth: client.auth,
      body: quoteBody,
    })
    expect(res.status).toBe(403)
  })

  it('rejects unknown quote fields such as a deposit', async () => {
    const { musician, enquiryId } = await scenario()
    const res = await call(app, 'POST', `/v1/enquiries/${enquiryId}/quotes`, {
      auth: musician.auth,
      body: { ...quoteBody, depositCents: 1 },
    })
    expect(res.status).toBe(400)
  })

  it('shows quotes to the owner and 404s for anyone else (IDOR)', async () => {
    const { client, musician, enquiryId } = await scenario()
    await call(app, 'POST', `/v1/enquiries/${enquiryId}/quotes`, { auth: musician.auth, body: quoteBody })
    const own = (await (
      await call(app, 'GET', `/v1/enquiries/${enquiryId}/quotes`, { auth: client.auth })
    ).json()) as {
      enquiry: { status: string }
      quotes: unknown[]
    }
    expect(own.quotes).toHaveLength(1)
    expect(own.enquiry.status).toBe('quoted')
    const list = (await (await call(app, 'GET', '/v1/enquiries', { auth: client.auth })).json()) as {
      items: { quoteCount: number; matchedCount: number }[]
    }
    expect(list.items[0]).toMatchObject({ quoteCount: 1, matchedCount: 1 })

    const stranger = await makeUser(db)
    expect(
      (await call(app, 'GET', `/v1/enquiries/${enquiryId}/quotes`, { auth: stranger.auth })).status,
    ).toBe(404)
    expect((await call(app, 'GET', `/v1/enquiries/not-a-uuid/quotes`, { auth: client.auth })).status).toBe(
      404,
    )
  })

  it('computes the 30% deposit on the server at checkout', async () => {
    const { client, musician, enquiryId } = await scenario()
    const q = (await (
      await call(app, 'POST', `/v1/enquiries/${enquiryId}/quotes`, { auth: musician.auth, body: quoteBody })
    ).json()) as { id: string }
    const summary = (await (
      await call(app, 'GET', `/v1/quotes/${q.id}/checkout`, { auth: client.auth })
    ).json()) as {
      totalCents: number
      depositCents: number
      balanceCents: number
    }
    expect(summary).toMatchObject({
      totalCents: 12_000_000,
      depositCents: 3_600_000,
      balanceCents: 8_400_000,
    })

    const stranger = await makeUser(db)
    expect((await call(app, 'GET', `/v1/quotes/${q.id}/checkout`, { auth: stranger.auth })).status).toBe(404)
  })

  it('accepting creates one booking, declines other quotes, and is audited', async () => {
    const { client, musician, enquiryId } = await scenario()
    const rival = await makeMusician(db)
    await db
      .insert(enquiryMatches)
      .values({ enquiryId, profileId: rival.profileId, score: 50 })
      .onConflictDoNothing()
    const q1 = (await (
      await call(app, 'POST', `/v1/enquiries/${enquiryId}/quotes`, { auth: musician.auth, body: quoteBody })
    ).json()) as { id: string }
    const q2 = (await (
      await call(app, 'POST', `/v1/enquiries/${enquiryId}/quotes`, { auth: rival.auth, body: quoteBody })
    ).json()) as { id: string }

    const res = await call(app, 'POST', `/v1/quotes/${q1.id}/accept`, { auth: client.auth })
    expect(res.status).toBe(201)
    expect(((await res.json()) as { depositCents: number }).depositCents).toBe(3_600_000)
    const [other] = await db.select().from(quotes).where(eq(quotes.id, q2.id))
    expect(other?.status).toBe('declined')
    expect(await db.$count(auditLog, eq(auditLog.action, 'booking.created'))).toBe(1)

    // Accepting again (or the declined one) is refused.
    expect((await call(app, 'POST', `/v1/quotes/${q1.id}/accept`, { auth: client.auth })).status).toBe(409)
    expect((await call(app, 'POST', `/v1/quotes/${q2.id}/accept`, { auth: client.auth })).status).toBe(409)
  })

  it('never double-books under concurrent accepts', async () => {
    const { client, musician, enquiryId } = await scenario()
    const q = (await (
      await call(app, 'POST', `/v1/enquiries/${enquiryId}/quotes`, { auth: musician.auth, body: quoteBody })
    ).json()) as { id: string }
    const results = await Promise.all(
      Array.from({ length: 5 }, () => call(app, 'POST', `/v1/quotes/${q.id}/accept`, { auth: client.auth })),
    )
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409])
    expect(await db.$count(bookings)).toBe(1)
  })

  it('does not let another client accept', async () => {
    const { musician, enquiryId } = await scenario()
    const q = (await (
      await call(app, 'POST', `/v1/enquiries/${enquiryId}/quotes`, { auth: musician.auth, body: quoteBody })
    ).json()) as { id: string }
    const stranger = await makeUser(db)
    expect((await call(app, 'POST', `/v1/quotes/${q.id}/accept`, { auth: stranger.auth })).status).toBe(404)
    expect(await db.$count(bookings)).toBe(0)
  })
})

describe('GET /v1/musician/dashboard', () => {
  it('forbids users without a musician profile', async () => {
    const u = await makeUser(db)
    expect((await call(app, 'GET', '/v1/musician/dashboard', { auth: u.auth })).status).toBe(403)
  })

  it('lists new matched enquiries until the musician quotes or declines', async () => {
    const client = await makeUser(db)
    const musician = await makeMusician(db)
    const { id: e1 } = await postEnquiry(client.auth)
    const { id: e2 } = await postEnquiry(client.auth, { occasion: 'birthday' })

    type Dash = { newEnquiries: { enquiryId: string }[]; quotesWaiting: number }
    const get = async () =>
      (await (await call(app, 'GET', '/v1/musician/dashboard', { auth: musician.auth })).json()) as Dash
    expect((await get()).newEnquiries).toHaveLength(2)

    await call(app, 'POST', `/v1/enquiries/${e1}/quotes`, { auth: musician.auth, body: quoteBody })
    // Quoting on one enquiry must not hide the others.
    expect((await get()).newEnquiries.map((e) => e.enquiryId)).toEqual([e2])
    expect((await call(app, 'POST', `/v1/enquiries/${e2}/decline`, { auth: musician.auth })).status).toBe(204)
    const after = await get()
    expect(after.newEnquiries).toEqual([])
    expect(after.quotesWaiting).toBe(1)
  })

  it('never exposes the client or their notes to musicians', async () => {
    const client = await makeUser(db, 'Secret Name')
    const musician = await makeMusician(db)
    await postEnquiry(client.auth, { notes: 'call me on 0771234567', venue: 'Secret Venue' })
    const text = await (await call(app, 'GET', '/v1/musician/dashboard', { auth: musician.auth })).text()
    for (const leak of ['Secret Name', '0771234567', 'Secret Venue']) expect(text).not.toContain(leak)
  })
})

describe('errors', () => {
  it('uses the standard error shape for unknown routes', async () => {
    const body = (await (await call(app, 'GET', '/v1/nope')).json()) as { error: { code: string } }
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('rejects malformed JSON with 400', async () => {
    const u = await makeUser(db)
    const res = await app.request('/v1/enquiries', {
      method: 'POST',
      headers: { authorization: u.auth, 'content-type': 'application/json' },
      body: '{not json',
    })
    expect(res.status).toBe(400)
  })

  it('sets security headers', async () => {
    const res = await call(app, 'GET', '/healthz')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-request-id')).toBeTruthy()
  })
})

import { sql } from 'drizzle-orm'
import { pino } from 'pino'
import type { MusicianType } from '@thaala/shared'
import { createApp } from '../app'
import type { Deps } from '../app-types'
import { loadConfig } from '../config'
import * as schema from '../db/schema'
import { createTokenVerifier, signDevToken } from '../lib/auth'
import { createDb, type Db } from '../lib/db'
import { TEST_DATABASE_URL } from './global-setup'

export const TEST_SECRET = 'test-only-dev-jwt-secret-0123456789abcdef'

/**
 * Build a test app against the test database.
 *
 * @param now - Fixed clock for the run.
 * @returns The app, its deps, and a cleanup function.
 */
export function makeTestApp(now = () => new Date()) {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    DEV_JWT_SECRET: TEST_SECRET,
    AUDIT_IP_SALT: 'test-only-audit-salt',
    LOG_LEVEL: 'silent',
  })
  const { db, close } = createDb(TEST_DATABASE_URL)
  const deps: Deps = {
    config,
    db,
    log: pino({ level: process.env.TEST_LOG_LEVEL ?? 'silent' }),
    verifyToken: createTokenVerifier(config),
    now,
  }
  return { app: createApp(deps), deps, db, close }
}

/**
 * Empty every table between tests.
 *
 * @param db - Test database.
 * @returns Resolves when done.
 */
export async function resetDb(db: Db): Promise<void> {
  await db.execute(sql`TRUNCATE audit_log, reviews, bookings, quotes, enquiry_matches, enquiries,
    repertoire_songs, services, musician_profiles, users RESTART IDENTITY CASCADE`)
}

let seq = 0

/**
 * Create a user and a bearer token for them.
 *
 * @param db - Test database.
 * @param name - Display name.
 * @returns The user id and an Authorization header value.
 */
export async function makeUser(db: Db, name = 'Test Client') {
  seq += 1
  const sub = `test-sub-${seq}-${Date.now()}`
  const [u] = await db.insert(schema.users).values({ cognitoSub: sub, displayName: name }).returning()
  if (!u) throw new Error('user insert failed')
  return { id: u.id, auth: `Bearer ${await signDevToken(TEST_SECRET, sub)}` }
}

/**
 * Create a live musician with one package and some songs.
 *
 * @param db - Test database.
 * @param opts - Overrides.
 * @param opts.type - Profile type.
 * @param opts.districts - Districts served.
 * @param opts.priceFromCents - Starting price.
 * @param opts.status - Profile status.
 * @returns User id, profile id, slug and an Authorization header value.
 */
export async function makeMusician(
  db: Db,
  opts: {
    type?: MusicianType
    districts?: schema.MusicianDistrict[]
    priceFromCents?: number
    status?: 'live' | 'draft'
  } = {},
) {
  const user = await makeUser(db, 'Band Owner')
  await db
    .update(schema.users)
    .set({ roles: ['client', 'musician'] })
    .where(sql`id = ${user.id}`)
  seq += 1
  const slug = `band-${seq}`
  const [p] = await db
    .insert(schema.musicianProfiles)
    .values({
      ownerUserId: user.id,
      stageName: `Band ${seq}`,
      slug,
      bio: 'A band.',
      type: opts.type ?? 'weddingBand',
      membersCount: 5,
      districts: opts.districts ?? ['colombo'],
      languages: ['si', 'en'],
      verifiedAt: new Date(),
      ratingAvg: 4.5,
      ratingCount: 10,
      priceFromCents: opts.priceFromCents ?? 8_000_000,
      status: opts.status ?? 'live',
    })
    .returning()
  if (!p) throw new Error('profile insert failed')
  await db.insert(schema.services).values({
    profileId: p.id,
    name: 'Reception',
    description: '4 hours',
    durationMin: 240,
    members: 5,
    priceFromCents: opts.priceFromCents ?? 8_000_000,
  })
  await db.insert(schema.repertoireSongs).values([
    { profileId: p.id, title: 'Baila medley', language: 'si' },
    { profileId: p.id, title: 'First dance ballads', language: 'en' },
  ])
  return { ...user, userId: user.id, profileId: p.id, slug }
}

/**
 * A valid enquiry body about 60 days after the given clock.
 *
 * @param now - Test clock.
 * @param overrides - Fields to replace.
 * @returns The request body.
 */
export function enquiryBody(now: Date, overrides: Record<string, unknown> = {}) {
  const d = new Date(now.getTime() + 60 * 86_400_000).toISOString().slice(0, 10)
  return {
    occasion: 'wedding',
    eventDate: d,
    startTime: '19:00',
    district: 'colombo',
    guests: '150to250',
    musicStyles: ['liveBand'],
    songLanguages: ['si', 'en'],
    venueHasSound: 'no',
    budget: '50kTo150k',
    ...overrides,
  }
}

/** A valid quote body. */
export const quoteBody = {
  priceCents: 12_000_000,
  durationMinutes: 240,
  members: 5,
  includesSound: true,
  includesLights: true,
  mustPlayKnown: 4,
  message: 'Happy to play.',
}

/**
 * JSON request helper.
 *
 * @param app - Test app.
 * @param method - HTTP method.
 * @param path - Path.
 * @param opts - Body and auth header.
 * @param opts.body - JSON body.
 * @param opts.auth - Authorization header value.
 * @returns The response.
 */
export function call(
  app: ReturnType<typeof makeTestApp>['app'],
  method: string,
  path: string,
  opts: { body?: unknown; auth?: string } = {},
) {
  return app.request(path, {
    method,
    headers: {
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(opts.auth ? { authorization: opts.auth } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  })
}

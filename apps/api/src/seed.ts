/**
 * Local development seed (BUILD_PLAN P0-02): 20 musicians, 5 clients and 1 admin, all
 * synthetic, plus enquiries, quotes, bookings and reviews so every screen has data.
 *
 * Usage: pnpm --filter @thaala/api db:seed [--reset]
 * Needs MIGRATE_DATABASE_URL (the schema owner, so `--reset` can truncate).
 *
 * Live flows (posting an enquiry, matching, quoting, accepting) go through the real
 * services, so the seed exercises the same rules as the app. Only history that the app
 * can't create yet (past events, payment confirmation, reviews) is inserted directly.
 *
 * Security: refuses to run when NODE_ENV=production. Names are invented; no real people.
 */
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import pino from 'pino'
import postgres from 'postgres'
import { calculateDepositCents, type District, type MusicianType } from '@thaala/shared'
import type { Actor } from './app-types'
import * as schema from './db/schema'
import {
  bookings,
  enquiries,
  enquiryMatches,
  musicianProfiles,
  quotes,
  repertoireSongs,
  reviews,
  services,
  users,
} from './db/schema'
import type { Db } from './lib/db'
import { createEnquiry } from './modules/enquiries/service'
import { acceptQuote, createQuote } from './modules/quotes/service'
import { refreshAvgReply } from './modules/quotes/repository'

type SongLang = 'si' | 'en' | 'ta' | 'instrumental'

/**
 * Small deterministic PRNG (mulberry32) so every seed run produces the same data.
 *
 * @param seed - Any 32-bit integer.
 * @returns A function returning floats in [0, 1).
 */
function prng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = prng(20270213)

/**
 * Pick one item at random.
 *
 * @param xs - Non-empty list.
 * @returns One element.
 * @throws {Error} When the list is empty (a bug in the seed data).
 */
function pick<T>(xs: readonly T[]): T {
  const x = xs[Math.floor(rand() * xs.length)]
  if (x === undefined) throw new Error('pick from empty list')
  return x
}

/**
 * Whole number in [min, max].
 *
 * @param min - Lower bound.
 * @param max - Upper bound.
 * @returns The number.
 */
function int(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1))
}

/**
 * Turn a name into a URL slug.
 *
 * @param s - Name.
 * @returns Lower-case, hyphenated slug.
 */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Days from now as a Colombo calendar date (YYYY-MM-DD).
 *
 * @param days - Offset from today (negative for the past).
 * @returns The date string.
 */
function dateIn(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000 + 5.5 * 3_600_000)
  return d.toISOString().slice(0, 10)
}

const CLIENTS = ['Dilani Perera', 'Ravi Kumar', 'Shenali Fernando', 'Arjun Rajapaksa', 'Fathima Rizwan']

const MUSICIANS: {
  name: string
  type: MusicianType
  home: District
  travels: District[]
  langs: SongLang[]
  members: number
  from: number
}[] = [
  {
    name: 'Rhythm Junction',
    type: 'weddingBand',
    home: 'colombo',
    travels: ['gampaha', 'kalutara'],
    langs: ['si', 'en', 'ta'],
    members: 6,
    from: 85_000,
  },
  {
    name: 'Colombo Groove Co.',
    type: 'weddingBand',
    home: 'colombo',
    travels: ['gampaha'],
    langs: ['en', 'si'],
    members: 7,
    from: 120_000,
  },
  {
    name: 'Seashore Beats',
    type: 'bailaBand',
    home: 'galle',
    travels: ['matara', 'colombo'],
    langs: ['si'],
    members: 5,
    from: 70_000,
  },
  {
    name: 'Lotus Lane Band',
    type: 'weddingBand',
    home: 'kandy',
    travels: ['colombo', 'matale'],
    langs: ['si', 'en'],
    members: 6,
    from: 95_000,
  },
  {
    name: 'Baila Bros',
    type: 'bailaBand',
    home: 'gampaha',
    travels: ['colombo', 'kurunegala'],
    langs: ['si'],
    members: 5,
    from: 60_000,
  },
  {
    name: 'DJ Kalana',
    type: 'djMc',
    home: 'gampaha',
    travels: ['colombo'],
    langs: ['si', 'en'],
    members: 1,
    from: 35_000,
  },
  {
    name: 'DJ Nila',
    type: 'djMc',
    home: 'colombo',
    travels: ['kalutara', 'gampaha'],
    langs: ['en', 'ta'],
    members: 1,
    from: 40_000,
  },
  {
    name: 'DJ Rukshan',
    type: 'djMc',
    home: 'kandy',
    travels: ['matale', 'kegalle'],
    langs: ['si'],
    members: 1,
    from: 30_000,
  },
  {
    name: 'Anjali Chandran',
    type: 'soloSinger',
    home: 'jaffna',
    travels: ['colombo', 'vavuniya'],
    langs: ['ta', 'en'],
    members: 1,
    from: 25_000,
  },
  {
    name: 'Kasun Wijesinghe',
    type: 'soloSinger',
    home: 'colombo',
    travels: ['gampaha', 'kalutara'],
    langs: ['si', 'en'],
    members: 1,
    from: 30_000,
  },
  {
    name: 'Meera Sivakumar',
    type: 'soloSinger',
    home: 'trincomalee',
    travels: ['batticaloa', 'colombo'],
    langs: ['ta'],
    members: 1,
    from: 28_000,
  },
  {
    name: 'Gamini Drummers',
    type: 'traditionalDrummers',
    home: 'kandy',
    travels: ['colombo', 'kegalle'],
    langs: ['si'],
    members: 8,
    from: 30_000,
  },
  {
    name: 'Ruhunu Magul Bera',
    type: 'traditionalDrummers',
    home: 'matara',
    travels: ['galle', 'hambantota', 'colombo'],
    langs: ['si'],
    members: 6,
    from: 35_000,
  },
  {
    name: 'Nadee String Quartet',
    type: 'stringEnsemble',
    home: 'kandy',
    travels: ['colombo', 'matale'],
    langs: ['en', 'instrumental'],
    members: 4,
    from: 45_000,
  },
  {
    name: 'Serendib Strings',
    type: 'stringEnsemble',
    home: 'colombo',
    travels: ['gampaha', 'kalutara'],
    langs: ['en', 'instrumental'],
    members: 3,
    from: 50_000,
  },
  {
    name: 'Voices of Lanka',
    type: 'choir',
    home: 'colombo',
    travels: ['gampaha'],
    langs: ['si', 'en', 'ta'],
    members: 18,
    from: 55_000,
  },
  {
    name: 'St. Cecilia Singers',
    type: 'choir',
    home: 'gampaha',
    travels: ['colombo'],
    langs: ['en'],
    members: 14,
    from: 40_000,
  },
  {
    name: 'Pradeep Music Classes',
    type: 'musicTeacher',
    home: 'colombo',
    travels: ['gampaha'],
    langs: ['si', 'en'],
    members: 1,
    from: 6_000,
  },
  {
    name: 'Harmony Keys Studio',
    type: 'musicTeacher',
    home: 'kandy',
    travels: ['matale'],
    langs: ['si', 'en', 'ta'],
    members: 1,
    from: 5_000,
  },
  {
    name: 'Island Echo',
    type: 'weddingBand',
    home: 'kalutara',
    travels: ['colombo', 'galle'],
    langs: ['si', 'en'],
    members: 5,
    from: 75_000,
  },
]

const SONGS: Record<SongLang, string[]> = {
  si: [
    'Baila medley set',
    'Classic Sinhala love songs',
    'Sunflower baila mix',
    'Kandyan wedding procession',
    'Old Radio Ceylon hits',
    'Kapiri baila',
    'Sinhala calypso set',
  ],
  en: [
    'First dance ballads',
    'Motown party set',
    '80s classics',
    'Acoustic pop covers',
    'Jazz standards',
    'Rock and roll medley',
  ],
  ta: ['Tamil film hits', 'Ilaiyaraaja classics', 'Kuthu dance set', 'Tamil wedding songs'],
  instrumental: ['Instrumental welcome set', 'Bridal march', 'String arrangements of pop songs'],
}

const BIOS: Record<MusicianType, string> = {
  weddingBand:
    'A wedding band playing a mix of Sinhala, English and Tamil music. We bring our own sound and lights, and plan each set with the couple.',
  bailaBand: 'High-energy baila for receptions and parties. Every dance floor full by the second set.',
  djMc: 'DJ and MC for weddings and corporate events, with our own sound system and lighting.',
  soloSinger: 'Solo vocalist for ceremonies, dinners and intimate events, with backing tracks or a pianist.',
  traditionalDrummers: 'Traditional drummers and dancers for Poruwa ceremonies, processions and welcomes.',
  stringEnsemble: 'Strings for ceremonies and cocktail hours: classical, film themes and pop arrangements.',
  choir: 'Choir for weddings, church services and carol evenings.',
  musicTeacher: 'Lessons in piano, guitar and vocals for all ages. Trinity and ABRSM exam preparation.',
}

const REVIEW_TEXTS = [
  'They read the room perfectly. Quiet during dinner, then everyone was dancing till the end.',
  'On time, great sound, and they learned two songs we asked for.',
  'Professional from the first message to the last song. Highly recommended.',
  'Our guests are still talking about it. Worth every rupee.',
  'Good music, though setup took a little longer than planned.',
]

/**
 * Run the seed.
 *
 * @returns Resolves when done.
 * @throws {Error} In production, without MIGRATE_DATABASE_URL, or when data exists
 *   and `--reset` wasn't passed.
 */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed in production')
  const url = process.env.MIGRATE_DATABASE_URL
  if (!url) throw new Error('MIGRATE_DATABASE_URL is not set')
  const client = postgres(url, { max: 1, onnotice: () => undefined })
  const db = drizzle(client, { schema, casing: 'snake_case' }) as Db
  const log = pino({ level: 'info' })
  /**
   * Current time (real clock: the seed creates data relative to today).
   *
   * @returns Now.
   */
  const now = () => new Date()

  try {
    const existing = await db.$count(users)
    if (existing > 0 && !process.argv.includes('--reset')) {
      throw new Error(`Database already has ${existing} users. Re-run with --reset to wipe and reseed.`)
    }
    if (process.argv.includes('--reset')) {
      await db.execute(sql`TRUNCATE audit_log, reviews, bookings, quotes, enquiry_matches, enquiries,
        repertoire_songs, services, musician_profiles, users RESTART IDENTITY CASCADE`)
    }

    // --- People --------------------------------------------------------------
    await db
      .insert(users)
      .values({ cognitoSub: 'seed-admin', displayName: 'Thaala Admin', roles: ['client', 'admin'] })
    const clientIds: string[] = []
    for (const [i, name] of CLIENTS.entries()) {
      const [u] = await db
        .insert(users)
        .values({
          cognitoSub: `seed-client-${i + 1}`,
          displayName: name,
          locale: i === 1 ? 'ta' : i === 0 ? 'si' : 'en',
        })
        .returning({ id: users.id })
      if (u) clientIds.push(u.id)
    }

    const profiles: {
      id: string
      userId: string
      type: MusicianType
      members: number
      districts: District[]
    }[] = []
    for (const [i, m] of MUSICIANS.entries()) {
      const home = m.home
      const [u] = await db
        .insert(users)
        .values({
          cognitoSub: `seed-musician-${i + 1}`,
          displayName: `${m.name} (owner)`,
          roles: ['client', 'musician'],
        })
        .returning({ id: users.id })
      if (!u) continue
      const districts = [...new Set([home, ...m.travels])]
      const live = i < 18 // the last two wait in the vetting queue (P1-07) and never show publicly
      const [p] = await db
        .insert(musicianProfiles)
        .values({
          ownerUserId: u.id,
          stageName: m.name,
          slug: slugify(m.name),
          bio: BIOS[m.type],
          type: m.type,
          membersCount: m.members,
          districts,
          languages: m.langs,
          verifiedAt: live && i % 7 !== 3 ? new Date(Date.now() - int(30, 400) * 86_400_000) : null,
          priceFromCents: m.from * 100,
          status: live ? 'live' : 'pending_review',
        })
        .returning({ id: musicianProfiles.id })
      if (!p) continue
      profiles.push({ id: p.id, userId: u.id, type: m.type, members: m.members, districts })

      const tiers =
        m.type === 'musicTeacher'
          ? [
              { name: 'Single lesson', d: '45 minutes, one student', mult: 1, min: 45 },
              { name: 'Monthly (4 lessons)', d: '4 × 45 minutes', mult: 3.6, min: 180 },
            ]
          : [
              {
                name: 'Short set',
                d: `1 hour, ${Math.max(1, Math.ceil(m.members / 2))} musicians`,
                mult: 1,
                min: 60,
              },
              {
                name: 'Reception',
                d: `4 hours, ${m.members} musicians, sound and lights`,
                mult: 1.6,
                min: 240,
              },
              { name: 'Full day', d: `Ceremony and reception, ${m.members} musicians`, mult: 2, min: 480 },
            ]
      await db.insert(services).values(
        tiers.map((t, ti) => ({
          profileId: p.id,
          name: t.name,
          description: t.d,
          durationMin: t.min,
          members: ti === 0 ? Math.max(1, Math.ceil(m.members / 2)) : m.members,
          priceFromCents: Math.round((m.from * t.mult) / 1000) * 1000 * 100,
          includesSound: ti > 0 && m.type !== 'musicTeacher',
          includesLights: ti > 0 && ['weddingBand', 'bailaBand', 'djMc'].includes(m.type),
        })),
      )
      const songs = m.langs.flatMap((l) =>
        SONGS[l].slice(0, int(3, SONGS[l].length)).map((title) => ({ title, language: l })),
      )
      if (songs.length > 0) {
        await db
          .insert(repertoireSongs)
          .values(songs.map((s) => ({ profileId: p.id, title: s.title, language: s.language })))
      }
    }

    // --- History: past events with reviews (the review flow itself is P5-01) ---
    for (const [i, p] of profiles.slice(0, 14).entries()) {
      const pastCount = int(1, 4)
      const ratings: number[] = []
      for (let k = 0; k < pastCount; k++) {
        const clientId = pick(clientIds)
        const daysAgo = int(20, 300)
        const [e] = await db
          .insert(enquiries)
          .values({
            clientUserId: clientId,
            occasion: pick(['wedding', 'birthday', 'corporate', 'homecoming'] as const),
            eventDate: dateIn(-daysAgo),
            // Posted well before the event, so history doesn't count toward today's limit.
            createdAt: new Date(Date.now() - (daysAgo + 45) * 86_400_000),
            startTime: '18:30',
            district: p.districts[0] ?? 'colombo',
            guestRange: pick(['50to150', '150to250', 'over250'] as const),
            budgetBand: '50kTo150k',
            budgetMinCents: 5_000_000,
            budgetMaxCents: 15_000_000,
            musicStyles: ['liveBand'],
            languages: ['si', 'en'],
            venueHasSound: 'no',
            status: 'booked',
            expiresAt: new Date(Date.now() - 86_400_000),
          })
          .returning()
        if (!e) continue
        await db
          .insert(enquiryMatches)
          .values({ enquiryId: e.id, profileId: p.id, score: int(60, 95), notifiedAt: e.createdAt })
        const price = (MUSICIANS[i]?.from ?? 50_000) * 100 * 1.4
        const [q] = await db
          .insert(quotes)
          .values({
            enquiryId: e.id,
            profileId: p.id,
            priceCents: Math.round(price),
            durationMin: 240,
            members: p.members,
            includesSound: true,
            includesLights: true,
            status: 'accepted',
            expiresAt: e.expiresAt,
          })
          .returning()
        if (!q) continue
        const startsAt = new Date(`${e.eventDate}T13:00:00Z`)
        const [b] = await db
          .insert(bookings)
          .values({
            quoteId: q.id,
            clientUserId: clientId,
            profileId: p.id,
            eventStartsAt: startsAt,
            durationMin: 240,
            totalCents: q.priceCents,
            depositCents: calculateDepositCents(q.priceCents),
            balanceDueAt: new Date(startsAt.getTime() - 7 * 86_400_000),
            status: 'completed',
          })
          .returning()
        if (!b) continue
        const rating = rand() < 0.8 ? 5 : 4
        ratings.push(rating)
        await db.insert(reviews).values({
          bookingId: b.id,
          authorUserId: clientId,
          profileId: p.id,
          rating,
          body: pick(REVIEW_TEXTS),
        })
      }
      const avg = ratings.reduce((a, b) => a + b, 0) / Math.max(1, ratings.length)
      await db
        .update(musicianProfiles)
        .set({
          ratingAvg: Math.round(avg * 100) / 100,
          ratingCount: ratings.length,
          avgReplySeconds: int(1, 6) * 3600,
        })
        .where(eq(musicianProfiles.id, p.id))
    }

    // --- Live flow through the real services -----------------------------------
    /**
     * Build the actor a service would get from a verified token.
     *
     * @param userId - Seeded user id.
     * @param profileId - Their musician profile, if any.
     * @returns The actor.
     */
    const actorFor = (userId: string, profileId: string | null = null): Actor => ({
      userId,
      roles: profileId ? ['client', 'musician'] : ['client'],
      profileId,
    })
    const deps = { db, now, log, config: { AUDIT_IP_SALT: 'seed-only-salt-value' } } as const
    const [dilani, ravi, shenali, arjun, fathima] = clientIds
    if (!dilani || !ravi || !shenali || !arjun || !fathima) throw new Error('clients missing')
    const rj = profiles[0]
    if (!rj) throw new Error('profiles missing')

    // Dilani's wedding: matched, then three musicians quote.
    const wedding = await createEnquiry(deps, actorFor(dilani), {
      occasion: 'wedding',
      eventDate: dateIn(86),
      startTime: '19:00',
      district: 'colombo',
      guests: '150to250',
      venue: 'Ballroom, Galle Road',
      musicStyles: ['liveBand'],
      songLanguages: ['si', 'en'],
      venueHasSound: 'no',
      budget: '50kTo150k',
      notes: 'First dance song, then a baila set after dinner.',
    })
    // Pretend the alerts went out a few hours ago so reply times look realistic.
    await db.execute(sql`UPDATE enquiry_matches SET notified_at = now() - (interval '1 hour' * (1 + (score % 5)))
      WHERE enquiry_id = ${wedding.id}`)
    const matched = await db
      .select({ profileId: enquiryMatches.profileId })
      .from(enquiryMatches)
      .where(eq(enquiryMatches.enquiryId, wedding.id))
    const quoteMessages = [
      'We can start with a dinner set and move into baila after the cake.',
      'Sound system can be added for LKR 15,000.',
      'Includes an MC and a short acoustic set for the first dance.',
    ]
    for (const [k, mrow] of matched.slice(0, 3).entries()) {
      const prof = profiles.find((x) => x.id === mrow.profileId)
      if (!prof) continue
      await createQuote(deps, actorFor(prof.userId, prof.id), wedding.id, {
        priceCents: [12_000_000, 9_500_000, 14_000_000][k] ?? 10_000_000,
        durationMinutes: [240, 180, 300][k] ?? 240,
        members: prof.members,
        includesSound: k !== 1,
        includesLights: k !== 1,
        mustPlayKnown: [9, 6, 11][k] ?? null,
        message: quoteMessages[k] ?? '',
      })
      await refreshAvgReply(db, prof.id)
    }

    // Dilani's homecoming: posted, nobody has quoted yet ("waiting" state).
    await createEnquiry(deps, actorFor(dilani), {
      occasion: 'homecoming',
      eventDate: dateIn(110),
      startTime: '18:30',
      district: 'kalutara',
      guests: '50to150',
      musicStyles: ['dj'],
      songLanguages: ['si'],
      venueHasSound: 'notSure',
      budget: 'under50k',
    })

    // Enquiries from other clients land on Rhythm Junction's dashboard.
    for (const [who, occasion, days] of [
      [ravi, 'corporate', 30],
      [shenali, 'wedding', 120],
      [arjun, 'birthday', 45],
    ] as const) {
      await createEnquiry(deps, actorFor(who), {
        occasion,
        eventDate: dateIn(days),
        startTime: '19:30',
        district: 'colombo',
        guests: 'over250',
        musicStyles: ['liveBand'],
        songLanguages: ['si', 'en'],
        venueHasSound: 'yes',
        budget: '150kTo300k',
      })
    }

    // Upcoming gigs for Rhythm Junction: Fathima accepts quotes, and payment is marked
    // confirmed directly (standing in for the PayHere webhook, P4-02).
    for (const [occasion, days, venue] of [
      ['wedding', 9, 'Galle Face Hotel'],
      ['birthday', 17, 'Mount Lavinia'],
      ['corporate', 29, null],
    ] as const) {
      const e = await createEnquiry(deps, actorFor(fathima), {
        occasion,
        eventDate: dateIn(days),
        startTime: '18:00',
        district: 'colombo',
        guests: '150to250',
        ...(venue ? { venue } : {}),
        musicStyles: ['liveBand'],
        songLanguages: ['si', 'en', 'ta'],
        venueHasSound: 'no',
        budget: 'over300k',
      })
      await db
        .insert(enquiryMatches)
        .values({ enquiryId: e.id, profileId: rj.id, score: 90 })
        .onConflictDoNothing()
      const q = await createQuote(deps, actorFor(rj.userId, rj.id), e.id, {
        priceCents: [13_500_000, 6_000_000, 18_000_000][[9, 17, 29].indexOf(days)] ?? 10_000_000,
        durationMinutes: 240,
        members: rj.members,
        includesSound: true,
        includesLights: true,
        mustPlayKnown: null,
        message: 'Looking forward to it.',
      })
      const { bookingId } = await acceptQuote(deps, actorFor(fathima), q.id, null)
      await db.update(bookings).set({ status: 'confirmed' }).where(eq(bookings.id, bookingId))
      await db.update(enquiries).set({ status: 'booked' }).where(eq(enquiries.id, e.id))
    }
    await refreshAvgReply(db, rj.id)

    log.info(
      { users: await db.$count(users), profiles: profiles.length, enquiries: await db.$count(enquiries) },
      'seed complete',
    )
  } finally {
    await client.end({ timeout: 5 })
  }
}

await main()

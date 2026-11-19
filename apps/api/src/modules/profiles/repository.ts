import { and, asc, count, desc, eq, ilike, inArray, isNotNull, lte, sql, type SQL } from 'drizzle-orm'
import { CATEGORY_TYPES, type MusicianSearchQuery, type MusicianType } from '@thaala/shared'
import {
  bookings,
  enquiries,
  musicianProfiles,
  quotes,
  repertoireSongs,
  reviews,
  services,
  users,
} from '../../db/schema'
import type { DbOrTx } from '../../lib/db'

const p = musicianProfiles
/** Fully qualified outer id for correlated subqueries (see matching/service.ts). */
const OUTER_PROFILE_ID = sql.raw('"musician_profiles"."id"')

/**
 * Escape `%`, `_` and `\` so user text is matched literally inside ILIKE.
 *
 * @param s - Untrusted search text.
 * @returns The escaped text (still passed as a bound parameter).
 */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

/** Columns every card needs. */
const summaryColumns = {
  id: p.id,
  slug: p.slug,
  name: p.stageName,
  type: p.type,
  districts: p.districts,
  languages: p.languages,
  ratingAvg: p.ratingAvg,
  ratingCount: p.ratingCount,
  priceFromCents: p.priceFromCents,
  avgReplySeconds: p.avgReplySeconds,
  verifiedAt: p.verifiedAt,
  membersCount: p.membersCount,
}

export type ProfileSummaryRow = {
  id: string
  slug: string
  name: string
  type: MusicianType
  districts: string[]
  languages: string[]
  ratingAvg: number
  ratingCount: number
  priceFromCents: number
  avgReplySeconds: number | null
  verifiedAt: Date | null
  membersCount: number
}

/**
 * Build the WHERE clause for a public search. Only live profiles are ever returned.
 *
 * @param q - Validated search query.
 * @returns The combined condition.
 */
function searchWhere(q: MusicianSearchQuery): SQL | undefined {
  const types = [...new Set(q.type.flatMap((t) => CATEGORY_TYPES[t]))]
  const conditions: (SQL | undefined)[] = [
    eq(p.status, 'live'),
    types.length > 0 ? inArray(p.type, types) : undefined,
    q.district ? sql`${q.district}::district = ANY(${p.districts})` : undefined,
    q.lang.length > 0
      ? sql`${p.languages} && ARRAY[${sql.join(
          q.lang.map((l) => sql`${l}`),
          sql`, `,
        )}]::song_language[]`
      : undefined,
    q.maxBudget !== undefined ? lte(p.priceFromCents, q.maxBudget * 100) : undefined,
    q.verified ? isNotNull(p.verifiedAt) : undefined,
    q.q ? ilike(p.stageName, `%${escapeLike(q.q)}%`) : undefined,
    // Hide musicians who already have a booking on the chosen date (Colombo calendar day).
    q.date
      ? sql`NOT EXISTS (SELECT 1 FROM ${bookings} b WHERE b.profile_id = ${OUTER_PROFILE_ID}
            AND b.status IN ('pending_payment', 'confirmed')
            AND (b.event_starts_at AT TIME ZONE 'Asia/Colombo')::date = ${q.date}::date)`
      : undefined,
  ]
  return and(...conditions)
}

/**
 * Order for each sort option. Every order ends with the id so pages never overlap.
 *
 * @param sort - Validated sort key.
 * @returns ORDER BY expressions.
 */
function searchOrder(sort: MusicianSearchQuery['sort']): SQL[] {
  switch (sort) {
    case 'topRated':
      return [desc(p.ratingAvg), desc(p.ratingCount), asc(p.id)]
    case 'lowestPrice':
      return [asc(p.priceFromCents), desc(p.ratingAvg), asc(p.id)]
    case 'fastestReply':
      return [sql`${p.avgReplySeconds} ASC NULLS LAST`, asc(p.id)]
    case 'bestMatch':
      // Verified first, then a rating weighted by how many reviews back it up.
      return [sql`${p.verifiedAt} IS NULL`, sql`${p.ratingAvg} * LEAST(${p.ratingCount}, 10) DESC`, asc(p.id)]
  }
}

/**
 * Search live musician profiles.
 *
 * @param db - Database.
 * @param q - Validated query (includes page and pageSize, pageSize ≤ 50).
 * @returns One page of rows and the total match count.
 */
export async function searchProfiles(
  db: DbOrTx,
  q: MusicianSearchQuery,
): Promise<{ rows: ProfileSummaryRow[]; total: number }> {
  const where = searchWhere(q)
  const [rows, [totalRow]] = await Promise.all([
    db
      .select(summaryColumns)
      .from(p)
      .where(where)
      .orderBy(...searchOrder(q.sort))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ n: count() }).from(p).where(where),
  ])
  return { rows, total: totalRow?.n ?? 0 }
}

/**
 * Load one live profile by slug.
 *
 * @param db - Database.
 * @param slug - Public slug (untrusted lookup key).
 * @returns The profile row with bio, or undefined if missing or not live.
 */
export async function findLiveProfile(
  db: DbOrTx,
  slug: string,
): Promise<(ProfileSummaryRow & { bio: string }) | undefined> {
  const [row] = await db
    .select({ ...summaryColumns, bio: p.bio })
    .from(p)
    .where(and(eq(p.slug, slug), eq(p.status, 'live')))
    .limit(1)
  return row
}

/**
 * List a profile's packages, cheapest first.
 *
 * @param db - Database.
 * @param profileId - Profile id.
 * @returns Service rows.
 */
export function listServices(db: DbOrTx, profileId: string) {
  return db
    .select({
      id: services.id,
      name: services.name,
      description: services.description,
      priceFromCents: services.priceFromCents,
    })
    .from(services)
    .where(eq(services.profileId, profileId))
    .orderBy(asc(services.priceFromCents))
}

/**
 * List a profile's songs, optionally filtered by a fuzzy title search.
 *
 * @param db - Database.
 * @param profileId - Profile id.
 * @param q - Optional search text (matched with ILIKE or trigram similarity).
 * @returns Up to 200 songs.
 */
export function listSongs(db: DbOrTx, profileId: string, q: string | undefined) {
  const s = repertoireSongs
  return db
    .select({ id: s.id, title: s.title, language: s.language, setName: s.setName })
    .from(s)
    .where(
      and(
        eq(s.profileId, profileId),
        q ? sql`(${s.title} ILIKE ${`%${escapeLike(q)}%`} OR similarity(${s.title}, ${q}) > 0.3)` : undefined,
      ),
    )
    .orderBy(asc(s.setName), asc(s.title))
    .limit(200)
}

/**
 * List published reviews with the event context shown next to them.
 *
 * @param db - Database.
 * @param profileId - Profile id.
 * @returns Up to 20 newest reviews.
 */
export function listReviews(db: DbOrTx, profileId: string) {
  return db
    .select({
      id: reviews.id,
      authorName: users.displayName,
      authorStatus: users.status,
      occasion: enquiries.occasion,
      district: enquiries.district,
      eventDate: enquiries.eventDate,
      rating: reviews.rating,
      body: reviews.body,
      reply: reviews.replyBody,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.authorUserId))
    .innerJoin(bookings, eq(bookings.id, reviews.bookingId))
    .innerJoin(quotes, eq(quotes.id, bookings.quoteId))
    .innerJoin(enquiries, eq(enquiries.id, quotes.enquiryId))
    .where(and(eq(reviews.profileId, profileId), eq(reviews.status, 'published')))
    .orderBy(desc(reviews.createdAt))
    .limit(20)
}

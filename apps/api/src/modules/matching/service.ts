import { and, count, eq, inArray, ne, sql } from 'drizzle-orm'
import { STYLE_TYPES } from '@thaala/shared'
import {
  bookings,
  enquiries,
  enquiryMatches,
  musicianProfiles,
  repertoireSongs,
  services,
} from '../../db/schema'
import type { DbOrTx } from '../../lib/db'
import { rankCandidates, type MatchCandidate } from './scoring'

/**
 * Find, score and store the musicians to alert for one enquiry.
 *
 * The database does the cheap pre-filter (live, right type, travels there); the pure
 * {@link rankCandidates} applies the full rules and scoring. Re-running is safe: existing
 * matches are kept (unique enquiry + profile).
 *
 * @param db - Database or transaction.
 * @param enquiryId - The enquiry to match (must exist).
 * @returns How many musicians were matched.
 *
 * @remarks
 * Today this runs in the request right after the enquiry commits. P2-04 moves it to the
 * SQS matching worker via an outbox event, and P2-05 sends the alerts.
 */
export async function matchEnquiry(db: DbOrTx, enquiryId: string): Promise<number> {
  const [e] = await db.select().from(enquiries).where(eq(enquiries.id, enquiryId)).limit(1)
  if (!e) return 0
  const types = [...new Set(e.musicStyles.flatMap((s) => STYLE_TYPES[s]))]
  const p = musicianProfiles
  // Drizzle renders a lone column as a bare name, which a correlated subquery would bind
  // to the inner table. Spell out the outer column. (Static text, no user input.)
  const outerId = sql.raw('"musician_profiles"."id"')
  const langs = sql`ARRAY[${sql.join(
    e.languages.map((l) => sql`${l}`),
    sql`, `,
  )}]::song_language[]`

  const rows = await db
    .select({
      profileId: p.id,
      type: p.type,
      districts: p.districts,
      priceFromCents: p.priceFromCents,
      ratingAvg: p.ratingAvg,
      ratingCount: p.ratingCount,
      avgReplySeconds: p.avgReplySeconds,
      verifiedAt: p.verifiedAt,
      bio: p.bio,
      songsInLanguages: sql<number>`(SELECT count(*)::int FROM ${repertoireSongs} r
        WHERE r.profile_id = ${outerId} AND r.language = ANY(${langs}))`,
      serviceCount: sql<number>`(SELECT count(*)::int FROM ${services} s WHERE s.profile_id = ${outerId})`,
      bookedThatDay: sql<boolean>`EXISTS (SELECT 1 FROM ${bookings} b WHERE b.profile_id = ${outerId}
        AND b.status IN ('pending_payment', 'confirmed')
        AND (b.event_starts_at AT TIME ZONE 'Asia/Colombo')::date = ${e.eventDate}::date)`,
    })
    .from(p)
    .where(
      and(
        eq(p.status, 'live'),
        inArray(p.type, types),
        sql`${e.district}::district = ANY(${p.districts})`,
        // A musician never gets matched to their own enquiry.
        ne(p.ownerUserId, e.clientUserId),
      ),
    )

  const candidates: MatchCandidate[] = rows.map((r) => ({
    profileId: r.profileId,
    type: r.type,
    districts: r.districts,
    priceFromCents: r.priceFromCents,
    ratingAvg: Number(r.ratingAvg),
    ratingCount: r.ratingCount,
    avgReplySeconds: r.avgReplySeconds,
    verified: r.verifiedAt !== null,
    hasBio: r.bio.trim().length > 0,
    serviceCount: r.serviceCount,
    songsInLanguages: r.songsInLanguages,
    bookedThatDay: r.bookedThatDay,
  }))

  const ranked = rankCandidates(
    {
      musicStyles: e.musicStyles,
      district: e.district,
      languages: e.languages,
      budgetMinCents: e.budgetMinCents,
      budgetMaxCents: e.budgetMaxCents,
    },
    candidates,
  )
  if (ranked.length > 0) {
    await db
      .insert(enquiryMatches)
      .values(ranked.map((r) => ({ enquiryId, profileId: r.profileId, score: r.score })))
      .onConflictDoNothing()
  }
  const [n] = await db
    .select({ n: count() })
    .from(enquiryMatches)
    .where(eq(enquiryMatches.enquiryId, enquiryId))
  return n?.n ?? 0
}

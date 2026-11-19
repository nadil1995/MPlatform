import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
import { colomboInstant, type MusicianDashboard } from '@thaala/shared'
import type { Actor, Deps } from '../../app-types'
import { bookings, enquiries, enquiryMatches, musicianProfiles, quotes } from '../../db/schema'
import { AppError } from '../../lib/errors'

/**
 * The musician dashboard: stats, new enquiries to answer, and upcoming gigs.
 *
 * @param deps - Database and clock.
 * @param actor - The signed-in musician (has a profile).
 * @returns Dashboard data for the actor's own profile only.
 * @throws {AppError} `FORBIDDEN` if the actor has no profile.
 *
 * @remarks
 * Security: every query is scoped by `actor.profileId`. Matched enquiries expose no client
 * identity, notes or venue; the venue appears only once a booking is confirmed.
 */
export async function getDashboard(deps: Pick<Deps, 'db' | 'now'>, actor: Actor): Promise<MusicianDashboard> {
  const profileId = actor.profileId
  if (!profileId) throw new AppError('FORBIDDEN')
  const now = deps.now()
  const { db } = deps

  const [profile] = await db
    .select()
    .from(musicianProfiles)
    .where(eq(musicianProfiles.id, profileId))
    .limit(1)
  if (!profile) throw new AppError('FORBIDDEN')

  const [newEnquiries, quotesWaiting, gigs, [due]] = await Promise.all([
    db
      .select({ m: enquiryMatches, e: enquiries })
      .from(enquiryMatches)
      .innerJoin(enquiries, eq(enquiries.id, enquiryMatches.enquiryId))
      .where(
        and(
          eq(enquiryMatches.profileId, profileId),
          isNull(enquiryMatches.declinedAt),
          inArray(enquiries.status, ['open', 'quoted']),
          gt(enquiries.expiresAt, now),
          // Hide enquiries this musician already quoted on. Outer column spelled out:
          // a bare name would bind to the subquery's own table.
          sql`NOT EXISTS (SELECT 1 FROM ${quotes} q WHERE q.enquiry_id = "enquiry_matches"."enquiry_id"
            AND q.profile_id = ${profileId})`,
        ),
      )
      .orderBy(desc(enquiryMatches.notifiedAt))
      .limit(20),
    db.$count(quotes, and(eq(quotes.profileId, profileId), eq(quotes.status, 'sent'))),
    db
      .select({ b: bookings, e: enquiries })
      .from(bookings)
      .innerJoin(quotes, eq(quotes.id, bookings.quoteId))
      .innerJoin(enquiries, eq(enquiries.id, quotes.enquiryId))
      .where(
        and(
          eq(bookings.profileId, profileId),
          eq(bookings.status, 'confirmed'),
          gt(bookings.eventStartsAt, now),
        ),
      )
      .orderBy(bookings.eventStartsAt)
      .limit(10),
    db
      .select({ sum: sql<string | null>`sum(${bookings.totalCents})` })
      .from(bookings)
      .where(and(eq(bookings.profileId, profileId), eq(bookings.status, 'confirmed'))),
  ])

  return {
    name: profile.stageName,
    slug: profile.slug,
    status: profile.status,
    verified: profile.verifiedAt !== null,
    averageReplyMinutes: profile.avgReplySeconds === null ? null : Math.round(profile.avgReplySeconds / 60),
    quotesWaiting,
    dueCents: Number(due?.sum ?? 0),
    newEnquiries: newEnquiries.map(({ m, e }) => ({
      enquiryId: e.id,
      occasion: e.occasion,
      startsAt: colomboInstant(e.eventDate, e.startTime),
      district: e.district,
      guests: e.guestRange,
      budget: e.budgetBand,
      score: m.score,
      notifiedAt: m.notifiedAt.toISOString(),
    })),
    upcomingGigs: gigs.map(({ b, e }) => ({
      bookingId: b.id,
      startsAt: b.eventStartsAt.toISOString(),
      occasion: e.occasion,
      venue: e.venueName,
      district: e.district,
      totalCents: b.totalCents,
    })),
  }
}

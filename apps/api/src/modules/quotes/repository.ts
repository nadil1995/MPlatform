import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { enquiries, enquiryMatches, musicianProfiles, quotes } from '../../db/schema'
import type { DbOrTx } from '../../lib/db'

export type QuoteRow = typeof quotes.$inferSelect

/**
 * Quotes on one enquiry, with the musician and match data the compare view needs.
 *
 * @param db - Database.
 * @param enquiryId - Enquiry id; the caller has already checked the actor owns it.
 * @returns Active (sent or accepted) quotes.
 */
export function listForEnquiry(db: DbOrTx, enquiryId: string) {
  return db
    .select({
      quote: quotes,
      slug: musicianProfiles.slug,
      name: musicianProfiles.stageName,
      ratingAvg: musicianProfiles.ratingAvg,
      ratingCount: musicianProfiles.ratingCount,
      score: enquiryMatches.score,
      notifiedAt: enquiryMatches.notifiedAt,
    })
    .from(quotes)
    .innerJoin(musicianProfiles, eq(musicianProfiles.id, quotes.profileId))
    .leftJoin(
      enquiryMatches,
      and(eq(enquiryMatches.enquiryId, quotes.enquiryId), eq(enquiryMatches.profileId, quotes.profileId)),
    )
    .where(and(eq(quotes.enquiryId, enquiryId), inArray(quotes.status, ['sent', 'accepted'])))
}

/**
 * Load a quote together with its enquiry, only if the actor owns that enquiry.
 *
 * @param db - Database or transaction.
 * @param quoteId - Quote id.
 * @param clientUserId - The acting client.
 * @param opts - `forUpdate` locks the quote and enquiry rows.
 * @param opts.forUpdate - Take row locks (use inside a transaction).
 * @returns Quote, enquiry and musician name, or undefined (missing or not theirs).
 */
export async function findForClient(
  db: DbOrTx,
  quoteId: string,
  clientUserId: string,
  opts: { forUpdate?: boolean } = {},
) {
  const q = db
    .select({
      quote: quotes,
      enquiry: enquiries,
      name: musicianProfiles.stageName,
      slug: musicianProfiles.slug,
    })
    .from(quotes)
    .innerJoin(enquiries, eq(enquiries.id, quotes.enquiryId))
    .innerJoin(musicianProfiles, eq(musicianProfiles.id, quotes.profileId))
    .where(and(eq(quotes.id, quoteId), eq(enquiries.clientUserId, clientUserId)))
    .limit(1)
  const [row] = opts.forUpdate ? await q.for('update', { of: [quotes, enquiries] }) : await q
  return row
}

/**
 * The match row for a musician on an enquiry.
 *
 * @param db - Database or transaction.
 * @param enquiryId - Enquiry id.
 * @param profileId - The acting musician's profile.
 * @returns The match, or undefined if they were never matched.
 */
export async function findMatch(db: DbOrTx, enquiryId: string, profileId: string) {
  const [row] = await db
    .select()
    .from(enquiryMatches)
    .where(and(eq(enquiryMatches.enquiryId, enquiryId), eq(enquiryMatches.profileId, profileId)))
    .limit(1)
  return row
}

/**
 * Recompute a musician's average reply time from all their quotes.
 *
 * @param db - Transaction.
 * @param profileId - Profile id.
 * @returns Resolves when stored.
 */
export async function refreshAvgReply(db: DbOrTx, profileId: string): Promise<void> {
  await db
    .update(musicianProfiles)
    .set({
      avgReplySeconds: sql`(SELECT round(avg(extract(epoch FROM q.created_at - m.notified_at)))::int
        FROM ${quotes} q JOIN ${enquiryMatches} m
          ON m.enquiry_id = q.enquiry_id AND m.profile_id = q.profile_id
        WHERE q.profile_id = ${profileId})`,
    })
    .where(eq(musicianProfiles.id, profileId))
}

/**
 * Decline every other open quote on an enquiry once one is accepted.
 *
 * @param db - Transaction.
 * @param enquiryId - Enquiry id.
 * @param acceptedId - The accepted quote, left untouched.
 * @returns Resolves when updated.
 */
export async function declineOthers(db: DbOrTx, enquiryId: string, acceptedId: string): Promise<void> {
  await db
    .update(quotes)
    .set({ status: 'declined' })
    .where(and(eq(quotes.enquiryId, enquiryId), ne(quotes.id, acceptedId), eq(quotes.status, 'sent')))
}

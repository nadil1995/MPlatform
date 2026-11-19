import { and, eq } from 'drizzle-orm'
import {
  BALANCE_DUE_DAYS_BEFORE,
  calculateDepositCents,
  colomboInstant,
  type CheckoutSummary,
  type CreateQuote,
  type EnquiryWithQuotes,
  type Quote,
  type QuoteSort,
} from '@thaala/shared'
import type { Actor, Deps } from '../../app-types'
import { bookings, enquiryMatches, quotes } from '../../db/schema'
import { writeAudit } from '../../lib/audit'
import { AppError } from '../../lib/errors'
import { canQuote } from '../../policies'
import * as enquiriesRepo from '../enquiries/repository'
import { getOwnedEnquiry, toEnquiry } from '../enquiries/service'
import { assertTransition } from '../state'
import * as repo from './repository'

/** A quote holds its price for 7 days, or until the event, whichever is first. */
const QUOTE_LIFETIME_MS = 7 * 24 * 3600 * 1000

/**
 * Order quotes for the compare view.
 *
 * @param list - Quotes for one enquiry.
 * @param sort - Validated sort key.
 * @returns A new array. "Best match" puts the highest match score first.
 */
export function sortQuotes(list: readonly Quote[], sort: QuoteSort): Quote[] {
  const out = [...list]
  if (sort === 'price') return out.sort((a, b) => a.priceCents - b.priceCents)
  if (sort === 'rating') return out.sort((a, b) => b.rating - a.rating)
  return out.sort((a, b) => Number(b.bestMatch) - Number(a.bestMatch) || a.priceCents - b.priceCents)
}

/**
 * An enquiry and its quotes, for the client who posted it.
 *
 * @param deps - Database.
 * @param actor - The signed-in client.
 * @param enquiryId - Enquiry id.
 * @param sort - Sort order.
 * @returns The enquiry and its active quotes.
 * @throws {AppError} `NOT_FOUND` if the enquiry isn't the actor's.
 */
export async function getQuotesForEnquiry(
  deps: Pick<Deps, 'db'>,
  actor: Actor,
  enquiryId: string,
  sort: QuoteSort,
): Promise<EnquiryWithQuotes> {
  const enquiry = await getOwnedEnquiry(deps, actor, enquiryId)
  const [rows, matchedCount] = await Promise.all([
    repo.listForEnquiry(deps.db, enquiryId),
    deps.db.$count(enquiryMatches, eq(enquiryMatches.enquiryId, enquiryId)),
  ])
  const topScore = Math.max(-1, ...rows.map((r) => r.score ?? 0))

  const list: Quote[] = rows.map((r) => ({
    id: r.quote.id,
    musicianSlug: r.slug,
    musicianName: r.name,
    rating: Number(r.ratingAvg),
    reviews: r.ratingCount,
    priceCents: r.quote.priceCents,
    durationMinutes: r.quote.durationMin,
    members: r.quote.members,
    includesSound: r.quote.includesSound,
    includesLights: r.quote.includesLights,
    mustPlayKnown: r.quote.mustPlayKnown,
    replyMinutes: r.notifiedAt
      ? Math.max(0, Math.round((r.quote.createdAt.getTime() - r.notifiedAt.getTime()) / 60_000))
      : 0,
    // Only one "Best match" badge, and only when there's something to compare.
    bestMatch: rows.length > 1 && r.score === topScore,
    message: r.quote.message,
    status: r.quote.status,
  }))
  return {
    enquiry: toEnquiry(enquiry, { quoteCount: list.length, matchedCount }),
    quotes: sortQuotes(list, sort),
  }
}

/**
 * A matched musician sends a quote.
 *
 * @param deps - Database and clock.
 * @param actor - The signed-in musician (has a profile).
 * @param enquiryId - Enquiry id.
 * @param input - Validated with `createQuoteSchema`.
 * @returns The new quote id.
 * @throws {AppError} `NOT_FOUND` if the musician wasn't matched (doesn't reveal the enquiry exists).
 * @throws {AppError} `ENQUIRY_CLOSED` if the enquiry is booked, expired or cancelled.
 * @throws {AppError} `ALREADY_QUOTED` on a second quote for the same enquiry.
 *
 * @remarks
 * Side effects: inserts `quotes`, moves the enquiry `open → quoted`, refreshes the
 * musician's average reply time. P2-05 will notify the client after commit.
 */
export async function createQuote(
  deps: Pick<Deps, 'db' | 'now'>,
  actor: Actor,
  enquiryId: string,
  input: CreateQuote,
): Promise<{ id: string }> {
  const profileId = actor.profileId
  if (!profileId) throw new AppError('FORBIDDEN')
  const now = deps.now()
  return deps.db.transaction(async (tx) => {
    const match = await repo.findMatch(tx, enquiryId, profileId)
    if (!canQuote(actor, match)) throw new AppError('NOT_FOUND')
    const [enquiry] = await tx.query.enquiries.findMany({
      where: (e, { eq: eqq }) => eqq(e.id, enquiryId),
      limit: 1,
    })
    if (!enquiry) throw new AppError('NOT_FOUND')
    if (!['open', 'quoted'].includes(enquiry.status) || enquiry.expiresAt <= now)
      throw new AppError('ENQUIRY_CLOSED')

    const startsAt = new Date(colomboInstant(enquiry.eventDate, enquiry.startTime))
    const [row] = await tx
      .insert(quotes)
      .values({
        enquiryId,
        profileId,
        priceCents: input.priceCents,
        durationMin: input.durationMinutes,
        members: input.members,
        includesSound: input.includesSound,
        includesLights: input.includesLights,
        mustPlayKnown: input.mustPlayKnown,
        message: input.message,
        expiresAt: new Date(Math.min(startsAt.getTime(), now.getTime() + QUOTE_LIFETIME_MS)),
      })
      .onConflictDoNothing()
      .returning({ id: quotes.id })
    if (!row) throw new AppError('ALREADY_QUOTED')

    if (enquiry.status === 'open') {
      assertTransition('enquiry', 'open', 'quoted')
      await enquiriesRepo.setStatus(tx, enquiryId, ['open'], 'quoted')
    }
    await repo.refreshAvgReply(tx, profileId)
    return { id: row.id }
  })
}

/**
 * A matched musician says they're not available, so the enquiry leaves their list.
 *
 * @param deps - Database and clock.
 * @param actor - The signed-in musician.
 * @param enquiryId - Enquiry id.
 * @returns Resolves when recorded.
 * @throws {AppError} `NOT_FOUND` if they weren't matched.
 */
export async function declineEnquiry(
  deps: Pick<Deps, 'db' | 'now'>,
  actor: Actor,
  enquiryId: string,
): Promise<void> {
  if (!actor.profileId) throw new AppError('FORBIDDEN')
  const match = await repo.findMatch(deps.db, enquiryId, actor.profileId)
  if (!match || match.profileId !== actor.profileId) throw new AppError('NOT_FOUND')
  await deps.db
    .update(enquiryMatches)
    .set({ declinedAt: deps.now() })
    .where(and(eq(enquiryMatches.id, match.id)))
}

/**
 * Everything the checkout page shows, with amounts computed here.
 *
 * @param deps - Database.
 * @param actor - The signed-in client.
 * @param quoteId - Quote id.
 * @returns Musician, event and the deposit/balance split.
 * @throws {AppError} `NOT_FOUND` if the quote isn't on one of the actor's enquiries.
 *
 * @remarks
 * Security: the deposit comes from the stored quote price via the shared
 * `calculateDepositCents`, never from the request (CLAUDE.md rule 8).
 */
export async function getCheckout(
  deps: Pick<Deps, 'db'>,
  actor: Actor,
  quoteId: string,
): Promise<CheckoutSummary> {
  const row = await repo.findForClient(deps.db, quoteId, actor.userId)
  if (!row) throw new AppError('NOT_FOUND')
  const { quote, enquiry } = row
  const startsAt = new Date(colomboInstant(enquiry.eventDate, enquiry.startTime))
  const depositCents = calculateDepositCents(quote.priceCents)
  return {
    quoteId: quote.id,
    enquiryId: enquiry.id,
    musicianName: row.name,
    musicianSlug: row.slug,
    musicians: quote.members,
    includesSound: quote.includesSound,
    includesLights: quote.includesLights,
    startsAt: startsAt.toISOString(),
    durationMinutes: quote.durationMin,
    district: enquiry.district,
    totalCents: quote.priceCents,
    depositCents,
    balanceCents: quote.priceCents - depositCents,
    balanceDueAt: new Date(startsAt.getTime() - BALANCE_DUE_DAYS_BEFORE * 24 * 3600 * 1000).toISOString(),
    quoteStatus: quote.status,
  }
}

/**
 * Accept a quote: create a booking awaiting the deposit and decline the other quotes.
 *
 * @param deps - Config (audit salt), database and clock.
 * @param actor - The signed-in client who owns the enquiry.
 * @param quoteId - Quote id.
 * @param ip - Client IP for the audit log (hashed before storing).
 * @returns The new booking id and the deposit to pay.
 * @throws {AppError} `NOT_FOUND` if the quote isn't on one of the actor's enquiries.
 * @throws {AppError} `QUOTE_NOT_ACCEPTABLE` if expired, withdrawn or already handled.
 *
 * @remarks
 * Security: the quote and enquiry rows are locked (`FOR UPDATE`) inside the transaction,
 * and `bookings.quote_id` is unique, so two parallel accepts can't create two bookings.
 * Amounts are copied from the stored quote. PayHere checkout (P4-02) starts from this booking.
 */
export async function acceptQuote(
  deps: Pick<Deps, 'db' | 'now'> & { config: Pick<Deps['config'], 'AUDIT_IP_SALT'> },
  actor: Actor,
  quoteId: string,
  ip: string | null,
): Promise<{ bookingId: string; depositCents: number }> {
  const now = deps.now()
  return deps.db.transaction(async (tx) => {
    const row = await repo.findForClient(tx, quoteId, actor.userId, { forUpdate: true })
    if (!row) throw new AppError('NOT_FOUND')
    const { quote, enquiry } = row
    // Business rule: an expired price must not be honoured.
    if (quote.status !== 'sent' || quote.expiresAt <= now || !['open', 'quoted'].includes(enquiry.status)) {
      throw new AppError('QUOTE_NOT_ACCEPTABLE')
    }
    assertTransition('quote', 'sent', 'accepted')

    const startsAt = new Date(colomboInstant(enquiry.eventDate, enquiry.startTime))
    const depositCents = calculateDepositCents(quote.priceCents)
    const [booking] = await tx
      .insert(bookings)
      .values({
        quoteId: quote.id,
        clientUserId: actor.userId,
        profileId: quote.profileId,
        eventStartsAt: startsAt,
        durationMin: quote.durationMin,
        totalCents: quote.priceCents,
        depositCents,
        balanceDueAt: new Date(startsAt.getTime() - BALANCE_DUE_DAYS_BEFORE * 24 * 3600 * 1000),
      })
      .onConflictDoNothing()
      .returning({ id: bookings.id })
    if (!booking) throw new AppError('QUOTE_NOT_ACCEPTABLE')

    await tx.update(quotes).set({ status: 'accepted' }).where(eq(quotes.id, quote.id))
    await repo.declineOthers(tx, enquiry.id, quote.id)
    await writeAudit(tx, deps.config.AUDIT_IP_SALT, {
      actorUserId: actor.userId,
      action: 'booking.created',
      entity: 'booking',
      entityId: booking.id,
      ip,
      meta: { quoteId: quote.id, totalCents: quote.priceCents, depositCents },
    })
    return { bookingId: booking.id, depositCents }
  })
}

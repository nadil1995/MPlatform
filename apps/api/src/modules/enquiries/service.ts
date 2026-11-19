import { BUDGET_BAND_RANGES, colomboInstant, type Enquiry, type EnquiryDraft } from '@thaala/shared'
import type { Actor, Deps } from '../../app-types'
import { AppError } from '../../lib/errors'
import { canViewEnquiry } from '../../policies'
import { matchEnquiry } from '../matching/service'
import * as repo from './repository'

/** CLAUDE.md / BUILD_PLAN P2-03: at most 5 enquiries per user per rolling 24 hours. */
export const DAILY_ENQUIRY_LIMIT = 5
/** Enquiries stop accepting quotes after 30 days, or at the event, whichever is first. */
const ENQUIRY_LIFETIME_MS = 30 * 24 * 3600 * 1000

/**
 * Map a stored row to the owner's view.
 *
 * @param row - Enquiry row.
 * @param counts - Quote and match counts.
 * @param counts.quoteCount - Active quotes.
 * @param counts.matchedCount - Musicians alerted.
 * @returns The API shape.
 */
export function toEnquiry(
  row: repo.EnquiryRow,
  counts: { quoteCount: number; matchedCount: number },
): Enquiry {
  return {
    id: row.id,
    occasion: row.occasion,
    startsAt: colomboInstant(row.eventDate, row.startTime),
    district: row.district,
    guests: row.guestRange,
    musicStyles: row.musicStyles,
    budget: row.budgetBand,
    venue: row.venueName,
    status: row.status,
    quoteCount: counts.quoteCount,
    matchedCount: counts.matchedCount,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Post an enquiry and alert matching musicians.
 *
 * @param deps - Database and clock.
 * @param actor - The signed-in client (from the verified token).
 * @param input - Validated with the shared `enquiryDraftSchema`.
 * @returns The new enquiry id and how many musicians were matched.
 * @throws {AppError} `VALIDATION_FAILED` (`dateInPast`) for an event that has started.
 * @throws {AppError} `RATE_LIMITED` past {@link DAILY_ENQUIRY_LIMIT} a day.
 *
 * @remarks
 * Security: the budget range is derived on the server from the band, not sent by the
 * client. The daily limit is counted in Postgres so it holds across API tasks.
 * Side effects: inserts `enquiries`, then `enquiry_matches` after commit.
 */
export async function createEnquiry(
  deps: Pick<Deps, 'db' | 'now'>,
  actor: Actor,
  input: EnquiryDraft,
): Promise<{ id: string; matchedCount: number }> {
  const now = deps.now()
  const startsAt = new Date(colomboInstant(input.eventDate, input.startTime))
  // The server clock decides "in the past"; the client's clock can't be trusted.
  if (startsAt.getTime() <= now.getTime())
    throw new AppError('VALIDATION_FAILED', { eventDate: 'dateInPast' })

  const since = new Date(now.getTime() - 24 * 3600 * 1000)
  if ((await repo.countCreatedSince(deps.db, actor.userId, since)) >= DAILY_ENQUIRY_LIMIT) {
    throw new AppError('RATE_LIMITED')
  }

  const budget = BUDGET_BAND_RANGES[input.budget]
  const id = await repo.insert(deps.db, {
    clientUserId: actor.userId,
    occasion: input.occasion,
    eventDate: input.eventDate,
    startTime: input.startTime,
    district: input.district,
    venueName: input.venue ?? null,
    guestRange: input.guests,
    budgetBand: input.budget,
    budgetMinCents: budget.minCents,
    budgetMaxCents: budget.maxCents,
    musicStyles: input.musicStyles,
    languages: input.songLanguages,
    venueHasSound: input.venueHasSound,
    notes: input.notes ?? null,
    expiresAt: new Date(Math.min(startsAt.getTime(), now.getTime() + ENQUIRY_LIFETIME_MS)),
  })
  const matchedCount = await matchEnquiry(deps.db, id)
  return { id, matchedCount }
}

/**
 * List the actor's own enquiries.
 *
 * @param deps - Database.
 * @param actor - The signed-in client.
 * @returns Newest first.
 */
export async function listMyEnquiries(deps: Pick<Deps, 'db'>, actor: Actor): Promise<Enquiry[]> {
  const rows = await repo.listOwned(deps.db, actor.userId)
  return rows.map((r) => toEnquiry(r.row, r))
}

/**
 * Load an enquiry the actor owns.
 *
 * @param deps - Database.
 * @param actor - The signed-in client.
 * @param id - Enquiry id (validated UUID).
 * @returns The stored row.
 * @throws {AppError} `NOT_FOUND` if it doesn't exist or isn't theirs (never 403, so
 *   other users' ids aren't confirmed).
 */
export async function getOwnedEnquiry(
  deps: Pick<Deps, 'db'>,
  actor: Actor,
  id: string,
): Promise<repo.EnquiryRow> {
  const row = await repo.findOwned(deps.db, id, actor.userId)
  if (!row || !canViewEnquiry(actor, row)) throw new AppError('NOT_FOUND')
  return row
}

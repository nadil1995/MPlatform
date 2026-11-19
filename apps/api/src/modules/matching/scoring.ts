/**
 * Pure matching rules (docs/ARCHITECTURE.md "Core flow", step 2).
 *
 * Kept free of I/O so every rule is unit-tested (BUILD_PLAN P2-04 asks for 100%
 * coverage here). The service loads candidates and stores the top results.
 */
import { STYLE_TYPES, type MusicianType } from '@thaala/shared'

/** How many musicians each enquiry alerts. */
export const MAX_MATCHES = 15

/** Score weights, in percent. They add up to 100. */
export const WEIGHTS = { repertoire: 30, rating: 25, replySpeed: 20, priceFit: 15, profile: 10 } as const

export type MatchEnquiry = {
  musicStyles: readonly (keyof typeof STYLE_TYPES)[]
  district: string
  languages: readonly string[]
  budgetMinCents: number
  /** Null for the open-ended top budget band. */
  budgetMaxCents: number | null
}

export type MatchCandidate = {
  profileId: string
  type: MusicianType
  districts: readonly string[]
  priceFromCents: number
  ratingAvg: number
  ratingCount: number
  avgReplySeconds: number | null
  verified: boolean
  hasBio: boolean
  serviceCount: number
  /** Songs in their repertoire sung in one of the enquiry's languages. */
  songsInLanguages: number
  /** True if they already have a booking that day. */
  bookedThatDay: boolean
}

/**
 * Hard filters: a musician who fails any of these is never alerted.
 *
 * @param e - The enquiry.
 * @param c - A live musician profile.
 * @returns True if the musician can serve this event at all.
 */
export function isEligible(e: MatchEnquiry, c: MatchCandidate): boolean {
  const servesStyle = e.musicStyles.some((s) => STYLE_TYPES[s].includes(c.type))
  const travels = c.districts.includes(e.district)
  const affordable = e.budgetMaxCents === null || c.priceFromCents <= e.budgetMaxCents
  return servesStyle && travels && affordable && !c.bookedThatDay
}

/**
 * Clamp a number into 0–1.
 *
 * @param n - Any number.
 * @returns `n` limited to the range [0, 1].
 */
const unit = (n: number): number => Math.min(1, Math.max(0, n))

/**
 * Score an eligible musician for an enquiry, 0–100.
 *
 * - Repertoire (30): songs in the client's languages; 10 or more counts as full marks.
 * - Rating (25): average rating, discounted until there are 10 reviews so one 5-star
 *   review doesn't beat fifty 4.8s.
 * - Reply speed (20): within 1 hour is full marks, 24 hours or more is zero, linear
 *   between; no history yet scores half, so new musicians still get a chance.
 * - Price fit (15): a starting price inside the budget band is full marks; well under
 *   the band scores a bit lower (often a smaller act than the client wants).
 * - Profile (10): verified (half), has a bio (quarter), offers packages (quarter).
 *
 * @param e - The enquiry.
 * @param c - An eligible candidate (call {@link isEligible} first).
 * @returns Integer score from 0 to 100.
 */
export function scoreCandidate(e: MatchEnquiry, c: MatchCandidate): number {
  const repertoire = unit(c.songsInLanguages / 10)
  const confidence = unit(c.ratingCount / 10)
  const rating = unit(c.ratingAvg / 5) * confidence
  const replySpeed = c.avgReplySeconds === null ? 0.5 : unit(1 - (c.avgReplySeconds - 3600) / (23 * 3600))
  const priceFit = c.priceFromCents >= e.budgetMinCents ? 1 : 0.7
  const profile = (c.verified ? 0.5 : 0) + (c.hasBio ? 0.25 : 0) + (c.serviceCount > 0 ? 0.25 : 0)

  return Math.round(
    repertoire * WEIGHTS.repertoire +
      rating * WEIGHTS.rating +
      replySpeed * WEIGHTS.replySpeed +
      priceFit * WEIGHTS.priceFit +
      profile * WEIGHTS.profile,
  )
}

/**
 * Pick who to alert: eligible candidates, best first, capped at {@link MAX_MATCHES}.
 *
 * Ties keep the input order, so results are stable between runs.
 *
 * @param e - The enquiry.
 * @param candidates - Live profiles that passed the database pre-filter.
 * @returns `{ profileId, score }` for the musicians to alert (may be empty).
 */
export function rankCandidates(
  e: MatchEnquiry,
  candidates: readonly MatchCandidate[],
): { profileId: string; score: number }[] {
  return candidates
    .filter((c) => isEligible(e, c))
    .map((c) => ({ profileId: c.profileId, score: scoreCandidate(e, c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES)
}

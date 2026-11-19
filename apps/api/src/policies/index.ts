import type { Actor } from '../app-types'

/**
 * Ownership rules in one place (docs/SECURITY.md §3). Services call these after loading
 * an entity; repositories also scope queries by the actor, so a missed call fails closed.
 */

/**
 * Only the client who posted an enquiry may see it and its quotes.
 *
 * @param actor - The signed-in user.
 * @param enquiry - The enquiry's owner id.
 * @param enquiry.clientUserId - Owner of the enquiry.
 * @returns True if the actor owns the enquiry.
 */
export function canViewEnquiry(actor: Actor, enquiry: { clientUserId: string }): boolean {
  return enquiry.clientUserId === actor.userId
}

/**
 * Only musicians the matching engine alerted (and who haven't declined) may quote.
 *
 * @param actor - The signed-in musician.
 * @param match - The match row for this enquiry and the actor's profile, if any.
 * @returns True if the actor may send a quote.
 */
export function canQuote(
  actor: Actor,
  match: { profileId: string; declinedAt: Date | null } | undefined,
): boolean {
  return Boolean(match && actor.profileId === match.profileId && match.declinedAt === null)
}

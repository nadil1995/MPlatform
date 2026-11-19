import type { BookingStatus, EnquiryStatus, QuoteStatus } from '@thaala/shared'
import { AppError } from '../lib/errors'

/**
 * Allowed status transitions (docs/ARCHITECTURE.md "State machines").
 * Services must change status only through {@link assertTransition}.
 */
export const TRANSITIONS = {
  enquiry: {
    open: ['quoted', 'expired', 'cancelled'],
    quoted: ['booked', 'expired', 'cancelled'],
    booked: [],
    expired: [],
    cancelled: [],
  } satisfies Record<EnquiryStatus, readonly EnquiryStatus[]>,
  quote: {
    sent: ['accepted', 'declined', 'expired', 'withdrawn'],
    accepted: [],
    declined: [],
    expired: [],
    withdrawn: [],
  } satisfies Record<QuoteStatus, readonly QuoteStatus[]>,
  booking: {
    pending_payment: ['confirmed', 'cancelled_by_client', 'cancelled_by_musician'],
    confirmed: ['completed', 'cancelled_by_client', 'cancelled_by_musician', 'disputed'],
    completed: ['disputed'],
    cancelled_by_client: [],
    cancelled_by_musician: [],
    disputed: ['completed', 'cancelled_by_client', 'cancelled_by_musician'],
  } satisfies Record<BookingStatus, readonly BookingStatus[]>,
} as const

type Machine = keyof typeof TRANSITIONS
type StatusOf<M extends Machine> = keyof (typeof TRANSITIONS)[M] & string

/**
 * Check whether a status change is allowed.
 *
 * @param machine - Which state machine.
 * @param from - Current status.
 * @param to - Wanted status.
 * @returns True if `from → to` is a defined transition.
 */
export function canTransition<M extends Machine>(machine: M, from: StatusOf<M>, to: StatusOf<M>): boolean {
  const allowed = (TRANSITIONS[machine] as Record<string, readonly string[]>)[from]
  return allowed?.includes(to) ?? false
}

/**
 * Throw unless a status change is allowed.
 *
 * @param machine - Which state machine.
 * @param from - Current status.
 * @param to - Wanted status.
 * @throws {AppError} `CONFLICT` when the transition is not allowed (e.g. a stale screen).
 */
export function assertTransition<M extends Machine>(machine: M, from: StatusOf<M>, to: StatusOf<M>): void {
  if (!canTransition(machine, from, to)) throw new AppError('CONFLICT')
}

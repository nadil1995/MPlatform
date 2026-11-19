import {
  bigint,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { id, timestamps } from './columns'
import { bookingStatusEnum, reviewStatusEnum } from './enums'
import { musicianProfiles } from './profiles'
import { quotes } from './quotes'
import { users } from './users'

// Class: Internal. Amounts are copied from the quote at acceptance and never change.
export const bookings = pgTable(
  'bookings',
  {
    id: id(),
    quoteId: uuid()
      .notNull()
      .references(() => quotes.id),
    clientUserId: uuid()
      .notNull()
      .references(() => users.id),
    profileId: uuid()
      .notNull()
      .references(() => musicianProfiles.id),
    eventStartsAt: timestamp({ withTimezone: true }).notNull(),
    durationMin: integer().notNull(),
    totalCents: bigint({ mode: 'number' }).notNull(),
    depositCents: bigint({ mode: 'number' }).notNull(),
    balanceDueAt: timestamp({ withTimezone: true }).notNull(),
    status: bookingStatusEnum().notNull().default('pending_payment'),
    cancelledReason: text(),
    ...timestamps,
  },
  (t) => [
    // Security: one booking per quote, enforced by the database (no double booking).
    uniqueIndex('bookings_quote_key').on(t.quoteId),
    index('bookings_profile_starts_idx').on(t.profileId, t.eventStartsAt),
    index('bookings_status_starts_idx').on(t.status, t.eventStartsAt),
    index('bookings_client_idx').on(t.clientUserId),
  ],
)

// Class: Public (body) / PII (author). Only completed bookings may be reviewed (P5-01).
export const reviews = pgTable(
  'reviews',
  {
    id: id(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id),
    authorUserId: uuid()
      .notNull()
      .references(() => users.id),
    profileId: uuid()
      .notNull()
      .references(() => musicianProfiles.id),
    rating: smallint().notNull(),
    body: text().notNull(),
    status: reviewStatusEnum().notNull().default('published'),
    replyBody: text(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('reviews_booking_key').on(t.bookingId),
    index('reviews_profile_idx').on(t.profileId, t.createdAt.desc()),
    index('reviews_author_idx').on(t.authorUserId),
  ],
)

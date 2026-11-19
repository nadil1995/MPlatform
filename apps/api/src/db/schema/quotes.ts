import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { id, timestamps } from './columns'
import { quoteStatusEnum } from './enums'
import { enquiries } from './enquiries'
import { musicianProfiles } from './profiles'

// Class: Internal.
export const quotes = pgTable(
  'quotes',
  {
    id: id(),
    enquiryId: uuid()
      .notNull()
      .references(() => enquiries.id, { onDelete: 'cascade' }),
    profileId: uuid()
      .notNull()
      .references(() => musicianProfiles.id),
    priceCents: bigint({ mode: 'number' }).notNull(),
    durationMin: integer().notNull(),
    members: integer().notNull(),
    includesSound: boolean().notNull(),
    includesLights: boolean().notNull(),
    mustPlayKnown: integer(),
    message: text().notNull().default(''),
    status: quoteStatusEnum().notNull().default('sent'),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    // One quote per musician per enquiry.
    uniqueIndex('quotes_enquiry_profile_key').on(t.enquiryId, t.profileId),
    index('quotes_profile_status_idx').on(t.profileId, t.status),
  ],
)

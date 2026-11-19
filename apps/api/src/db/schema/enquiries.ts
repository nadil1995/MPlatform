import {
  bigint,
  date,
  index,
  integer,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { id, timestamps } from './columns'
import {
  budgetBandEnum,
  districtEnum,
  enquiryStatusEnum,
  guestRangeEnum,
  musicStyleEnum,
  occasionEnum,
  songLanguageEnum,
  soundSystemEnum,
} from './enums'
import { musicianProfiles } from './profiles'
import { users } from './users'

// Class: PII (venue_name, notes). Retention: 24 months after event date, then anonymised.
export const enquiries = pgTable(
  'enquiries',
  {
    id: id(),
    clientUserId: uuid()
      .notNull()
      .references(() => users.id),
    occasion: occasionEnum().notNull(),
    /** Calendar date and start time as typed, in Asia/Colombo. */
    eventDate: date({ mode: 'string' }).notNull(),
    startTime: time().notNull(),
    district: districtEnum().notNull(),
    venueName: text(),
    guestRange: guestRangeEnum().notNull(),
    budgetBand: budgetBandEnum().notNull(),
    budgetMinCents: bigint({ mode: 'number' }).notNull(),
    /** Null for the open-ended top band. */
    budgetMaxCents: bigint({ mode: 'number' }),
    musicStyles: musicStyleEnum().array().notNull(),
    languages: songLanguageEnum().array().notNull(),
    venueHasSound: soundSystemEnum().notNull(),
    notes: text(),
    status: enquiryStatusEnum().notNull().default('open'),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    index('enquiries_client_created_idx').on(t.clientUserId, t.createdAt.desc()),
    index('enquiries_status_date_idx').on(t.status, t.eventDate),
  ],
)

// Which musicians the matching engine picked for an enquiry. Class: Internal.
export type MusicianDistrict = (typeof districtEnum.enumValues)[number]

export const enquiryMatches = pgTable(
  'enquiry_matches',
  {
    id: id(),
    enquiryId: uuid()
      .notNull()
      .references(() => enquiries.id, { onDelete: 'cascade' }),
    profileId: uuid()
      .notNull()
      .references(() => musicianProfiles.id),
    /** 0–100. */
    score: integer().notNull(),
    notifiedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    declinedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('enquiry_matches_enquiry_profile_key').on(t.enquiryId, t.profileId),
    index('enquiry_matches_profile_notified_idx').on(t.profileId, t.notifiedAt.desc()),
  ],
)

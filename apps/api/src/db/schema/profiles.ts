import { sql } from 'drizzle-orm'
import {
  bigint,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  boolean,
} from 'drizzle-orm/pg-core'
import { id, timestamps } from './columns'
import { districtEnum, musicianTypeEnum, profileStatusEnum, songLanguageEnum } from './enums'
import { users } from './users'

// Class: Public. Only rows with status = 'live' are ever returned to the public.
export const musicianProfiles = pgTable(
  'musician_profiles',
  {
    id: id(),
    ownerUserId: uuid()
      .notNull()
      .references(() => users.id),
    stageName: text().notNull(),
    slug: text().notNull(),
    bio: text().notNull().default(''),
    type: musicianTypeEnum().notNull(),
    membersCount: integer().notNull().default(1),
    /** Home district first, then others they travel to. */
    districts: districtEnum().array().notNull(),
    languages: songLanguageEnum().array().notNull(),
    verifiedAt: timestamp({ withTimezone: true }),
    /** Rolling average; null until the first quote. */
    avgReplySeconds: integer(),
    ratingAvg: numeric({ precision: 3, scale: 2, mode: 'number' }).notNull().default(0),
    ratingCount: integer().notNull().default(0),
    /** Lowest service price, kept in sync by the profiles service for fast search sorting. */
    priceFromCents: bigint({ mode: 'number' }).notNull().default(0),
    status: profileStatusEnum().notNull().default('draft'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('musician_profiles_slug_key').on(t.slug),
    index('musician_profiles_owner_idx').on(t.ownerUserId),
    index('musician_profiles_districts_gin').using('gin', t.districts),
    index('musician_profiles_status_rating_idx').on(t.status, t.ratingAvg.desc()),
    index('musician_profiles_name_trgm').using('gin', sql`${t.stageName} gin_trgm_ops`),
  ],
)

// Packages a musician offers. Class: Public.
export const services = pgTable(
  'services',
  {
    id: id(),
    profileId: uuid()
      .notNull()
      .references(() => musicianProfiles.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text().notNull().default(''),
    durationMin: integer().notNull(),
    members: integer().notNull(),
    priceFromCents: bigint({ mode: 'number' }).notNull(),
    includesSound: boolean().notNull().default(false),
    includesLights: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [index('services_profile_idx').on(t.profileId)],
)

// Class: Public.
export const repertoireSongs = pgTable(
  'repertoire_songs',
  {
    id: id(),
    profileId: uuid()
      .notNull()
      .references(() => musicianProfiles.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    artist: text(),
    language: songLanguageEnum().notNull(),
    setName: text(),
    ...timestamps,
  },
  (t) => [
    index('repertoire_songs_profile_idx').on(t.profileId),
    // Trigram index: fuzzy title search works for Sinhala and Tamil script too.
    index('repertoire_songs_title_trgm').using('gin', sql`${t.title} gin_trgm_ops`),
  ],
)

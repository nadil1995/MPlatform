import {
  BOOKING_STATUSES,
  BUDGET_BANDS,
  DISTRICTS,
  ENQUIRY_STATUSES,
  GUEST_BANDS,
  LOCALES,
  MUSIC_STYLES,
  MUSICIAN_TYPES,
  OCCASIONS,
  QUOTE_STATUSES,
  SONG_LANGUAGES,
  SOUND_SYSTEM,
  USER_ROLES,
} from '@thaala/shared'
import { pgEnum } from 'drizzle-orm/pg-core'

// Postgres enums mirror the shared vocabularies, so the database rejects unknown values
// even if a bug skips validation. Adding a value needs a migration (ALTER TYPE … ADD VALUE).
export const userRoleEnum = pgEnum('user_role', USER_ROLES)
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'deleted'])
export const localeEnum = pgEnum('locale', LOCALES)
export const districtEnum = pgEnum('district', DISTRICTS)
export const musicianTypeEnum = pgEnum('musician_type', MUSICIAN_TYPES)
export const profileStatusEnum = pgEnum('profile_status', ['draft', 'pending_review', 'live', 'suspended'])
export const songLanguageEnum = pgEnum('song_language', [...SONG_LANGUAGES, 'instrumental'])
export const occasionEnum = pgEnum('occasion', OCCASIONS)
export const guestRangeEnum = pgEnum('guest_range', GUEST_BANDS)
export const budgetBandEnum = pgEnum('budget_band', BUDGET_BANDS)
export const musicStyleEnum = pgEnum('music_style', MUSIC_STYLES)
export const soundSystemEnum = pgEnum('sound_system', SOUND_SYSTEM)
export const enquiryStatusEnum = pgEnum('enquiry_status', ENQUIRY_STATUSES)
export const quoteStatusEnum = pgEnum('quote_status', QUOTE_STATUSES)
export const bookingStatusEnum = pgEnum('booking_status', BOOKING_STATUSES)
export const reviewStatusEnum = pgEnum('review_status', ['pending', 'published', 'hidden'])

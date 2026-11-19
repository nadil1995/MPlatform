/**
 * Fixed vocabularies shared by the API, web and mobile apps.
 *
 * Ids are stored in the database and used in URLs, so never rename one; add new ones.
 * Display names live in i18n.
 */
import type { Category } from './search'
import type { BUDGET_BANDS, MUSIC_STYLES } from './enquiry'

/** What kind of act a musician profile is (`musicianTypes.<id>` in i18n). */
export const MUSICIAN_TYPES = [
  'weddingBand',
  'bailaBand',
  'djMc',
  'soloSinger',
  'traditionalDrummers',
  'stringEnsemble',
  'choir',
  'musicTeacher',
] as const
export type MusicianType = (typeof MUSICIAN_TYPES)[number]

/** Which profile types each browse category shows. */
export const CATEGORY_TYPES: Readonly<Record<Category, readonly MusicianType[]>> = {
  weddingBands: ['weddingBand', 'bailaBand'],
  singers: ['soloSinger'],
  djs: ['djMc'],
  bailaBands: ['bailaBand'],
  traditionalDrummers: ['traditionalDrummers'],
  stringEnsembles: ['stringEnsemble'],
  choirs: ['choir'],
  musicTeachers: ['musicTeacher'],
}

/** Which profile types can serve each music style a client asks for in an enquiry. */
export const STYLE_TYPES: Readonly<Record<(typeof MUSIC_STYLES)[number], readonly MusicianType[]>> = {
  liveBand: ['weddingBand', 'bailaBand'],
  dj: ['djMc'],
  soloSinger: ['soloSinger'],
  traditionalDrummers: ['traditionalDrummers'],
  stringEnsemble: ['stringEnsemble'],
  choir: ['choir'],
}

/**
 * Budget bands as cent ranges. `max` is null for the open-ended top band.
 * Stored on the enquiry as min/max so matching can compare against prices.
 */
export const BUDGET_BAND_RANGES: Readonly<
  Record<(typeof BUDGET_BANDS)[number], { minCents: number; maxCents: number | null }>
> = {
  under50k: { minCents: 0, maxCents: 5_000_000 },
  '50kTo150k': { minCents: 5_000_000, maxCents: 15_000_000 },
  '150kTo300k': { minCents: 15_000_000, maxCents: 30_000_000 },
  over300k: { minCents: 30_000_000, maxCents: null },
}

/** Enquiry lifecycle (docs/ARCHITECTURE.md "State machines"). */
export const ENQUIRY_STATUSES = ['open', 'quoted', 'booked', 'expired', 'cancelled'] as const
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number]

export const QUOTE_STATUSES = ['sent', 'accepted', 'declined', 'expired', 'withdrawn'] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export const BOOKING_STATUSES = [
  'pending_payment',
  'confirmed',
  'completed',
  'cancelled_by_client',
  'cancelled_by_musician',
  'disputed',
] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export const USER_ROLES = ['client', 'musician', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

/** Days before the event that the balance is due (shown at checkout). */
export const BALANCE_DUE_DAYS_BEFORE = 7

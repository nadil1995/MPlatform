/**
 * Shared Zod schema for the "Post your event" (enquiry) form.
 *
 * The web form and the API (P2-03) validate with this same schema so the rules can
 * never drift. Error messages are i18n keys under `enquiry.errors`, not English text.
 */
import { z } from 'zod'
import { DISTRICTS } from './districts'

export const OCCASIONS = ['wedding', 'homecoming', 'corporate', 'birthday', 'religious', 'other'] as const
export const MUSIC_STYLES = [
  'liveBand',
  'dj',
  'soloSinger',
  'traditionalDrummers',
  'stringEnsemble',
  'choir',
] as const
export const SONG_LANGUAGES = ['si', 'en', 'ta'] as const
export const GUEST_BANDS = ['under50', '50to150', '150to250', 'over250'] as const
export const SOUND_SYSTEM = ['yes', 'no', 'notSure'] as const
export const BUDGET_BANDS = ['under50k', '50kTo150k', '150kTo300k', 'over300k'] as const

/** Longest free-text note we accept; enough for a song list, small enough to scan for contact details. */
export const ENQUIRY_NOTES_MAX = 1000

export const enquiryDraftSchema = z.object({
  occasion: z.enum(OCCASIONS, { error: 'occasionRequired' }),
  // ISO calendar date (YYYY-MM-DD) in Asia/Colombo. "Not in the past" is checked by the
  // API against the server clock; the client clock cannot be trusted.
  eventDate: z.iso.date({ error: 'dateRequired' }),
  startTime: z.iso.time({ precision: -1, error: 'timeRequired' }),
  district: z.enum(DISTRICTS, { error: 'districtRequired' }),
  guests: z.enum(GUEST_BANDS, { error: 'guestsRequired' }),
  venue: z.string().trim().max(120, { error: 'venueTooLong' }).optional(),
  musicStyles: z.array(z.enum(MUSIC_STYLES)).min(1, { error: 'styleRequired' }),
  songLanguages: z.array(z.enum(SONG_LANGUAGES)).min(1, { error: 'languageRequired' }),
  venueHasSound: z.enum(SOUND_SYSTEM, { error: 'soundRequired' }),
  budget: z.enum(BUDGET_BANDS, { error: 'budgetRequired' }),
  notes: z.string().trim().max(ENQUIRY_NOTES_MAX, { error: 'notesTooLong' }).optional(),
})

export type EnquiryDraft = z.infer<typeof enquiryDraftSchema>

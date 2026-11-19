/**
 * Shared Zod schema for musician search query parameters.
 *
 * The web search page parses its URL with this, and the public search API (P2-01) will
 * too, so filters behave the same everywhere.
 */
import { z } from 'zod'
import { DISTRICTS } from './districts'
import { SONG_LANGUAGES } from './enquiry'

/** Browse categories. Ids are used in URLs and i18n keys (`categories.<id>`). */
export const CATEGORIES = [
  'weddingBands',
  'singers',
  'djs',
  'bailaBands',
  'traditionalDrummers',
  'stringEnsembles',
  'choirs',
  'musicTeachers',
] as const
export type Category = (typeof CATEGORIES)[number]

export const SEARCH_SORTS = ['bestMatch', 'topRated', 'lowestPrice', 'fastestReply'] as const
export type SearchSort = (typeof SEARCH_SORTS)[number]

/** Budget ceilings offered in the filter, in whole rupees. */
export const BUDGET_CEILINGS_LKR = [50_000, 100_000, 150_000, 300_000] as const

/**
 * Normalise a query value that may appear once, many times or not at all.
 *
 * @param v - The raw value from `URLSearchParams` / Next.js `searchParams`.
 * @returns An array (empty when the param is missing).
 */
const toArray = (v: unknown): unknown[] => (v === undefined ? [] : Array.isArray(v) ? v : [v])

// Security: every field uses `.catch()` so a hand-edited or malicious URL falls back to
// a safe default instead of throwing a 500. Unknown values are dropped, never echoed.
export const musicianSearchQuerySchema = z.object({
  type: z.preprocess(toArray, z.array(z.enum(CATEGORIES)).max(CATEGORIES.length)).catch([]),
  district: z.enum(DISTRICTS).optional().catch(undefined),
  lang: z.preprocess(toArray, z.array(z.enum(SONG_LANGUAGES)).max(SONG_LANGUAGES.length)).catch([]),
  maxBudget: z.coerce
    .number()
    .int()
    .refine((n) => (BUDGET_CEILINGS_LKR as readonly number[]).includes(n))
    .optional()
    .catch(undefined),
  date: z.iso.date().optional().catch(undefined),
  verified: z
    .enum(['1'])
    .transform(() => true)
    .optional()
    .catch(undefined),
  sort: z.enum(SEARCH_SORTS).catch('bestMatch'),
  q: z.string().trim().max(80).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
  // Security: page size is capped so one request can't dump the whole catalogue.
  pageSize: z.coerce.number().int().min(1).max(50).catch(24),
})

export type MusicianSearchQuery = z.infer<typeof musicianSearchQuerySchema>

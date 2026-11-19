import { z } from 'zod'
import { MUSICIAN_TYPES } from '../catalog'
import { DISTRICTS } from '../districts'
import { OCCASIONS, SONG_LANGUAGES } from '../enquiry'
import { paginated } from './common'

/** A musician as shown on cards (search, home). Public data only. */
export const musicianSummarySchema = z.object({
  slug: z.string(),
  name: z.string(),
  type: z.enum(MUSICIAN_TYPES),
  district: z.enum(DISTRICTS),
  playsIn: z.array(z.enum(DISTRICTS)),
  languages: z.array(z.enum(SONG_LANGUAGES)),
  rating: z.number().min(0).max(5),
  reviews: z.number().int().nonnegative(),
  priceFromCents: z.number().int().nonnegative(),
  /** Average reply time in whole hours, rounded up; null until they have replied once. */
  replyHours: z.number().int().positive().nullable(),
  verified: z.boolean(),
  members: z.number().int().positive(),
})
export type MusicianSummary = z.infer<typeof musicianSummarySchema>

export const musicianSearchResultSchema = paginated(musicianSummarySchema)
export type MusicianSearchResult = z.infer<typeof musicianSearchResultSchema>

export const songSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  language: z.enum([...SONG_LANGUAGES, 'instrumental']),
  setName: z.string().nullable(),
})

export const reviewSchema = z.object({
  id: z.uuid(),
  /** "Dilani P." — first name and initial only. */
  author: z.string(),
  occasion: z.enum(OCCASIONS),
  district: z.enum(DISTRICTS),
  /** ISO date of the event, for "Verified booking · Jan 2026". */
  eventDate: z.string(),
  rating: z.number().int().min(1).max(5),
  body: z.string(),
  reply: z.string().nullable(),
})

export const packageSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  priceFromCents: z.number().int().nonnegative(),
})

export const musicianProfileSchema = musicianSummarySchema.extend({
  bio: z.string(),
  packages: z.array(packageSchema),
  songs: z.array(songSchema),
  reviewList: z.array(reviewSchema),
})
export type MusicianProfile = z.infer<typeof musicianProfileSchema>

export const songSearchQuerySchema = z.object({ q: z.string().trim().max(80).optional().catch(undefined) })

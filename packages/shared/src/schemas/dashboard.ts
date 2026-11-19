import { z } from 'zod'
import { BUDGET_BANDS, GUEST_BANDS, OCCASIONS } from '../enquiry'
import { DISTRICTS } from '../districts'

/** An enquiry as a matched musician sees it: no client identity, no notes, no venue. */
export const matchedEnquirySchema = z.object({
  enquiryId: z.uuid(),
  occasion: z.enum(OCCASIONS),
  startsAt: z.string(),
  district: z.enum(DISTRICTS),
  guests: z.enum(GUEST_BANDS),
  budget: z.enum(BUDGET_BANDS),
  /** Match score 0–100 from the matching engine. */
  score: z.number().int().min(0).max(100),
  notifiedAt: z.string(),
})

export const gigSchema = z.object({
  bookingId: z.uuid(),
  startsAt: z.string(),
  occasion: z.enum(OCCASIONS),
  /** Venue name, or null (the page then shows the district). */
  venue: z.string().nullable(),
  district: z.enum(DISTRICTS),
  totalCents: z.number().int().nonnegative(),
})

export const musicianDashboardSchema = z.object({
  name: z.string(),
  slug: z.string(),
  status: z.enum(['draft', 'pending_review', 'live', 'suspended']),
  verified: z.boolean(),
  averageReplyMinutes: z.number().int().nonnegative().nullable(),
  quotesWaiting: z.number().int().nonnegative(),
  dueCents: z.number().int().nonnegative(),
  newEnquiries: z.array(matchedEnquirySchema),
  upcomingGigs: z.array(gigSchema),
})
export type MusicianDashboard = z.infer<typeof musicianDashboardSchema>

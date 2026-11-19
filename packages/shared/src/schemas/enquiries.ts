import { z } from 'zod'
import { ENQUIRY_STATUSES } from '../catalog'
import { DISTRICTS } from '../districts'
import { BUDGET_BANDS, GUEST_BANDS, MUSIC_STYLES, OCCASIONS } from '../enquiry'

/** An enquiry as its owner (the client) sees it. */
export const enquirySchema = z.object({
  id: z.uuid(),
  occasion: z.enum(OCCASIONS),
  /** Event start as an ISO instant (Asia/Colombo date + start time). */
  startsAt: z.string(),
  district: z.enum(DISTRICTS),
  guests: z.enum(GUEST_BANDS),
  musicStyles: z.array(z.enum(MUSIC_STYLES)),
  budget: z.enum(BUDGET_BANDS),
  venue: z.string().nullable(),
  status: z.enum(ENQUIRY_STATUSES),
  quoteCount: z.number().int().nonnegative(),
  matchedCount: z.number().int().nonnegative(),
  createdAt: z.string(),
})
export type Enquiry = z.infer<typeof enquirySchema>

export const enquiryListSchema = z.object({ items: z.array(enquirySchema) })

export const createdEnquirySchema = z.object({ id: z.uuid(), matchedCount: z.number().int().nonnegative() })

import { z } from 'zod'
import { QUOTE_STATUSES } from '../catalog'
import { ENQUIRY_NOTES_MAX } from '../enquiry'
import { enquirySchema } from './enquiries'

export const QUOTE_SORTS = ['bestMatch', 'price', 'rating'] as const
export type QuoteSort = (typeof QUOTE_SORTS)[number]

export const quoteSchema = z.object({
  id: z.uuid(),
  musicianSlug: z.string(),
  musicianName: z.string(),
  rating: z.number(),
  reviews: z.number().int(),
  priceCents: z.number().int().nonnegative(),
  durationMinutes: z.number().int().positive(),
  members: z.number().int().positive(),
  includesSound: z.boolean(),
  includesLights: z.boolean(),
  /** How many of the client's must-play songs the musician says they know; null if not stated. */
  mustPlayKnown: z.number().int().nonnegative().nullable(),
  /** Minutes between the musician being alerted and sending the quote. */
  replyMinutes: z.number().int().nonnegative(),
  bestMatch: z.boolean(),
  message: z.string(),
  status: z.enum(QUOTE_STATUSES),
})
export type Quote = z.infer<typeof quoteSchema>

export const enquiryWithQuotesSchema = z.object({ enquiry: enquirySchema, quotes: z.array(quoteSchema) })
export type EnquiryWithQuotes = z.infer<typeof enquiryWithQuotesSchema>

/** Body a musician sends to quote. Price is theirs to set; the deposit is not. */
export const createQuoteSchema = z
  .object({
    priceCents: z
      .number()
      .int()
      .min(100_000, { error: 'priceTooLow' })
      .max(1_000_000_000, { error: 'priceTooHigh' }),
    durationMinutes: z
      .number()
      .int()
      .min(15)
      .max(24 * 60),
    members: z.number().int().min(1).max(100),
    includesSound: z.boolean(),
    includesLights: z.boolean(),
    mustPlayKnown: z.number().int().min(0).max(200).nullable(),
    message: z.string().trim().max(ENQUIRY_NOTES_MAX),
  })
  .strict()
export type CreateQuote = z.infer<typeof createQuoteSchema>

/** Everything checkout shows. Every amount is computed by the API from stored prices. */
export const checkoutSummarySchema = z.object({
  quoteId: z.uuid(),
  enquiryId: z.uuid(),
  musicianName: z.string(),
  musicianSlug: z.string(),
  musicians: z.number().int().positive(),
  includesSound: z.boolean(),
  includesLights: z.boolean(),
  startsAt: z.string(),
  durationMinutes: z.number().int().positive(),
  district: enquirySchema.shape.district,
  totalCents: z.number().int().nonnegative(),
  depositCents: z.number().int().nonnegative(),
  balanceCents: z.number().int().nonnegative(),
  balanceDueAt: z.string(),
  quoteStatus: z.enum(QUOTE_STATUSES),
})
export type CheckoutSummary = z.infer<typeof checkoutSummarySchema>

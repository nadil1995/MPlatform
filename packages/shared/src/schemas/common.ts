import { z } from 'zod'

/** Standard error body (docs/SECURITY.md §4). Never contains stack traces or internal ids. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    /** Field-level validation issues, as i18n keys (e.g. `styleRequired`). */
    fields: z.record(z.string(), z.string()).optional(),
  }),
})
export type ApiError = z.infer<typeof apiErrorSchema>

export const uuidSchema = z.uuid()

/**
 * Pagination envelope. `pageSize` is capped at 50 by the API.
 *
 * @param item - Schema for one item.
 * @returns Schema for `{ items, total, page }`.
 */
export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), total: z.number().int().nonnegative(), page: z.number().int().positive() })

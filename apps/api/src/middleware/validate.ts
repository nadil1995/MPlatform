import type { Context } from 'hono'
import type { z } from 'zod'
import { AppError } from '../lib/errors'

/**
 * Turn Zod issues into `{ fieldPath: messageKey }` for the standard error body.
 *
 * @param error - The Zod error.
 * @returns One message per field (first issue wins).
 */
function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    out[key] ??= issue.message
  }
  return out
}

/**
 * Parse and validate a JSON body against a shared schema.
 *
 * @param c - Hono context.
 * @param schema - Zod schema from `@thaala/shared`.
 * @returns The validated, typed body.
 * @throws {AppError} `VALIDATION_FAILED` with field errors, or for malformed JSON.
 */
export async function jsonBody<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    throw new AppError('VALIDATION_FAILED', { _: 'invalidJson' })
  }
  const result = schema.safeParse(raw)
  if (!result.success) throw new AppError('VALIDATION_FAILED', fieldErrors(result.error))
  return result.data
}

/**
 * Validate a value already pulled from the request (params, query).
 *
 * @param value - The untrusted value.
 * @param schema - Zod schema.
 * @returns The validated value.
 * @throws {AppError} `NOT_FOUND` for malformed path ids (so ids aren't probed),
 *   `VALIDATION_FAILED` otherwise.
 */
export function parseOr404<T extends z.ZodType>(value: unknown, schema: T): z.infer<T> {
  const result = schema.safeParse(value)
  if (!result.success) throw new AppError('NOT_FOUND')
  return result.data
}

/**
 * Validate query parameters (multi-valued keys become arrays).
 *
 * @param c - Hono context.
 * @param schema - Zod schema; use `.catch()` per field to fall back instead of failing.
 * @returns The validated query.
 * @throws {AppError} `VALIDATION_FAILED` if the schema rejects it.
 */
export function query<T extends z.ZodType>(c: Context, schema: T): z.infer<T> {
  const raw: Record<string, string | string[]> = {}
  for (const [k, v] of Object.entries(c.req.queries())) raw[k] = v.length === 1 ? (v[0] ?? '') : v
  const result = schema.safeParse(raw)
  if (!result.success) throw new AppError('VALIDATION_FAILED', fieldErrors(result.error))
  return result.data
}

import 'server-only'
import {
  checkoutSummarySchema,
  createdEnquirySchema,
  devSessionSchema,
  devUserListSchema,
  enquiryListSchema,
  enquiryWithQuotesSchema,
  meSchema,
  musicianDashboardSchema,
  musicianProfileSchema,
  musicianSearchResultSchema,
  apiErrorSchema,
  type EnquiryDraft,
  type MusicianSearchQuery,
  type QuoteSort,
} from '@thaala/shared'
import { cache } from 'react'
import { z } from 'zod'
import { env } from './env'
import { getAccessToken } from './session'

/** An error response from the API, already validated against the standard shape. */
export class ApiError extends Error {
  /**
   * Wrap an API error response.
   *
   * @param status - HTTP status.
   * @param code - API error code (e.g. `NOT_FOUND`).
   * @param requestId - For support; shown on error screens.
   * @param fields - Per-field i18n keys for validation errors.
   */
  constructor(
    readonly status: number,
    readonly code: string,
    readonly requestId: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(code)
    this.name = 'ApiError'
  }
}

type CallOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
  /** Send the signed-in user's token. Defaults to true when a session exists. */
  auth?: boolean
}

/**
 * Call the API from the server and validate the response.
 *
 * @param path - API path, e.g. `/v1/musicians`. Built only from validated values.
 * @param schema - Zod schema the response must match (a contract check, not trust).
 * @param opts - Method, JSON body and whether to attach the token.
 * @returns The parsed body.
 * @throws {ApiError} For any non-2xx response (or a malformed error body).
 *
 * @remarks
 * Security: runs on the server only (`server-only`). The token comes from the encrypted
 * cookie and is never sent to the browser. Responses are not cached across users.
 */
async function call<T extends z.ZodType>(
  path: string,
  schema: T,
  opts: CallOptions = {},
): Promise<z.infer<T>> {
  const token = opts.auth === false ? null : await getAccessToken()
  const res = await fetch(new URL(path, env().API_URL), {
    method: opts.method ?? 'GET',
    headers: {
      accept: 'application/json',
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (res.status === 204) return schema.parse(undefined)
  const json: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const err = apiErrorSchema.safeParse(json)
    if (err.success) {
      throw new ApiError(res.status, err.data.error.code, err.data.error.requestId, err.data.error.fields)
    }
    throw new ApiError(res.status, 'INTERNAL', res.headers.get('x-request-id') ?? 'unknown')
  }
  return schema.parse(json)
}

/**
 * Return null instead of throwing for a 404, so pages can call `notFound()`.
 *
 * @param p - The API call.
 * @returns The result, or null when the API said NOT_FOUND.
 * @throws {ApiError} For every other error.
 */
async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}

/**
 * Serialise a search query into URL parameters (arrays become repeated keys).
 *
 * @param q - Validated search query.
 * @returns The query string, without `?`.
 */
function searchParams(q: Partial<MusicianSearchQuery>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === false) continue
    if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)))
    else p.set(k, v === true ? '1' : String(v))
  }
  return p.toString()
}

/** Typed API client used by server components and server actions. */
export const api = {
  searchMusicians: (q: Partial<MusicianSearchQuery>) =>
    call(`/v1/musicians?${searchParams(q)}`, musicianSearchResultSchema, { auth: false }),
  getMusician: (slug: string, songQuery?: string) =>
    orNull(
      call(
        `/v1/musicians/${encodeURIComponent(slug)}${songQuery ? `?q=${encodeURIComponent(songQuery)}` : ''}`,
        musicianProfileSchema,
        { auth: false },
      ),
    ),
  /** Cached per request: the header and the page can both ask without two API calls. */
  me: cache(async () => {
    if (!(await getAccessToken())) return null
    try {
      return await call('/v1/me', meSchema)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null
      throw e
    }
  }),
  myEnquiries: () => call('/v1/enquiries', enquiryListSchema),
  createEnquiry: (body: EnquiryDraft) =>
    call('/v1/enquiries', createdEnquirySchema, { method: 'POST', body }),
  enquiryQuotes: (id: string, sort: QuoteSort) =>
    orNull(call(`/v1/enquiries/${encodeURIComponent(id)}/quotes?sort=${sort}`, enquiryWithQuotesSchema)),
  checkout: (quoteId: string) =>
    orNull(call(`/v1/quotes/${encodeURIComponent(quoteId)}/checkout`, checkoutSummarySchema)),
  dashboard: () => call('/v1/musician/dashboard', musicianDashboardSchema),
  declineEnquiry: (id: string) =>
    call(`/v1/enquiries/${encodeURIComponent(id)}/decline`, z.undefined(), { method: 'POST' }),
  devUsers: () => call('/v1/dev/users', devUserListSchema, { auth: false }),
  devSession: (userId: string) =>
    call('/v1/dev/session', devSessionSchema, { method: 'POST', body: { userId }, auth: false }),
}

import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * Every error code the API can return, mapped to its HTTP status in one place.
 * Messages are generic English; clients translate by `code`.
 */
export const ERROR_CODES = {
  VALIDATION_FAILED: { status: 400, message: 'Some fields are not valid.' },
  UNAUTHENTICATED: { status: 401, message: 'Please sign in.' },
  FORBIDDEN: { status: 403, message: 'You cannot do that.' },
  NOT_FOUND: { status: 404, message: 'Not found.' },
  CONFLICT: { status: 409, message: 'That has changed. Refresh and try again.' },
  QUOTE_NOT_ACCEPTABLE: { status: 409, message: 'This quote can no longer be accepted.' },
  ALREADY_QUOTED: { status: 409, message: 'You have already quoted for this event.' },
  ENQUIRY_CLOSED: { status: 409, message: 'This enquiry is no longer open.' },
  PAYLOAD_TOO_LARGE: { status: 413, message: 'Request too large.' },
  RATE_LIMITED: { status: 429, message: 'Too many requests. Try again later.' },
  INTERNAL: { status: 500, message: 'Something went wrong.' },
} as const satisfies Record<string, { status: ContentfulStatusCode; message: string }>

export type ErrorCode = keyof typeof ERROR_CODES

/** An expected failure with a known code. Anything else becomes `INTERNAL`. */
export class AppError extends Error {
  /**
   * Create an expected error.
   *
   * @param code - One of {@link ERROR_CODES}.
   * @param fields - Optional per-field i18n keys for validation errors.
   */
  constructor(
    readonly code: ErrorCode,
    readonly fields?: Record<string, string>,
  ) {
    super(code)
    this.name = 'AppError'
  }
}

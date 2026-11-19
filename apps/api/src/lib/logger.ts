import { pino, type Logger } from 'pino'

/**
 * Fields that may hold personal data or secrets. pino replaces them with "[REDACTED]".
 *
 * CLAUDE.md rule 10: any new PII field must be added here in the same change.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.authorization',
  '*.cookie',
  '*.accessToken',
  '*.token',
  '*.password',
  '*.secret',
  '*.phone',
  '*.phoneE164',
  '*.phone_e164',
  '*.email',
  '*.displayName',
  '*.display_name',
  '*.venue',
  '*.venueName',
  '*.venue_name',
  '*.notes',
  '*.message',
  '*.body',
  '*.ip',
]

/**
 * Create the shared logger.
 *
 * @param level - Minimum level to emit.
 * @returns A pino logger with PII redaction. Output is JSON for CloudWatch.
 */
export function createLogger(level: string): Logger {
  return pino({
    level,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    base: { service: 'thaala-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
  })
}

/**
 * Date formatting in the platform's time zone.
 *
 * Every event happens in Sri Lanka, so dates are always shown in `Asia/Colombo`
 * regardless of where the viewer is (docs/UX_GUIDELINES.md "Formatting").
 */

export const PLATFORM_TIME_ZONE = 'Asia/Colombo'

/**
 * Format an event date as `Sat, 13 Feb 2027`.
 *
 * @param date - The instant to format (a `Date` or an ISO-8601 string with offset).
 * @param locale - BCP 47 locale for weekday and month names. Defaults to English.
 * @returns The formatted date in Asia/Colombo.
 * @throws {RangeError} When `date` is not a valid date.
 */
export function formatEventDate(date: Date | string, locale = 'en'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) throw new RangeError('Invalid date')
  const parts = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
    timeZone: PLATFORM_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(d)
  if (locale !== 'en') {
    return parts.map((p) => p.value).join('')
  }
  // en-GB gives "Sat 13 Feb 2027"; the style guide wants a comma after the weekday.
  /**
   * Pick one part of the formatted date.
   *
   * @param type - The part to find.
   * @returns Its text, or an empty string if the locale omits it.
   */
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('weekday')}, ${get('day')} ${get('month')} ${get('year')}`
}

/**
 * Format a time of day as `7:00 pm`.
 *
 * @param date - The instant to format.
 * @returns Lower-case 12-hour time in Asia/Colombo.
 * @throws {RangeError} When `date` is not a valid date.
 */
export function formatEventTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) throw new RangeError('Invalid date')
  return new Intl.DateTimeFormat('en-US', {
    timeZone: PLATFORM_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(d)
    .replace('AM', 'am')
    .replace('PM', 'pm')
}

/**
 * Turn an event's calendar date and start time into an ISO instant.
 *
 * Enquiries store the date and time the client typed, which are always Sri Lankan local
 * time. Sri Lanka has no daylight saving, so the offset is a fixed +05:30.
 *
 * @param date - `YYYY-MM-DD`.
 * @param time - `HH:MM` or `HH:MM:SS` (24-hour).
 * @returns The instant in UTC, e.g. `2027-02-13T13:30:00.000Z`.
 * @throws {RangeError} When the inputs do not form a valid date and time.
 */
export function colomboInstant(date: string, time: string): string {
  const hhmm = time.slice(0, 5)
  const d = new Date(`${date}T${hhmm}:00+05:30`)
  if (Number.isNaN(d.getTime())) throw new RangeError('Invalid date or time')
  return d.toISOString()
}

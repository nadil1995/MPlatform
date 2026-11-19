import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { PLATFORM_TIME_ZONE } from '@thaala/shared'
import { routing } from './routing'

/**
 * Load the messages for the locale of the current request.
 *
 * @param params - Provided by next-intl; `requestLocale` comes from the URL segment.
 * @returns The locale, its messages and the platform time zone.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  // Security: only the three known locales are ever used to build an import path.
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
  const messages = (await import(`@thaala/shared/i18n/${locale}.json`)) as {
    default: Record<string, unknown>
  }
  return {
    locale,
    messages: messages.default,
    // Events happen in Sri Lanka, so times are always shown in Colombo time.
    timeZone: PLATFORM_TIME_ZONE,
  }
})

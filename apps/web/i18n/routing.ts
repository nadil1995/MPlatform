import { DEFAULT_LOCALE, LOCALES } from '@thaala/shared'
import { defineRouting } from 'next-intl/routing'

// Every URL carries its locale (/en, /si, /ta) so search engines index each language.
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
})

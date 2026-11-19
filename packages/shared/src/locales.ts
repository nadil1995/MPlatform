/** Supported UI languages. English is the default because it is understood island-wide. */
export const LOCALES = ['en', 'si', 'ta'] as const
export const DEFAULT_LOCALE = 'en'
export type Locale = (typeof LOCALES)[number]

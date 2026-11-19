'use client'

import type { Locale } from '@thaala/shared'
import { cn } from '@thaala/ui'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Link, usePathname } from '@/i18n/navigation'

// Each language's own name in its own script, so people can find theirs.
const OPTIONS: readonly { locale: Locale; short: string; font: string }[] = [
  { locale: 'en', short: 'EN', font: '' },
  { locale: 'si', short: 'සිං', font: 'font-sinhala' },
  { locale: 'ta', short: 'தமி', font: 'font-tamil' },
]

/**
 * EN · සිං · தமி switcher that keeps the user on the same page and query.
 *
 * Links rather than a menu, so it works before JavaScript loads on slow connections.
 * Saving the choice per user comes with accounts (P1-02); until then the URL is the choice.
 *
 * @returns A labelled group of three language links.
 */
export function LanguageSwitcher() {
  const t = useTranslations('header')
  const current = useLocale()
  const pathname = usePathname()
  const search = useSearchParams()
  const query = Object.fromEntries(search.entries())

  return (
    <nav
      aria-label={t('language')}
      className="hidden h-11 items-center gap-1 rounded-full border border-gray-300 px-2 text-sm font-semibold sm:flex"
    >
      {OPTIONS.map(({ locale: loc, short, font }, i) => (
        <span key={loc} className="flex items-center gap-1">
          {i > 0 && (
            <span aria-hidden className="text-gray-400">
              ·
            </span>
          )}
          <Link
            href={{ pathname, query }}
            locale={loc}
            lang={loc}
            aria-current={loc === current ? 'true' : undefined}
            className={cn(
              'rounded-full px-1.5 py-1',
              font,
              loc === current
                ? 'text-brand-700 underline underline-offset-4'
                : 'text-gray-700 hover:text-brand-600',
            )}
          >
            {short}
          </Link>
        </span>
      ))}
    </nav>
  )
}

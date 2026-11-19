import { useTranslations } from 'next-intl'

/**
 * Footer with brand and legal links.
 *
 * Links are plain text until the About/Help/Terms/Privacy pages exist (P5-06 legal review).
 *
 * @returns The footer element.
 */
export function SiteFooter() {
  const t = useTranslations('footer')
  const tc = useTranslations('common')
  return (
    <footer className="border-t border-gray-200">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-gray-600 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        <span className="font-display font-bold text-brand-600">{tc('brand')}</span>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          <li>{t('about')}</li>
          <li>{t('help')}</li>
          <li>{t('terms')}</li>
          <li>{t('privacy')}</li>
        </ul>
      </div>
    </footer>
  )
}

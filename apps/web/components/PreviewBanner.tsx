import { useTranslations } from 'next-intl'

/**
 * Thin banner saying this environment runs on synthetic test data.
 *
 * Shown everywhere except production, so nobody mistakes a dev or staging booking for
 * a real one.
 *
 * @returns The banner, or nothing in production.
 */
export function PreviewBanner() {
  const t = useTranslations('common')
  // Production shows real data, so the banner would be wrong there.
  if (process.env.NEXT_PUBLIC_ENV === 'production') return null
  return (
    <div role="note" className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      {t('previewBanner')}
    </div>
  )
}

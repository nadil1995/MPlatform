'use client'

import { buttonClasses } from '@thaala/ui'
import { useTranslations } from 'next-intl'

type Props = { error: Error & { digest?: string }; reset: () => void }

/**
 * Error boundary for every localised page.
 *
 * Shows a friendly message, a retry button and the error digest as a reference for
 * support (docs/UX_GUIDELINES.md "Error"). It never shows the error message itself,
 * which could leak internals.
 *
 * @param props - The error (only `digest` is shown) and Next's `reset` callback.
 * @returns The error screen.
 */
export default function ErrorPage({ error, reset }: Props) {
  const t = useTranslations('common')
  return (
    <div role="alert" className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="font-display text-3xl font-bold">{t('errorTitle')}</h1>
      <p className="text-gray-600">{t('errorBody')}</p>
      <button type="button" onClick={reset} className={buttonClasses('primary', 'lg')}>
        {t('retry')}
      </button>
      {error.digest && <p className="text-xs text-gray-600">{t('reference', { id: error.digest })}</p>}
    </div>
  )
}

import { buttonClasses } from '@thaala/ui'
import { useTranslations } from 'next-intl'
import { ClientShell } from '@/components/ClientShell'
import { Link } from '@/i18n/navigation'

/**
 * Localised 404 page.
 *
 * @returns A friendly message and a way home.
 */
export default function NotFound() {
  const t = useTranslations('common')
  return (
    <ClientShell>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-bold">{t('notFoundTitle')}</h1>
        <p className="text-gray-600">{t('notFoundBody')}</p>
        <Link href="/" className={buttonClasses('primary', 'lg')}>
          {t('goHome')}
        </Link>
      </div>
    </ClientShell>
  )
}

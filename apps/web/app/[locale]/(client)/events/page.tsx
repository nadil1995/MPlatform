import { formatEventDate, formatEventTime, type EnquiryStatus } from '@thaala/shared'
import { buttonClasses, cn } from '@thaala/ui'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { api } from '@/lib/api'
import { withSession } from '@/lib/page-auth'

type Props = { params: Promise<{ locale: string }> }

/**
 * Page title.
 *
 * @param props - Route params.
 * @returns Metadata (never indexed).
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'events' })
  return { title: t('metaTitle'), robots: { index: false } }
}

/**
 * Badge colours: teal when the client has something to act on, grey when it's closed.
 *
 * @param status - Enquiry status.
 * @returns Tailwind classes.
 */
function statusStyle(status: EnquiryStatus): string {
  switch (status) {
    case 'quoted':
      return 'bg-brand-50 text-brand-900'
    case 'booked':
      return 'bg-brand-600 text-white'
    case 'open':
      return 'bg-gray-100 text-gray-800'
    case 'expired':
    case 'cancelled':
      return 'bg-gray-100 text-gray-600'
  }
}

/**
 * The client's posted events ("Enquiries" tab in the app flow), newest first.
 *
 * @param props - Route params.
 * @returns The list, or an empty state with a call to post an event.
 */
export default async function MyEventsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()
  const { items } = await withSession(locale, `/${locale}/events`, () => api.myEnquiries())

  return (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-3xl font-bold">{t('events.title')}</h1>
          <Link href="/events/new" className={buttonClasses('primary', 'md')}>
            {t('events.post')}
          </Link>
        </div>

        {items.length === 0 ? (
          <p className="mt-8 rounded-card border border-dashed border-gray-300 bg-white p-10 text-gray-600">
            {t('events.empty')}
          </p>
        ) : (
          <ul className="mt-8 flex flex-col gap-4">
            {items.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-card bg-white p-6"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl font-bold">{t(`enquiry.occasions.${e.occasion}`)}</h2>
                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', statusStyle(e.status))}>
                      {t(`events.status.${e.status}`)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {formatEventDate(e.startsAt, locale)} · {formatEventTime(e.startsAt)} ·{' '}
                    {t(`districts.${e.district}`)}
                  </p>
                  <p className="mt-1 text-sm text-gray-700">
                    {t('events.quotes', { count: e.quoteCount })} ·{' '}
                    {t('events.matched', { count: e.matchedCount })}
                  </p>
                </div>
                <Link href={`/events/${e.id}/quotes`} className={buttonClasses('secondary', 'sm')}>
                  {t('events.view')}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

import { formatEventDate, formatEventTime, formatLKR, QUOTE_SORTS } from '@thaala/shared'
import { buttonClasses, cn, Rating } from '@thaala/ui'
import { Check, Clock, MessageCircle, ShieldCheck, X } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import { z } from 'zod'
import { Link } from '@/i18n/navigation'
import { api } from '@/lib/api'
import { initials } from '@/lib/format'
import { withSession } from '@/lib/page-auth'

type Props = {
  params: Promise<{ locale: string; eventId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const SORT_LINKS = [
  { value: 'bestMatch', label: 'sortBestMatch' },
  { value: 'price', label: 'sortPrice' },
  { value: 'rating', label: 'sortRating' },
] as const
const querySchema = z.object({ sort: z.enum(QUOTE_SORTS).catch('bestMatch') })

/**
 * Page title.
 *
 * @param props - Route params.
 * @returns Metadata (never indexed: quotes are private).
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'quotes' })
  return { title: t('metaTitle'), robots: { index: false } }
}

/**
 * Compare quotes for one event, side by side.
 *
 * Shows what each quote includes, not just price, so clients compare like with like.
 *
 * @param props - Route params and query.
 * @returns The compare page, or a "waiting" empty state when no quotes have arrived.
 * @throws Next.js `notFound()` for an unknown event or someone else's (the API 404s both).
 */
export default async function CompareQuotesPage({ params, searchParams }: Props) {
  const { locale, eventId } = await params
  setRequestLocale(locale)
  const { sort } = querySchema.parse(await searchParams)
  const data = await withSession(locale, `/${locale}/events/${eventId}/quotes`, () =>
    api.enquiryQuotes(eventId, sort),
  )
  if (!data) notFound()
  const t = await getTranslations()
  const { enquiry, quotes } = data
  const included = { on: t('quotes.included'), off: t('quotes.notIncluded') }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-card bg-white p-6">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">
              {t(`enquiry.occasions.${enquiry.occasion}`)}
            </h1>
            <p className="mt-1 text-gray-600">
              {t('quotes.eventSummary', {
                date: formatEventDate(enquiry.startsAt, locale),
                time: formatEventTime(enquiry.startsAt),
                district: t(`districts.${enquiry.district}`),
                guests: t(`enquiry.guestBands.${enquiry.guests}`),
                style: enquiry.musicStyles.map((s) => t(`enquiry.styles.${s}`)).join(', '),
                budget: t(`enquiry.budgetBands.${enquiry.budget}`),
              })}
            </p>
          </div>
          <Link href="/events" className={buttonClasses('secondary', 'sm')}>
            {t('events.title')}
          </Link>
        </div>

        {quotes.length === 0 ? (
          <div className="mt-8 rounded-card border border-dashed border-gray-300 bg-white p-10 text-center">
            <Clock size={40} className="mx-auto text-brand-600" aria-hidden />
            <h2 className="mt-3 font-display text-xl font-bold">{t('quotes.waitingTitle')}</h2>
            <p className="mx-auto mt-1 max-w-md text-gray-600">{t('quotes.waitingBody')}</p>
            <p className="mt-2 text-sm text-gray-600">
              {t('events.matched', { count: enquiry.matchedCount })}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold">
                {t('quotes.count', { count: quotes.length })}
              </h2>
              <nav className="flex gap-2" aria-label={t('quotes.sortLabel')}>
                {SORT_LINKS.map(({ value: s, label }) => (
                  <Link
                    key={s}
                    href={{ pathname: `/events/${enquiry.id}/quotes`, query: { sort: s } }}
                    scroll={false}
                    aria-current={s === sort ? 'true' : undefined}
                    className={cn(
                      'inline-flex min-h-11 items-center rounded-full px-4 text-sm',
                      s === sort ? 'bg-gray-900 font-semibold text-white' : 'border border-gray-300 bg-white',
                    )}
                  >
                    {t(`quotes.${label}`)}
                  </Link>
                ))}
              </nav>
            </div>

            <ul className="mt-4 grid gap-5 md:grid-cols-3">
              {quotes.map((q) => (
                <li
                  key={q.id}
                  className={cn(
                    'flex flex-col gap-4 rounded-card bg-white p-6',
                    q.bestMatch ? 'ring-2 ring-brand-600' : 'border border-gray-200',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        aria-hidden
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700"
                      >
                        {initials(q.musicianName)}
                      </div>
                      <div>
                        <h3 className="font-semibold">
                          <Link href={`/musicians/${q.musicianSlug}`} className="hover:text-brand-700">
                            {q.musicianName}
                          </Link>
                        </h3>
                        <Rating
                          rating={q.rating}
                          reviews={q.reviews}
                          label={t('rating.label', { rating: q.rating.toFixed(1), count: q.reviews })}
                        />
                      </div>
                    </div>
                    {q.bestMatch && (
                      <span className="rounded-full bg-brand-600 px-2.5 py-1 text-xs font-bold text-white">
                        {t('quotes.bestMatch')}
                      </span>
                    )}
                  </div>
                  <div className="font-display text-3xl font-bold">{formatLKR(q.priceCents)}</div>
                  <dl className="divide-y divide-gray-100 text-sm">
                    <Row label={t('quotes.length')}>
                      {t('quotes.hours', { count: Math.round((q.durationMinutes / 60) * 10) / 10 })}
                    </Row>
                    <Row label={t('quotes.musicians')}>{q.members}</Row>
                    <Row label={t('quotes.soundSystem')}>
                      <Included on={q.includesSound} labels={included} />
                    </Row>
                    <Row label={t('quotes.lights')}>
                      <Included on={q.includesLights} labels={included} />
                    </Row>
                    {q.mustPlayKnown !== null && (
                      <Row label={t('quotes.mustPlay')}>{t('quotes.known', { count: q.mustPlayKnown })}</Row>
                    )}
                    <Row label={t('quotes.repliedIn')}>
                      {q.replyMinutes < 60
                        ? t('quotes.replyMinutes', { count: q.replyMinutes })
                        : t('quotes.replyHours', { count: Math.round(q.replyMinutes / 60) })}
                    </Row>
                  </dl>
                  {q.message && <blockquote className="text-sm text-gray-700">“{q.message}”</blockquote>}
                  <div className="mt-auto grid grid-cols-2 gap-2">
                    {/* Chat opens in P3-02. */}
                    <button type="button" disabled className={buttonClasses('outlineBrand', 'md')}>
                      <MessageCircle size={16} aria-hidden />
                      <span aria-hidden>{t('quotes.chat')}</span>
                      <span className="sr-only">{t('quotes.chatWith', { name: q.musicianName })}</span>
                    </button>
                    {q.status === 'sent' ? (
                      <Link href={`/checkout/${q.id}`} className={buttonClasses('primary', 'md')}>
                        <span aria-hidden>{t('quotes.book')}</span>
                        <span className="sr-only">{t('quotes.bookWith', { name: q.musicianName })}</span>
                      </Link>
                    ) : (
                      <span className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-900">
                        {t('quotes.accepted')}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-8 flex items-start gap-3 rounded-card bg-white p-5 text-sm text-gray-700">
          <ShieldCheck size={22} className="shrink-0 text-brand-600" aria-hidden />
          <p>
            <span className="font-semibold">{t('quotes.protectionTitle')}</span> {t('quotes.protectionBody')}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * One label/value row in a quote's details list.
 *
 * @param props.label - The term.
 * @param props.children - The value.
 * @returns A `dt`/`dd` pair.
 */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between py-2">
      <dt className="text-gray-600">{label}</dt>
      <dd className="flex items-center font-medium">{children}</dd>
    </div>
  )
}

/**
 * Tick or cross with screen-reader text.
 *
 * @param props.on - Whether the item is included.
 * @param props.labels - Translated "Included" / "Not included".
 * @returns The icon with hidden text.
 */
function Included({ on, labels }: { on: boolean; labels: { on: string; off: string } }) {
  return on ? (
    <>
      <Check size={18} className="text-brand-600" aria-hidden />
      <span className="sr-only">{labels.on}</span>
    </>
  ) : (
    <>
      <X size={18} className="text-gray-500" aria-hidden />
      <span className="sr-only">{labels.off}</span>
    </>
  )
}

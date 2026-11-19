import { DEPOSIT_RATE_BPS, formatEventDate, formatEventTime, formatLKR } from '@thaala/shared'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PaymentOptions } from '@/components/checkout/PaymentOptions'
import { Link } from '@/i18n/navigation'
import { api } from '@/lib/api'
import { initials } from '@/lib/format'
import { withSession } from '@/lib/page-auth'

type Props = { params: Promise<{ locale: string; quoteId: string }> }

/**
 * Page title.
 *
 * @param props - Route params.
 * @returns Metadata (never indexed).
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'checkout' })
  return { title: t('metaTitle'), robots: { index: false } }
}

/**
 * Checkout: booking summary and deposit payment (payment itself opens with P4-02).
 *
 * @param props - Route params; `quoteId` is an untrusted lookup key.
 * @returns The checkout page.
 * @throws Next.js `notFound()` for an unknown quote or one on someone else's event.
 *
 * @remarks
 * Security: every amount shown comes from the API's checkout summary, which computes the
 * deposit from the stored quote price (CLAUDE.md rule 8). This page does no money maths.
 */
export default async function CheckoutPage({ params }: Props) {
  const { locale, quoteId } = await params
  setRequestLocale(locale)
  const summary = await withSession(locale, `/${locale}/checkout/${quoteId}`, () => api.checkout(quoteId))
  if (!summary) notFound()
  const t = await getTranslations()
  const extras = [
    summary.includesSound && t('quotes.soundSystem'),
    summary.includesLights && t('quotes.lights'),
  ].filter(Boolean)

  return (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href={`/events/${summary.enquiryId}/quotes`}
          className="text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          ← {t('checkout.backToQuotes')}
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold">{t('checkout.title')}</h1>

        <div className="mt-8 flex flex-wrap gap-8">
          <div className="min-w-0 flex-[999_1_480px] rounded-card bg-white p-6 sm:p-8">
            <PaymentOptions depositLabel={formatLKR(summary.depositCents)} />
          </div>

          <aside aria-label={t('checkout.summary')} className="w-full lg:w-80">
            <div className="rounded-card bg-white p-6">
              <div className="flex items-center gap-3">
                <div
                  aria-hidden
                  className="flex h-12 w-12 items-center justify-center rounded-input bg-brand-50 font-bold text-brand-700"
                >
                  {initials(summary.musicianName)}
                </div>
                <div>
                  <div className="font-semibold">{summary.musicianName}</div>
                  <div className="text-sm text-gray-600">
                    {t('checkout.duration', { hours: Math.round((summary.durationMinutes / 60) * 10) / 10 })}
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-1 text-sm text-gray-700">
                <div>
                  {formatEventDate(summary.startsAt, locale)}, {formatEventTime(summary.startsAt)}
                </div>
                <div>
                  {[
                    t(`districts.${summary.district}`),
                    t('checkout.details', { musicians: summary.musicians }),
                    ...extras,
                  ].join(' · ')}
                </div>
              </div>
              <dl className="mt-5 space-y-2 border-t border-gray-200 pt-4 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-600">{t('checkout.quoteTotal')}</dt>
                  <dd>{formatLKR(summary.totalCents)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-600">{t('checkout.balance')}</dt>
                  <dd>{formatLKR(summary.balanceCents)}</dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-gray-200 pt-3 text-base font-bold">
                  <dt>{t('checkout.depositToday', { percent: DEPOSIT_RATE_BPS / 100 })}</dt>
                  <dd>{formatLKR(summary.depositCents)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-gray-600">
                {t('checkout.balanceDue', {
                  amount: formatLKR(summary.balanceCents),
                  date: formatEventDate(summary.balanceDueAt, locale),
                })}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

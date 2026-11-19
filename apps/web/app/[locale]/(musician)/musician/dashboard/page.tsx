import { formatEventDate, formatEventTime, formatLKR } from '@thaala/shared'
import { buttonClasses, cn } from '@thaala/ui'
import {
  CalendarDays,
  Clock,
  Inbox,
  LayoutDashboard,
  MessageCircle,
  Music2,
  UserRound,
  Wallet,
} from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFormatter, getNow, getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { declineEnquiry } from '@/lib/actions'
import { ApiError, api } from '@/lib/api'
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
  const t = await getTranslations({ locale, namespace: 'dashboard' })
  return { title: t('metaTitle'), robots: { index: false } }
}

/**
 * Musician dashboard: stats, reply-time nudge, new enquiries and upcoming gigs.
 *
 * Built for speed on a phone: the newest enquiries and their actions come first.
 *
 * @param props - Route params.
 * @returns The dashboard, with an empty state when there are no new enquiries.
 * @throws Next.js `notFound()` when the signed-in user has no musician profile.
 */
export default async function MusicianDashboardPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const d = await withSession(locale, `/${locale}/musician/dashboard`, async () => {
    try {
      return await api.dashboard()
    } catch (e) {
      // Signed in but not a musician: there is no dashboard to show.
      if (e instanceof ApiError && e.status === 403) return null
      throw e
    }
  })
  if (!d) notFound()
  const [t, format, now] = await Promise.all([getTranslations(), getFormatter(), getNow()])

  // Only Overview exists so far; the rest arrive with their BUILD_PLAN tasks.
  const nav = [
    { icon: LayoutDashboard, label: t('dashboard.navOverview'), current: true },
    { icon: Inbox, label: t('dashboard.navEnquiries'), current: false },
    { icon: MessageCircle, label: t('dashboard.navMessages'), current: false },
    { icon: CalendarDays, label: t('dashboard.navCalendar'), current: false },
    { icon: Music2, label: t('dashboard.navProfile'), current: false },
    { icon: Wallet, label: t('dashboard.navEarnings'), current: false },
  ]
  const stats = [
    { label: t('dashboard.statNewEnquiries'), value: String(d.newEnquiries.length), accent: true },
    { label: t('dashboard.statQuotesWaiting'), value: String(d.quotesWaiting), accent: false },
    { label: t('dashboard.statUpcomingGigs'), value: String(d.upcomingGigs.length), accent: false },
    { label: t('dashboard.statDue'), value: formatLKR(d.dueCents), accent: false },
  ]

  return (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label={t('dashboard.nav')} className="w-full lg:w-56">
          <ul className="flex flex-wrap gap-1 lg:flex-col">
            {nav.map(({ icon: Icon, label, current }) => (
              <li key={label}>
                <span
                  aria-current={current ? 'page' : undefined}
                  aria-disabled={current ? undefined : true}
                  className={cn(
                    'flex h-11 w-full items-center gap-3 rounded-input px-3 text-sm whitespace-nowrap',
                    current ? 'bg-gig-50 font-semibold text-gig-900' : 'text-gray-600',
                  )}
                >
                  <Icon size={18} aria-hidden /> {label}
                </span>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-bold">{d.name}</h1>
              <p className="text-gray-600">
                {d.status === 'live' ? t('dashboard.status') : t('dashboard.notLive')}
              </p>
            </div>
            {d.status === 'live' && (
              <Link href={`/musicians/${d.slug}`} className={buttonClasses('secondary', 'sm')}>
                <UserRound size={16} aria-hidden /> {t('dashboard.viewProfile')}
              </Link>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse rounded-card bg-white p-5">
                <dt className="text-sm text-gray-600">{s.label}</dt>
                <dd className={cn('font-display text-2xl font-bold', s.accent && 'text-gig-600')}>
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex items-center gap-3 rounded-card bg-gig-50 p-4 text-sm text-gig-900">
            <Clock size={20} className="shrink-0" aria-hidden />
            <p>
              {d.averageReplyMinutes === null
                ? t('dashboard.noReplyYet')
                : t.rich('dashboard.replyTime', {
                    time:
                      d.averageReplyMinutes < 60
                        ? t('quotes.replyMinutes', { count: d.averageReplyMinutes })
                        : t('quotes.replyHours', {
                            count: Math.round((d.averageReplyMinutes / 60) * 10) / 10,
                          }),
                    b: (chunks) => <b>{chunks}</b>,
                  })}
            </p>
          </div>

          <div className="flex flex-wrap gap-6">
            <section className="min-w-0 flex-[999_1_420px]">
              <h2 className="font-display text-xl font-bold">{t('dashboard.newEnquiries')}</h2>
              {d.newEnquiries.length === 0 ? (
                <p className="mt-4 rounded-card border border-dashed border-gray-300 bg-white p-8 text-gray-600">
                  {t('dashboard.noEnquiries')}
                </p>
              ) : (
                <ul className="mt-4 flex flex-col gap-4">
                  {d.newEnquiries.map((e) => (
                    <li key={e.enquiryId} className="flex flex-col gap-3 rounded-card bg-white p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{t(`enquiry.occasions.${e.occasion}`)}</h3>
                          <p className="text-sm text-gray-600">
                            {formatEventDate(e.startsAt, locale)} · {formatEventTime(e.startsAt)} ·{' '}
                            {t(`districts.${e.district}`)}
                          </p>
                        </div>
                        <span className="text-xs whitespace-nowrap text-gray-600">
                          {format.relativeTime(new Date(e.notifiedAt), now)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-medium">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1">
                          {t('dashboard.guests', { band: t(`enquiry.guestBands.${e.guests}`) })}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1">
                          {t(`enquiry.budgetBands.${e.budget}`)}
                        </span>
                        <span className="rounded-full bg-gig-50 px-2.5 py-1 font-bold text-gig-900">
                          {t('dashboard.matchScore', { score: e.score })}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <form action={declineEnquiry}>
                          <input type="hidden" name="enquiryId" value={e.enquiryId} />
                          <input type="hidden" name="locale" value={locale} />
                          <button type="submit" className={buttonClasses('secondary', 'sm')}>
                            {t('dashboard.notAvailable')}
                          </button>
                        </form>
                        {/* The quote builder screen isn't designed yet; POST /v1/enquiries/:id/quotes is ready. */}
                        <button type="button" disabled className={buttonClasses('gig', 'sm')}>
                          {t('dashboard.sendQuote')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="w-full xl:w-80">
              <h2 className="font-display text-xl font-bold">{t('dashboard.upcoming')}</h2>
              {d.upcomingGigs.length === 0 ? (
                <p className="mt-4 rounded-card bg-white p-4 text-sm text-gray-600">—</p>
              ) : (
                <ul className="mt-4 divide-y divide-gray-100 rounded-card bg-white">
                  {d.upcomingGigs.map((g) => (
                    <li key={g.bookingId} className="flex items-center gap-4 p-4">
                      <div className="w-16 shrink-0 rounded-input bg-gig-50 py-2 text-center text-sm font-bold text-gig-900">
                        {format.dateTime(new Date(g.startsAt), { day: 'numeric', month: 'short' })}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {t(`enquiry.occasions.${g.occasion}`)} · {g.venue ?? t(`districts.${g.district}`)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {t('dashboard.depositPaid', { amount: formatLKR(g.totalCents) })}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

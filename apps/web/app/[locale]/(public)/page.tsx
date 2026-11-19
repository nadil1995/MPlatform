import { CATEGORIES, DISTRICTS, type District } from '@thaala/shared'
import { buttonClasses } from '@thaala/ui'
import { CalendarDays, MapPin, MessageSquareQuote, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { MusicianCard } from '@/components/MusicianCard'
import { Link } from '@/i18n/navigation'
import { api } from '@/lib/api'

type Props = { params: Promise<{ locale: string }> }

// Until we know where the visitor is, feature the biggest market.
const FEATURED_DISTRICT: District = 'colombo'

/**
 * Home page: hero search, categories, popular musicians, how it works, musician CTA.
 *
 * The hero search is a plain GET form to /musicians, so it works before JavaScript loads.
 *
 * @param props - Route params.
 * @returns The home page.
 */
export default async function HomePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()
  // Top-rated musicians who play in the featured district; empty list if the API is down
  // would hide the section, so let the error boundary handle real failures instead.
  const { items: musicians } = await api.searchMusicians({
    district: FEATURED_DISTRICT,
    sort: 'topRated',
    pageSize: 4,
  })

  const steps = [
    { icon: Sparkles, title: t('home.stepTellTitle'), body: t('home.stepTellBody') },
    { icon: MessageSquareQuote, title: t('home.stepCompareTitle'), body: t('home.stepCompareBody') },
    { icon: ShieldCheck, title: t('home.stepBookTitle'), body: t('home.stepBookBody') },
  ]

  return (
    <>
      <section className="bg-brand-900 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:px-8 lg:py-20">
          <div className="flex flex-col gap-6">
            <h1 className="font-display text-4xl leading-tight font-bold sm:text-5xl">
              {t('home.headline')}
            </h1>
            <p className="max-w-xl text-lg text-brand-100">{t('home.subhead')}</p>
            <form
              action={`/${locale}/musicians`}
              method="get"
              role="search"
              className="grid gap-2 rounded-card bg-white p-2 text-gray-900 sm:grid-cols-[1.4fr_1fr_1fr_auto]"
            >
              <label className="flex items-center gap-2 rounded-input px-3 py-2.5 hover:bg-gray-50">
                <Search size={18} className="text-gray-500" aria-hidden />
                <span className="sr-only">{t('home.searchLabel')}</span>
                <input
                  name="q"
                  placeholder={t('home.searchPlaceholder')}
                  maxLength={80}
                  className="min-h-7 w-full bg-transparent text-sm outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-input px-3 py-2.5 hover:bg-gray-50">
                <MapPin size={18} className="text-gray-500" aria-hidden />
                <span className="sr-only">{t('home.districtLabel')}</span>
                <select
                  name="district"
                  defaultValue={FEATURED_DISTRICT}
                  className="min-h-7 w-full bg-transparent text-sm outline-none"
                >
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {t(`districts.${d}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 rounded-input px-3 py-2.5 hover:bg-gray-50">
                <CalendarDays size={18} className="text-gray-500" aria-hidden />
                <span className="sr-only">{t('home.dateLabel')}</span>
                <input
                  name="date"
                  type="date"
                  className="min-h-7 w-full bg-transparent text-sm outline-none"
                />
              </label>
              <button type="submit" className={buttonClasses('primary', 'lg', 'rounded-input text-sm')}>
                {t('home.search')}
              </button>
            </form>
            <p className="text-sm text-brand-100">
              {t('home.notSure')}{' '}
              <Link href="/events/new" className="font-semibold text-white underline underline-offset-4">
                {t('home.postAndGetQuotes')}
              </Link>
            </p>
          </div>
          <div className="hidden grid-cols-2 gap-3 lg:grid" aria-hidden>
            {musicians.slice(0, 4).map((m) => (
              <div
                key={m.slug}
                className="flex min-h-[150px] flex-col justify-end rounded-card bg-brand-700 p-4"
              >
                <div className="text-xs font-semibold tracking-wide text-brand-100 uppercase">
                  {t(`musicianTypes.${m.type}`)}
                </div>
                <div className="font-display text-lg font-semibold">{m.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="font-display text-2xl font-bold">{t('home.browseByType')}</h2>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORIES.map((c) => (
            <li key={c}>
              <Link
                href={{ pathname: '/musicians', query: { type: c } }}
                className="flex min-h-14 items-center rounded-input border border-gray-200 px-4 py-4 font-semibold hover:border-brand-600 hover:text-brand-700"
              >
                {t(`categories.${c}`)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl font-bold">
            {t('home.popularIn', { district: t(`districts.${FEATURED_DISTRICT}`) })}
          </h2>
          <Link
            href={{ pathname: '/musicians', query: { district: FEATURED_DISTRICT } }}
            className="text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            {t('home.seeAll')}
          </Link>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {musicians.slice(0, 3).map((m) => (
            <MusicianCard key={m.slug} musician={m} />
          ))}
        </div>
      </section>

      <section className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-bold">{t('home.howItWorks')}</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="rounded-card bg-white p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-input bg-brand-50 text-brand-600">
                  <Icon size={22} aria-hidden />
                </div>
                <div className="mt-4 text-sm font-semibold text-gray-600">{t('home.step', { n: i + 1 })}</div>
                <h3 className="font-display text-lg font-bold">{title}</h3>
                <p className="mt-1 text-gray-600">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-5 rounded-3xl bg-gig-600 p-8 text-white md:flex-row md:items-center md:justify-between md:p-10">
          <div>
            <h2 className="font-display text-2xl font-bold">{t('home.joinTitle')}</h2>
            <p className="mt-1 max-w-xl text-gig-50">{t('home.joinBody')}</p>
          </div>
          <Link
            href="/musician/dashboard"
            className={buttonClasses('secondary', 'lg', 'border-0 font-bold text-gig-700 hover:bg-gig-50')}
          >
            {t('home.joinCta')}
          </Link>
        </div>
      </section>
    </>
  )
}

import { formatLKR } from '@thaala/shared'
import { buttonClasses, cn, Rating } from '@thaala/ui'
import {
  BadgeCheck,
  Clock,
  Heart,
  MapPin,
  MessageCircle,
  Play,
  Search,
  ShieldCheck,
  Star,
} from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { z } from 'zod'
import { Link } from '@/i18n/navigation'
import { api } from '@/lib/api'

type Props = {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const TABS = ['songs', 'reviews', 'about'] as const
const TAB_LINKS = [
  { key: 'songs', label: 'tabSongs' },
  { key: 'reviews', label: 'tabReviews' },
  { key: 'about', label: 'tabAbout' },
] as const

// Security: the tab and song search come from the URL, so validate them like any input.
const profileQuerySchema = z.object({
  tab: z.enum(TABS).catch('songs'),
  q: z.string().trim().max(80).optional().catch(undefined),
})

/**
 * Title and description for a musician's profile.
 *
 * @param props - Route params.
 * @returns Metadata, or an empty object for unknown slugs (the page 404s).
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const m = await api.getMusician(slug)
  if (!m) return {}
  const t = await getTranslations({ locale })
  return {
    title: `${m.name} | ${t('common.brand')}`,
    description: t('profile.metaDescription', {
      name: m.name,
      type: t(`musicianTypes.${m.type}`),
      district: t(`districts.${m.district}`),
    }),
  }
}

/**
 * Public musician profile: media, songs, reviews, about, and the packages sidebar.
 *
 * Tabs are links (`?tab=`), not client state, so each tab is server-rendered, linkable
 * and works without JavaScript. Song search runs in the API (trigram match).
 *
 * @param props - Route params and query.
 * @returns The profile page.
 * @throws Next.js `notFound()` when the slug is unknown or the profile isn't live.
 */
export default async function MusicianProfilePage({ params, searchParams }: Props) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const { tab, q } = profileQuerySchema.parse(await searchParams)
  const m = await api.getMusician(slug, tab === 'songs' ? q : undefined)
  if (!m) notFound()
  const [t, format] = await Promise.all([getTranslations(), getFormatter()])
  // The middle package is the usual choice; highlight it as the design does.
  const suggested = m.packages[Math.min(1, m.packages.length - 1)]?.id

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/musicians" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
        ← {t('profile.backToResults')}
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold sm:text-4xl">{m.name}</h1>
            {m.verified && (
              <span
                title={t('profile.verifiedHelp')}
                className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700"
              >
                <BadgeCheck size={14} aria-hidden /> {t('profile.verified')}
                <span className="sr-only">: {t('profile.verifiedHelp')}</span>
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            <span>
              {t('profile.typeAndMembers', { type: t(`musicianTypes.${m.type}`), count: m.members })}
            </span>
            <Rating
              rating={m.rating}
              reviews={m.reviews}
              label={t('rating.label', { rating: m.rating.toFixed(1), count: m.reviews })}
            />
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} aria-hidden />
              {t('profile.playsIn', { districts: m.playsIn.map((d) => t(`districts.${d}`)).join(', ') })}
            </span>
            {m.replyHours !== null && (
              <span className="inline-flex items-center gap-1">
                <Clock size={14} aria-hidden /> {t('musicianCard.replyTime', { hours: m.replyHours })}
              </span>
            )}
          </div>
        </div>
        {/* Saving to a shortlist arrives with accounts' saved lists. */}
        <button type="button" disabled className={buttonClasses('secondary', 'sm')}>
          <Heart size={16} aria-hidden /> {t('profile.save')}
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-8">
        <div className="min-w-0 flex-[999_1_560px]">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            {/* Video placeholder until the media pipeline (P1-05). Videos never autoplay. */}
            <div className="relative flex aspect-video items-center justify-center rounded-card bg-gray-900 text-white">
              <button
                type="button"
                disabled
                aria-label={t('profile.playVideo')}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-gray-900"
              >
                <Play size={26} className="fill-gray-900" aria-hidden />
              </button>
              <span className="absolute bottom-3 left-4 text-sm">{t('profile.videoCaption')}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
              <div className="flex min-h-24 items-center justify-center rounded-card bg-brand-50 text-sm font-medium text-brand-700">
                {t('profile.photo')}
              </div>
              <div className="flex min-h-24 items-center justify-center rounded-card bg-brand-50 text-sm font-medium text-brand-700">
                {t('profile.photo')}
              </div>
            </div>
          </div>

          <nav aria-label={t('profile.sections')} className="mt-8 flex gap-6 border-b border-gray-200">
            {TAB_LINKS.map(({ key, label }) => (
              <Link
                key={key}
                href={{ pathname: `/musicians/${m.slug}`, query: { tab: key } }}
                scroll={false}
                aria-current={key === tab ? 'page' : undefined}
                className={cn(
                  'flex h-11 items-center border-b-2 text-sm',
                  key === tab
                    ? 'border-brand-600 font-bold text-brand-700'
                    : 'border-transparent font-medium text-gray-600 hover:text-gray-900',
                )}
              >
                {t(`profile.${label}`)}
              </Link>
            ))}
          </nav>

          {tab === 'songs' && (
            <div className="mt-5">
              <form method="get" role="search" className="flex max-w-md gap-2">
                <input type="hidden" name="tab" value="songs" />
                <label className="flex min-h-11 flex-1 items-center gap-2 rounded-input border border-gray-300 px-3">
                  <Search size={18} className="text-gray-500" aria-hidden />
                  <span className="sr-only">{t('profile.songSearchLabel')}</span>
                  <input
                    name="q"
                    defaultValue={q ?? ''}
                    maxLength={80}
                    placeholder={t('profile.songSearchPlaceholder')}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </label>
                <button type="submit" className={buttonClasses('secondary', 'sm')}>
                  {t('profile.songSearchButton')}
                </button>
              </form>
              {m.songs.length === 0 ? (
                <p className="mt-4 text-gray-600">{t('profile.noSongs')}</p>
              ) : (
                <div
                  className="mt-4 overflow-x-auto"
                  role="region"
                  aria-label={t('profile.tabSongs')}
                  // Focusable so keyboard users can scroll the table on narrow screens (WCAG 2.1.1).
                  tabIndex={0}
                >
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead className="text-gray-600">
                      <tr className="border-b border-gray-200">
                        <th scope="col" className="py-2 font-medium">
                          {t('profile.colSong')}
                        </th>
                        <th scope="col" className="py-2 font-medium">
                          {t('profile.colLanguage')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.songs.map((s) => (
                        <tr key={s.id} className="border-b border-gray-100">
                          <td className="py-3 font-semibold">{s.title}</td>
                          <td className="py-3 text-gray-700">{t(`languages.${s.language}`)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'reviews' &&
            (m.reviewList.length === 0 ? (
              <p className="mt-5 text-gray-600">{t('profile.noReviews')}</p>
            ) : (
              <ul className="mt-5 flex flex-col gap-4">
                {m.reviewList.map((r) => (
                  <li key={r.id} className="rounded-card border border-gray-200 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">
                        {r.author}{' '}
                        <span className="font-normal text-gray-600">
                          · {t(`enquiry.occasions.${r.occasion}`)}, {t(`districts.${r.district}`)}
                        </span>
                      </div>
                      <div className="flex gap-0.5">
                        <span className="sr-only">{t('rating.stars', { rating: r.rating })}</span>
                        {Array.from({ length: r.rating }, (_, i) => (
                          <Star key={i} size={14} className="fill-star text-star" aria-hidden />
                        ))}
                      </div>
                    </div>
                    <p className="mt-2 text-gray-700">{r.body}</p>
                    <div className="mt-2 text-xs text-gray-600">
                      {t('profile.verifiedBooking', {
                        when: format.dateTime(new Date(`${r.eventDate}T12:00:00+05:30`), {
                          month: 'short',
                          year: 'numeric',
                        }),
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            ))}

          {tab === 'about' && <p className="mt-5 max-w-2xl text-gray-700">{m.bio}</p>}
        </div>

        <aside className="w-full lg:w-[360px]">
          <div className="rounded-card border border-gray-200 p-6 shadow-sm lg:sticky lg:top-6">
            <div className="text-sm text-gray-600">{t('profile.startingFrom')}</div>
            <div className="font-display text-3xl font-bold">{formatLKR(m.priceFromCents)}</div>
            <form action={`/${locale}/events/new`} method="get">
              {m.packages.length === 0 ? (
                <p className="mt-5 text-sm text-gray-600">{t('profile.noPackages')}</p>
              ) : (
                <fieldset className="mt-5 flex flex-col gap-2">
                  <legend className="mb-2 text-sm font-semibold">{t('profile.packages')}</legend>
                  {m.packages.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-start gap-3 rounded-input border border-gray-200 p-3 has-checked:border-brand-600 has-checked:bg-brand-50"
                    >
                      <input
                        type="radio"
                        name="package"
                        value={p.id}
                        defaultChecked={p.id === suggested}
                        className="mt-1 accent-brand-600"
                      />
                      <span className="flex-1">
                        <span className="flex justify-between gap-2 font-semibold">
                          <span>{p.name}</span>
                          <span>{formatLKR(p.priceFromCents)}</span>
                        </span>
                        <span className="block text-sm text-gray-600">{p.description}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              <button type="submit" className={buttonClasses('primary', 'lg', 'mt-5 w-full')}>
                {t('profile.requestQuote')}
              </button>
            </form>
            {/* Chat opens in P3-02. Contact details stay hidden until booking (CLAUDE.md rule 11). */}
            <button type="button" disabled className={buttonClasses('secondary', 'lg', 'mt-2 w-full')}>
              <MessageCircle size={18} aria-hidden /> {t('profile.message')}
            </button>
            <p className="mt-4 flex gap-2 text-sm text-gray-600">
              <ShieldCheck size={18} className="shrink-0 text-brand-600" aria-hidden />
              {t('profile.protection')}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

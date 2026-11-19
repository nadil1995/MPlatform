import {
  BUDGET_CEILINGS_LKR,
  CATEGORIES,
  DISTRICTS,
  formatLKR,
  musicianSearchQuerySchema,
  type SearchSort,
  SONG_LANGUAGES,
  type MusicianSearchQuery,
} from '@thaala/shared'
import { buttonClasses, inputClasses } from '@thaala/ui'
import { SlidersHorizontal } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { MusicianCard } from '@/components/MusicianCard'
import { SortSelect } from '@/components/SortSelect'
import { Link } from '@/i18n/navigation'
import { api } from '@/lib/api'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const FORM_ID = 'search-filters'
const SORT_OPTIONS = [
  { value: 'bestMatch', label: 'sortBestMatch' },
  { value: 'topRated', label: 'sortTopRated' },
  { value: 'lowestPrice', label: 'sortLowestPrice' },
  { value: 'fastestReply', label: 'sortFastestReply' },
] as const satisfies readonly { value: SearchSort; label: string }[]

/**
 * Build the "Wedding bands in Colombo" heading parts from the query.
 *
 * @param query - Validated search query.
 * @param t - Translator for the whole message tree.
 * @returns Translated type and district labels.
 */
function headingParts(
  query: MusicianSearchQuery,
  t: Awaited<ReturnType<typeof getTranslations>>,
): { type: string; district: string } {
  const [onlyType] = query.type
  return {
    type: query.type.length === 1 && onlyType ? t(`categories.${onlyType}`) : t('search.allMusicians'),
    district: query.district ? t(`districts.${query.district}`) : t('search.allDistricts'),
  }
}

/**
 * Page title and description for the current filters (SEO landing pages, P2-01).
 *
 * @param props - Route params and query.
 * @returns Metadata for this search.
 */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })
  const parts = headingParts(musicianSearchQuerySchema.parse(await searchParams), t)
  return { title: t('search.metaTitle', parts), description: t('search.metaDescription', parts) }
}

/**
 * Search results with filters.
 *
 * Filters are a plain GET form so results are server-rendered, shareable by URL and work
 * without JavaScript on slow connections.
 *
 * @param props - Route params and the raw query string.
 * @returns The search page, with an empty state when nothing matches.
 *
 * @remarks
 * Security: the query is parsed with the shared Zod schema; bad values fall back to
 * defaults rather than erroring, and only known values are ever rendered back.
 */
export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()
  const raw = await searchParams
  const query = musicianSearchQuerySchema.parse(raw)
  const { items: results, total, page } = await api.searchMusicians(query)
  const pages = Math.max(1, Math.ceil(total / query.pageSize))
  /**
   * Link to another results page with the same filters.
   *
   * @param p - Page number.
   * @returns The link target.
   */
  const pageHref = (p: number) => {
    // Keep the validated filters only; never echo unknown params back into links.
    const keep: Record<string, string | string[]> = {}
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || k === 'page' || k === 'pageSize') continue
      keep[k] = Array.isArray(v) ? v : v === true ? '1' : String(v)
    }
    return { pathname: '/musicians' as const, query: { ...keep, page: String(p) } }
  }
  const heading = headingParts(query, t)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">{t('search.title', heading)}</h1>
          <p className="mt-1 text-gray-600" aria-live="polite">
            {t('search.count', { count: total })}
          </p>
        </div>
        <SortSelect
          form={FORM_ID}
          label={t('search.sortBy')}
          value={query.sort}
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: t(`search.${o.label}`) }))}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-8">
        <form
          id={FORM_ID}
          method="get"
          action={`/${locale}/musicians`}
          aria-label={t('search.filters')}
          className="flex w-full flex-col gap-7 lg:w-64"
        >
          <div className="flex items-center gap-2 font-semibold">
            <SlidersHorizontal size={18} aria-hidden /> {t('search.filters')}
          </div>
          {query.q && <input type="hidden" name="q" value={query.q} />}
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-2 text-sm font-semibold">{t('search.type')}</legend>
            {CATEGORIES.map((c) => (
              <label key={c} className="flex min-h-9 items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  name="type"
                  value={c}
                  defaultChecked={query.type.includes(c)}
                  className="h-4 w-4 accent-brand-600"
                />
                {t(`categories.${c}`)}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-semibold">{t('search.district')}</span>
            <select name="district" defaultValue={query.district ?? ''} className={inputClasses}>
              <option value="">{t('search.allDistricts')}</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {t(`districts.${d}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-semibold">{t('search.eventDate')}</span>
            <input type="date" name="date" defaultValue={query.date ?? ''} className={inputClasses} />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-semibold">{t('search.budget')}</span>
            <select name="maxBudget" defaultValue={query.maxBudget ?? ''} className={inputClasses}>
              <option value="">{t('search.budgetAny')}</option>
              {BUDGET_CEILINGS_LKR.map((b) => (
                <option key={b} value={b}>
                  {t('search.budgetUpTo', { amount: formatLKR(b * 100) })}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-2 text-sm font-semibold">{t('search.singsIn')}</legend>
            {SONG_LANGUAGES.map((l) => (
              <label key={l} className="flex min-h-9 items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  name="lang"
                  value={l}
                  defaultChecked={query.lang.includes(l)}
                  className="h-4 w-4 accent-brand-600"
                />
                {t(`languages.${l}`)}
              </label>
            ))}
          </fieldset>
          <label className="flex min-h-9 items-center gap-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              name="verified"
              value="1"
              defaultChecked={query.verified === true}
              className="h-4 w-4 accent-brand-600"
            />
            {t('search.verifiedOnly')}
          </label>
          <button type="submit" className={buttonClasses('primary', 'md')}>
            {t('search.apply')}
          </button>
        </form>

        <section aria-label={t('search.results')} className="min-w-0 flex-[999_1_560px]">
          {results.length === 0 ? (
            <div className="flex flex-col items-start gap-4 rounded-card border border-dashed border-gray-300 p-10">
              <h2 className="font-display text-xl font-bold">{t('search.emptyTitle')}</h2>
              <p className="max-w-lg text-gray-600">{t('search.emptyBody')}</p>
              <Link href="/events/new" className={buttonClasses('primary', 'md')}>
                {t('search.postEvent')}
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((m) => (
                  <MusicianCard key={m.slug} musician={m} />
                ))}
              </div>
              {pages > 1 && (
                <nav
                  aria-label={t('common.pageOf', { page, pages })}
                  className="mt-8 flex items-center justify-between gap-4"
                >
                  {page > 1 ? (
                    <Link href={pageHref(page - 1)} className={buttonClasses('secondary', 'sm')}>
                      {t('common.previous')}
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span className="text-sm text-gray-600">{t('common.pageOf', { page, pages })}</span>
                  {page < pages ? (
                    <Link href={pageHref(page + 1)} className={buttonClasses('secondary', 'sm')}>
                      {t('common.next')}
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              )}
              <div className="mt-8 flex flex-col items-start gap-3 rounded-card bg-brand-50 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-brand-900">{t('search.tooManyTitle')}</h2>
                  <p className="text-sm text-brand-900">{t('search.tooManyBody')}</p>
                </div>
                <Link href="/events/new" className={buttonClasses('primary', 'md')}>
                  {t('search.getQuotes')}
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

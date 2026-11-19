import { formatLKR } from '@thaala/shared'
import { Rating } from '@thaala/ui'
import { BadgeCheck, MapPin, Music2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import type { MusicianSummary } from '@thaala/shared'

export type MusicianCardProps = { musician: MusicianSummary }

/**
 * Card linking to a musician's profile, used on the home page and in search results.
 *
 * The whole card is one link so the touch target is large on phones.
 *
 * @param props - See {@link MusicianCardProps}.
 * @returns The rendered card.
 */
export function MusicianCard({ musician: m }: MusicianCardProps) {
  const t = useTranslations()
  return (
    <Link
      href={`/musicians/${m.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-gray-200 bg-white text-left transition hover:border-brand-600 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center bg-brand-50 text-brand-600">
        {/* Placeholder until the media pipeline (P1-05) serves real photos via next/image. */}
        <Music2 size={36} aria-hidden />
        <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-gray-800">
          {t(`musicianTypes.${m.type}`)}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        <div className="flex items-center gap-1.5 font-semibold text-gray-900">
          {m.name}
          {m.verified && (
            <>
              <BadgeCheck size={17} className="text-brand-600" aria-hidden />
              <span className="sr-only">{t('musicianCard.verified')}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <MapPin size={14} aria-hidden /> {t(`districts.${m.district}`)} ·{' '}
          {m.languages.map((l) => t(`languages.${l}`)).join(', ')}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <Rating
            rating={m.rating}
            reviews={m.reviews}
            label={t('rating.label', { rating: m.rating.toFixed(1), count: m.reviews })}
          />
          <span className="text-sm text-gray-700">
            {t('musicianCard.from', { price: formatLKR(m.priceFromCents) })}
          </span>
        </div>
      </div>
    </Link>
  )
}

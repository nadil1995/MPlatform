import { Star } from 'lucide-react'

export type RatingProps = {
  /** Average rating, 0–5. */
  rating: number
  /** Number of reviews. */
  reviews: number
  /**
   * Full sentence for screen readers, already translated, e.g.
   * "Rated 4.9 out of 5 from 38 reviews". The visible text is terse, so this is required.
   */
  label: string
}

/**
 * Star rating with review count, e.g. "★ 4.9 (38)".
 *
 * The visible form is compact for cards. Screen readers get the full sentence instead
 * (docs/UX_GUIDELINES.md "Accessibility"), so the visible parts are hidden from them.
 *
 * @param props - See {@link RatingProps}.
 * @returns The rendered rating.
 */
export function Rating({ rating, reviews, label }: RatingProps) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="sr-only">{label}</span>
      <Star size={15} className="fill-star text-star" aria-hidden />
      <span aria-hidden className="font-semibold text-gray-900">
        {rating.toFixed(1)}
      </span>
      <span aria-hidden className="text-gray-600">
        ({reviews})
      </span>
    </span>
  )
}

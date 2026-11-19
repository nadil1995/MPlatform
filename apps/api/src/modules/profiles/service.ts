import type {
  MusicianProfile,
  MusicianSearchQuery,
  MusicianSearchResult,
  MusicianSummary,
} from '@thaala/shared'
import type { District } from '@thaala/shared'
import type { DbOrTx } from '../../lib/db'
import { AppError } from '../../lib/errors'
import * as repo from './repository'

/**
 * Shorten a reviewer's name to first name and initial ("Dilani Perera" → "Dilani P.").
 *
 * Reviews are public; the full surname is not needed to trust them.
 *
 * @param name - Display name.
 * @param status - Account status; deleted accounts show as "Former user" (DATA_HANDLING.md).
 * @returns The public label.
 */
export function publicReviewerName(name: string, status: string): string {
  if (status === 'deleted') return 'Former user'
  const [first, ...rest] = name.trim().split(/\s+/)
  const last = rest.at(-1)
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : (first ?? '')
}

/**
 * Convert a database row to the public card shape.
 *
 * @param row - Profile row.
 * @returns The card data.
 */
export function toSummary(row: repo.ProfileSummaryRow): MusicianSummary {
  return {
    slug: row.slug,
    name: row.name,
    type: row.type,
    district: row.districts[0] as District,
    playsIn: row.districts as District[],
    languages: row.languages.filter((l): l is 'si' | 'en' | 'ta' => l !== 'instrumental'),
    rating: Number(row.ratingAvg),
    reviews: row.ratingCount,
    priceFromCents: row.priceFromCents,
    replyHours: row.avgReplySeconds === null ? null : Math.max(1, Math.ceil(row.avgReplySeconds / 3600)),
    verified: row.verifiedAt !== null,
    members: row.membersCount,
  }
}

/**
 * Public musician search.
 *
 * @param db - Database.
 * @param q - Validated query.
 * @returns One page of musician cards and the total.
 */
export async function searchMusicians(db: DbOrTx, q: MusicianSearchQuery): Promise<MusicianSearchResult> {
  const { rows, total } = await repo.searchProfiles(db, q)
  return { items: rows.map(toSummary), total, page: q.page }
}

/**
 * Public profile with packages, songs and reviews.
 *
 * @param db - Database.
 * @param slug - Profile slug.
 * @param songQuery - Optional song search text.
 * @returns The full profile.
 * @throws {AppError} `NOT_FOUND` when the slug is unknown or the profile isn't live.
 */
export async function getProfile(
  db: DbOrTx,
  slug: string,
  songQuery: string | undefined,
): Promise<MusicianProfile> {
  const row = await repo.findLiveProfile(db, slug)
  if (!row) throw new AppError('NOT_FOUND')
  const [packages, songs, reviewRows] = await Promise.all([
    repo.listServices(db, row.id),
    repo.listSongs(db, row.id, songQuery),
    repo.listReviews(db, row.id),
  ])
  return {
    ...toSummary(row),
    bio: row.bio,
    packages,
    songs,
    reviewList: reviewRows.map((r) => ({
      id: r.id,
      author: publicReviewerName(r.authorName, r.authorStatus),
      occasion: r.occasion,
      district: r.district,
      eventDate: r.eventDate,
      rating: r.rating,
      body: r.body,
      reply: r.reply,
    })),
  }
}

import { notFound } from 'next/navigation'

/**
 * Catch-all so unknown paths under a locale render the localised 404 page.
 *
 * @returns Never returns.
 * @throws Next.js `notFound()` always.
 */
export default function CatchAll(): never {
  notFound()
}

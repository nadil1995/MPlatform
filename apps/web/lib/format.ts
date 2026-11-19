/**
 * Two-letter avatar text from a name ("Rhythm Junction" → "RJ").
 *
 * @param name - Musician name.
 * @returns Up to two upper-case initials (Latin letters only; others are skipped).
 */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

/**
 * Design tokens from the Magic Patterns reference design (docs/UX_GUIDELINES.md).
 *
 * Kept in TypeScript so the mobile app (which has no Tailwind) uses the same values.
 * `theme.css` mirrors these for Tailwind; change both together.
 */
export const colors = {
  brand: { 50: '#e6f4f2', 100: '#c7e7e2', 600: '#0f766e', 700: '#115e59', 900: '#0b3b37' },
  // Musician mode is magenta so users always know which mode they are in.
  gig: { 50: '#fce7f0', 600: '#be185d', 700: '#9d174d', 900: '#831843' },
  // Decorative only: amber fails 4.5:1 on white, so never use it for text.
  star: '#f59e0b',
  text: { primary: '#111827', secondary: '#4b5563' },
} as const

export const radius = { input: 12, card: 16, pill: 9999 } as const

export const fonts = {
  display: 'Space Grotesk',
  body: 'Inter',
  sinhala: 'Noto Sans Sinhala',
  tamil: 'Noto Sans Tamil',
} as const

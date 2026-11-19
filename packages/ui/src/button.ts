import { cn } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'gig' | 'dark' | 'outlineBrand'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS = new Map<ButtonVariant, string>([
  ['primary', 'bg-brand-600 text-white hover:bg-brand-700 font-bold'],
  ['secondary', 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 font-semibold'],
  ['gig', 'bg-gig-600 text-white hover:bg-gig-700 font-bold'],
  ['dark', 'bg-gray-900 text-white hover:bg-gray-800 font-semibold'],
  ['outlineBrand', 'border border-brand-600 text-brand-700 hover:bg-brand-50 font-semibold'],
])

// Every size is at least 44px tall to meet the WCAG 2.2 touch-target rule.
const SIZES = new Map<ButtonSize, string>([
  ['sm', 'min-h-11 px-4 text-sm'],
  ['md', 'min-h-11 px-5 text-sm'],
  ['lg', 'min-h-12 px-6'],
])

/**
 * Class names for a pill-shaped button or button-styled link.
 *
 * A function rather than a component so the same look works on `<button>`, `<a>` and
 * Next.js `<Link>` without wrapping them.
 *
 * @param variant - Visual style. `primary` is client teal, `gig` is musician magenta.
 * @param size - Height and padding.
 * @param extra - Extra classes merged last, so they win on conflicts.
 * @returns The class string.
 */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra?: string,
): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-full transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
    'disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS.get(variant),
    SIZES.get(size),
    extra,
  )
}

/**
 * Class names for a selectable chip (radio or checkbox styled as a pill).
 *
 * Use on the `<label>` wrapping a visually hidden input, so keyboard and screen reader
 * behaviour stays native. `has-checked:` styles the label from the input state.
 *
 * @returns The class string.
 */
export function chipClasses(): string {
  return cn(
    'inline-flex min-h-11 cursor-pointer items-center rounded-full border border-gray-300 bg-white px-4 text-sm text-gray-900',
    'hover:border-brand-600',
    'has-checked:border-brand-600 has-checked:bg-brand-600 has-checked:font-semibold has-checked:text-white',
    'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-600',
  )
}

/** Shared input look: 44px+ tall, 12px radius (docs/UX_GUIDELINES.md "Forms"). */
export const inputClasses =
  'min-h-11 w-full rounded-input border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 aria-invalid:border-red-600'

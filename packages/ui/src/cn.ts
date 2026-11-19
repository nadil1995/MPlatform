import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Join class names and let later Tailwind classes override earlier conflicting ones.
 *
 * @param inputs - Class strings, arrays or `{ class: condition }` maps.
 * @returns One merged class string.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

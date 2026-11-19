import { cn } from '@thaala/ui'

/**
 * Grey placeholder block for loading states.
 *
 * @param props.className - Size and shape classes.
 * @returns A decorative block hidden from screen readers.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-card bg-gray-100', className)} />
}

/**
 * Generic page skeleton: a heading and a grid of cards.
 *
 * Layout-shaped rather than a spinner (docs/UX_GUIDELINES.md "Loading").
 *
 * @param props.label - Translated "Loading…" text for screen readers.
 * @returns The skeleton.
 */
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-9 w-72" />
      <Skeleton className="mt-3 h-5 w-96 max-w-full" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    </div>
  )
}

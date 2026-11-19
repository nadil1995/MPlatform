'use client'

import { WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSyncExternalStore } from 'react'

/**
 * Subscribe to the browser's online/offline events.
 *
 * @param onChange - Called by React when connectivity changes.
 * @returns A function that removes the listeners.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/**
 * Banner shown while the browser is offline, so cached pages are not mistaken for live data.
 *
 * Required by the "every screen handles offline" rule (docs/UX_GUIDELINES.md).
 *
 * @returns The banner, or nothing while online (and during server rendering).
 */
export function OfflineBanner() {
  const t = useTranslations('common')
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
  if (online) return null
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-gray-900 px-4 py-2 text-sm text-white"
    >
      <WifiOff size={16} aria-hidden /> {t('offline')}
    </div>
  )
}

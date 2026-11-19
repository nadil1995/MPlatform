import type { ReactNode } from 'react'
import { SiteHeader } from '@/components/SiteHeader'

/**
 * Layout for musician-mode pages, with the magenta "Musician mode" header.
 *
 * @param props.children - The page.
 * @returns The page with the musician header.
 *
 * @remarks
 * Security: proxy.ts redirects signed-out visitors; the API requires the musician role
 * and an owned profile for every dashboard call.
 */
export default function MusicianLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader mode="musician" />
      <main id="main">{children}</main>
    </>
  )
}

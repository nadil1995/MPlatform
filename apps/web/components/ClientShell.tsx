import type { ReactNode } from 'react'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

/**
 * Page frame for client-mode pages (public and signed-in): header, main, footer.
 *
 * @param props.children - The page content.
 * @returns The framed page.
 */
export function ClientShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader mode="client" />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  )
}

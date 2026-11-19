import type { ReactNode } from 'react'
import { ClientShell } from '@/components/ClientShell'

/**
 * Layout for signed-in client pages (enquiries, quotes, checkout).
 *
 * @param props.children - The page.
 * @returns The page inside the client-mode shell.
 *
 * @remarks
 * Security: proxy.ts redirects signed-out visitors to sign-in; the API then checks the
 * token and ownership on every call (pages 404 for other users' ids).
 */
export default function ClientLayout({ children }: { children: ReactNode }) {
  return <ClientShell>{children}</ClientShell>
}

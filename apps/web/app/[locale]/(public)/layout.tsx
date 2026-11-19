import type { ReactNode } from 'react'
import { ClientShell } from '@/components/ClientShell'

/**
 * Layout for public, server-rendered pages (home, search, profiles).
 *
 * @param props.children - The page.
 * @returns The page inside the client-mode shell.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <ClientShell>{children}</ClientShell>
}

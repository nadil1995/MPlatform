import { NextRequest, NextResponse } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { buildCsp, createNonce } from './lib/csp'

/** Paths that need a signed-in user (after the locale segment). */
const PRIVATE = /^\/(en|si|ta)\/(events|checkout|musician)(\/|$)/
/** Presence-only marker set next to the encrypted session (lib/session.ts). */
const SIGNED_IN_COOKIE = 'thaala_signed_in'

const handleI18nRouting = createIntlMiddleware(routing)

/**
 * Runs before every page request: sets the per-request CSP nonce and locale routing.
 *
 * Next.js reads the CSP from the request headers to tag its own scripts with the nonce,
 * so the header goes on the forwarded request as well as on the response.
 *
 * @param request - The incoming request.
 * @returns The locale redirect/rewrite from next-intl, with security headers added.
 *
 * @remarks
 * Security: private pages redirect to sign-in when no session cookie is present. This is
 * only a UX shortcut; authorization happens in the API on every request.
 */
export function proxy(request: NextRequest): NextResponse {
  // Optimistic gate: bounce signed-out users to sign-in before rendering a private page.
  // The real check is the API, which rejects every call without a valid token.
  const { pathname, search } = request.nextUrl
  const locale = pathname.split('/')[1]
  if (PRIVATE.test(pathname) && !request.cookies.has(SIGNED_IN_COOKIE)) {
    const url = new URL(`/${locale}/sign-in`, request.url)
    url.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(url)
  }

  const nonce = createNonce()
  const csp = buildCsp(nonce, process.env.NODE_ENV === 'development')

  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('Content-Security-Policy', csp)

  const response = handleI18nRouting(new NextRequest(request, { headers }))
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return response
}

export const config = {
  matcher: [
    {
      // Skip API routes, Next internals and files with an extension (static assets).
      source: '/((?!api|_next/static|_next/image|.*\\..*).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}

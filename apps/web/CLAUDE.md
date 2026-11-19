# apps/web — CLAUDE.md

Next.js (App Router), TypeScript, Tailwind (tokens from `packages/ui`), next-intl,
TanStack Query for client-side data. Built with `output: 'standalone'` for Docker.

## Layout

```
app/
  [locale]/(public)/        Home, search, musician profile, SEO landing pages (server-rendered)
  [locale]/(client)/        Enquiries, quotes, checkout, bookings (signed in)
  [locale]/(musician)/      Dashboard, enquiries, quote builder, calendar, profile editor, earnings
  [locale]/(admin)/         Vetting, disputes, payouts, moderation (admin + MFA only)
  api/auth/...              BFF auth routes (OTP start/verify, OAuth callback, refresh, logout)
  api/bff/...               Thin proxies that attach the user's token to API calls
proxy.ts                    Locale routing, CSP nonce, auth gate for private segments (Next 16 renamed middleware → proxy)
lib/                        api client (server-only), session (encrypted cookies), csrf
components/                 Screen-level components. Primitives come from packages/ui.
```

## Rules

- **Tokens never reach the browser.** Only `lib/session.ts` (server-only, guarded with the
  `import 'server-only'` package) reads or writes the session cookie.
- Server components fetch data with the server API client. Client components call
  `/api/bff/*`, which checks the CSRF token on every non-GET request.
- `proxy.ts` sets a per-request CSP nonce (built in `lib/csp.ts`). No inline scripts without the nonce. No
  `dangerouslySetInnerHTML` (lint rule).
- Admin routes check the role **and** the MFA claim on the server, in the layout and in every route handler.
- Public pages: `generateMetadata` for SEO, `next/image` for all images, ISR where possible
  (revalidate 5 minutes for profiles).
- All copy comes from next-intl messages (`en`, `si`, `ta`). Dates and money use shared formatters.
- Each page handles loading (`loading.tsx` skeletons), error (`error.tsx` with request id)
  and empty states.
- Forms use React Hook Form + the shared Zod schemas, so client and server validation match.
- The PayHere checkout is started by a server action that gets signed checkout fields from
  the API. The return page only polls the booking status.
- Playwright E2E + axe checks live in `e2e/`. Add a test for every new user flow.

## Current state

- Every page reads from the API through `lib/api.ts` (server-only, Zod-validated responses).
  There is no hard-coded data in the web app; local data comes from `pnpm --filter @thaala/api db:seed`.
- Mutations are **server actions** in `lib/actions.ts` (Next checks Origin vs Host, which is
  the CSRF protection). `/api/bff/*` route handlers are only needed once client components
  fetch directly (TanStack Query); add the double-submit CSRF token then.
- Sign-in is the **dev sign-in** (`/sign-in`, pick a seeded user) until Cognito (P1-01/P1-02).
  It only renders when `NEXT_PUBLIC_ENV=local`, and the API refuses dev tokens in production.
- `proxy.ts` redirects signed-out visitors away from `/events`, `/checkout` and `/musician`
  (presence check only); the API does the real auth and returns 404 for other users' ids.
- Still disabled on purpose: Pay / Upload slip (P4-02, P4-03), Chat (P3-02), Save, and
  "Send quote" (the API endpoint exists; the quote-builder screen isn't designed yet).
- Every page is dynamically rendered (`connection()` in the locale layout) because the CSP
  nonce is per request. Revisit ISR for profiles together with the CSP strategy.
- `notFound()` after streaming starts returns HTTP 200 with `noindex` (Next behaviour with
  `loading.tsx`). Revisit if crawlers need hard 404s.
- E2E (`pnpm --filter @thaala/web e2e`) needs Postgres running and a production build; it
  migrates and reseeds the dev database, then starts the API and web itself.

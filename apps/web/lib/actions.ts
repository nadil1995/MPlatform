'use server'

import { enquiryDraftSchema, LOCALES, uuidSchema, type Locale } from '@thaala/shared'
import { redirect } from 'next/navigation'
import { ApiError, api } from './api'
import { devSignInEnabled } from './env'
import { clearSession, setSession } from './session'

/**
 * Server actions called from forms and client components.
 *
 * Security: Next.js only runs a server action when the request's Origin matches the
 * host, which is the CSRF protection for these state-changing calls. Every input is
 * re-validated here; nothing from the browser is trusted.
 */

/**
 * Pick a valid locale from untrusted form data.
 *
 * @param v - Form value.
 * @returns A supported locale (English when invalid).
 */
function localeOf(v: FormDataEntryValue | null): Locale {
  return LOCALES.find((l) => l === v) ?? 'en'
}

/**
 * Accept only same-site, locale-prefixed paths as a post-sign-in destination.
 *
 * @param next - Untrusted `next` value from the form.
 * @param locale - Fallback locale.
 * @returns A safe path.
 *
 * @remarks
 * Security: blocks open redirects (`//evil.com`, `https://…`, `/\\evil.com`).
 */
export async function safeNext(next: unknown, locale: Locale): Promise<string> {
  const isLocalePath = typeof next === 'string' && /^\/(en|si|ta)(\/|$)/.test(next)
  // Only URL-safe path characters; rules out schemes, backslashes and protocol-relative URLs.
  if (isLocalePath && /^[A-Za-z0-9\-_/?=&%.]+$/.test(next) && !next.includes('//')) return next
  return `/${locale}`
}

/**
 * Dev sign-in: start a session as a seeded user (local only).
 *
 * @param form - `userId`, `locale` and optional `next`.
 * @returns Never returns; redirects.
 * @throws Next.js redirect (always), or `notFound`-style redirect when dev sign-in is off.
 */
export async function signInAsDev(form: FormData): Promise<never> {
  const locale = localeOf(form.get('locale'))
  if (!devSignInEnabled()) redirect(`/${locale}`)
  const userId = uuidSchema.safeParse(form.get('userId'))
  if (!userId.success) redirect(`/${locale}/sign-in`)
  const { accessToken, expiresIn } = await api.devSession(userId.data)
  await setSession(accessToken, expiresIn)
  redirect(await safeNext(form.get('next'), locale))
}

/**
 * Sign out and go home.
 *
 * @param form - `locale`.
 * @returns Never returns; redirects.
 */
export async function signOut(form: FormData): Promise<never> {
  await clearSession()
  redirect(`/${localeOf(form.get('locale'))}`)
}

export type PostEnquiryResult =
  | { ok: true; id: string; matchedCount: number }
  | { ok: false; code: 'VALIDATION_FAILED'; fields: Record<string, string> }
  | { ok: false; code: 'UNAUTHENTICATED' | 'RATE_LIMITED' | 'FAILED'; requestId?: string }

/**
 * Post an enquiry for the signed-in client.
 *
 * @param input - Form values from the client component (untrusted).
 * @returns The new enquiry id, or field errors / an error code for the form to show.
 */
export async function postEnquiry(input: unknown): Promise<PostEnquiryResult> {
  const parsed = enquiryDraftSchema.safeParse(input)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const i of parsed.error.issues) fields[String(i.path[0] ?? '_')] ??= i.message
    return { ok: false, code: 'VALIDATION_FAILED', fields }
  }
  try {
    const created = await api.createEnquiry(parsed.data)
    return { ok: true, ...created }
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === 'VALIDATION_FAILED') return { ok: false, code: 'VALIDATION_FAILED', fields: e.fields }
      if (e.code === 'UNAUTHENTICATED' || e.code === 'RATE_LIMITED') return { ok: false, code: e.code }
      return { ok: false, code: 'FAILED', requestId: e.requestId }
    }
    return { ok: false, code: 'FAILED' }
  }
}

/**
 * A musician marks themselves not available for a matched enquiry.
 *
 * @param form - `enquiryId` and `locale`.
 * @returns Never returns; redirects back to the dashboard.
 */
export async function declineEnquiry(form: FormData): Promise<never> {
  const locale = localeOf(form.get('locale'))
  const id = uuidSchema.safeParse(form.get('enquiryId'))
  if (id.success) await api.declineEnquiry(id.data)
  redirect(`/${locale}/musician/dashboard`)
}

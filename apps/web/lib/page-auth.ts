import 'server-only'
import { redirect } from 'next/navigation'
import { ApiError } from './api'

/**
 * Run an API call for a private page, sending the user to sign-in if the session has
 * expired or been revoked (the cookie can outlive the token's validity in edge cases).
 *
 * @param locale - Current locale, for the redirect.
 * @param next - Path to return to after signing in.
 * @param fn - The API call.
 * @returns The call's result.
 * @throws Next.js redirect on 401; rethrows every other error for the error boundary.
 */
export async function withSession<T>(locale: string, next: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      redirect(`/${locale}/sign-in?next=${encodeURIComponent(next)}`)
    }
    throw e
  }
}

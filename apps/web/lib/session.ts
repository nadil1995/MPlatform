import 'server-only'
import { createHash } from 'node:crypto'
import { EncryptJWT, jwtDecrypt } from 'jose'
import { cookies } from 'next/headers'
import { env } from './env'

/**
 * The session cookie. The only file allowed to read or write it (apps/web/CLAUDE.md).
 *
 * The API access token is stored encrypted (AES-256-GCM, `dir` JWE) in an HttpOnly,
 * SameSite=Lax cookie, so browser JavaScript, including any injected script, can never
 * read it (docs/SECURITY.md §2).
 */
export const SESSION_COOKIE = 'thaala_session'
/** Non-secret marker read by proxy.ts for an optimistic "signed in?" redirect. */
export const SIGNED_IN_COOKIE = 'thaala_signed_in'

/**
 * Derive a 256-bit key from the configured secret.
 *
 * @returns The key bytes.
 */
function key(): Uint8Array {
  return new Uint8Array(createHash('sha256').update(env().SESSION_SECRET).digest())
}

/**
 * Store a new access token in the session.
 *
 * @param accessToken - Token from the API (dev) or Cognito (P1-02).
 * @param expiresIn - Lifetime in seconds; the cookie expires with the token.
 * @returns Resolves when the cookies are set.
 *
 * @remarks
 * Security: `Secure` is set everywhere except plain-http localhost development.
 */
export async function setSession(accessToken: string, expiresIn: number): Promise<void> {
  const jwe = await new EncryptJWT({ at: accessToken })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .encrypt(key())
  const store = await cookies()
  const secure = env().NODE_ENV === 'production'
  store.set(SESSION_COOKIE, jwe, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: expiresIn })
  store.set(SIGNED_IN_COOKIE, '1', { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: expiresIn })
}

/**
 * Read the access token for API calls.
 *
 * @returns The token, or null when signed out, expired or tampered with.
 */
export async function getAccessToken(): Promise<string | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value
  if (!raw) return null
  try {
    const { payload } = await jwtDecrypt(raw, key())
    return typeof payload.at === 'string' ? payload.at : null
  } catch {
    // Expired or not ours: treat as signed out.
    return null
  }
}

/**
 * Sign out locally by deleting both cookies.
 *
 * @returns Resolves when cleared. (Revoking the refresh token arrives with Cognito, P1-02.)
 */
export async function clearSession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  store.delete(SIGNED_IN_COOKIE)
}

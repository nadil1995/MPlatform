/**
 * Content Security Policy for every HTML response (docs/SECURITY.md "Headers").
 */

/**
 * Build the CSP header value for one request.
 *
 * Scripts only run if they carry this request's nonce (or are loaded by one, via
 * `strict-dynamic`), which blocks injected scripts even if an XSS bug slips through.
 *
 * @param nonce - A fresh, unpredictable base64 value for this request only.
 * @param isDev - True under `next dev`, which needs `unsafe-eval` for React debugging
 *   and inline styles for the dev overlay. Never true in production builds.
 * @returns The header value on a single line.
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Security: production styles come only from our own stylesheet or nonce'd tags.
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}

/**
 * Make a new random nonce.
 *
 * @returns 128 random bits, base64-encoded.
 */
export function createNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

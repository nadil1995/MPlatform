import { jwtVerify, SignJWT } from 'jose'
import type { Config } from '../config'
import { AppError } from './errors'

const DEV_ISSUER = 'thaala-dev'
const AUDIENCE = 'thaala-api'
/** 15 minutes, matching the Cognito access-token lifetime in docs/SECURITY.md §2. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60

/** The verified identity in a token. `sub` maps to `users.cognito_sub`. */
export type TokenClaims = { sub: string }

export type TokenVerifier = (token: string) => Promise<TokenClaims>

/**
 * Build the access-token verifier for the configured auth mode.
 *
 * This is the only place that knows how tokens are signed. P1-01 adds the Cognito branch
 * (aws-jwt-verify: issuer, client id, `token_use`, expiry) without touching routes.
 *
 * @param config - Validated config.
 * @returns A function that verifies a token and returns its claims.
 * @throws {Error} At startup when the mode is not supported.
 */
export function createTokenVerifier(config: Config): TokenVerifier {
  if (config.AUTH_MODE !== 'dev' || !config.DEV_JWT_SECRET) {
    throw new Error('Only AUTH_MODE=dev is implemented (Cognito arrives in P1-01)')
  }
  const key = new TextEncoder().encode(config.DEV_JWT_SECRET)
  return async (token) => {
    try {
      // Security: issuer, audience, algorithm and expiry are all checked; never decode-only.
      const { payload } = await jwtVerify(token, key, {
        issuer: DEV_ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      })
      if (typeof payload.sub !== 'string' || payload.sub === '') throw new Error('no sub')
      return { sub: payload.sub }
    } catch {
      throw new AppError('UNAUTHENTICATED')
    }
  }
}

/**
 * Sign a short-lived dev access token.
 *
 * @param secret - DEV_JWT_SECRET.
 * @param sub - The user's `cognito_sub`.
 * @returns The compact JWT.
 *
 * @remarks
 * Security: only reachable through the dev session route, which is not mounted unless
 * AUTH_MODE=dev, and config refuses dev mode in production.
 */
export async function signDevToken(secret: string, sub: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuer(DEV_ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(secret))
}

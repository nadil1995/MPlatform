import 'server-only'
import { z } from 'zod'

/**
 * Server-side configuration for the web app (BFF), validated on first use.
 *
 * None of these reach the browser: only `NEXT_PUBLIC_*` values are bundled, and the
 * API URL and session secret are deliberately not public.
 */
const envSchema = z.object({
  API_URL: z.url().default('http://127.0.0.1:8080'),
  /** Encrypts the session cookie. 32+ characters; from Secrets Manager in AWS. */
  SESSION_SECRET: z.string().min(32),
  NEXT_PUBLIC_ENV: z.enum(['local', 'staging', 'production']).default('local'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export type WebEnv = z.infer<typeof envSchema>

let cached: WebEnv | undefined

/**
 * Read and validate the server environment.
 *
 * @returns The typed environment.
 * @throws {Error} Naming each invalid variable (never its value).
 */
export function env(): WebEnv {
  if (cached) return cached
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(
      `Invalid web configuration: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    )
  }
  cached = parsed.data
  return cached
}

/**
 * True when the dev sign-in page may be shown: local environments only.
 *
 * Staging and production use Cognito (P1-02). The API also refuses dev tokens unless it
 * runs with AUTH_MODE=dev, which its config forbids in production.
 *
 * @returns Whether dev sign-in is enabled.
 */
export function devSignInEnabled(): boolean {
  return env().NEXT_PUBLIC_ENV === 'local'
}

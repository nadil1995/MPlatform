import { z } from 'zod'

/**
 * Runtime configuration, validated once at startup.
 *
 * Secrets arrive as environment variables injected by ECS from Secrets Manager (or from
 * the git-ignored `.env` locally). The process exits if anything is missing or unsafe.
 */
const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    /** Comma-separated exact origins allowed by CORS. Never `*`. */
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((s) =>
        s
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url()).min(1)),
    /**
     * `dev`: verify HS256 tokens signed with DEV_JWT_SECRET and expose /v1/dev/*.
     * `cognito`: verify Cognito tokens (P1-01). Not implemented yet, so it fails fast.
     */
    AUTH_MODE: z.enum(['dev', 'cognito']).default('dev'),
    DEV_JWT_SECRET: z.string().min(32).optional(),
    /** Salt for hashing client IPs in the audit log (never store raw IPs). */
    AUDIT_IP_SALT: z.string().min(16),
  })
  // Security: dev sign-in lets anyone become any user. It must never run in production.
  .refine((c) => !(c.NODE_ENV === 'production' && c.AUTH_MODE === 'dev'), {
    error: 'AUTH_MODE=dev is not allowed when NODE_ENV=production',
    path: ['AUTH_MODE'],
  })
  .refine((c) => c.AUTH_MODE !== 'dev' || c.DEV_JWT_SECRET !== undefined, {
    error: 'DEV_JWT_SECRET (32+ chars) is required when AUTH_MODE=dev',
    path: ['DEV_JWT_SECRET'],
  })
  .refine((c) => c.AUTH_MODE !== 'cognito', {
    error: 'AUTH_MODE=cognito arrives with P1-01; use dev locally',
    path: ['AUTH_MODE'],
  })

export type Config = z.infer<typeof configSchema>

/**
 * Parse and validate configuration from an environment object.
 *
 * @param env - Usually `process.env`. Tests pass their own object.
 * @returns The typed config.
 * @throws {Error} Listing every invalid variable by name. Values are never included,
 *   because they may be secrets.
 */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const result = configSchema.safeParse(env)
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.') || 'config'}: ${i.message}`)
    throw new Error(`Invalid configuration:\n  ${problems.join('\n  ')}`)
  }
  return result.data
}

import { defineConfig, devices } from '@playwright/test'

/**
 * E2E runs the real stack: the API (dev auth) on a seeded database, and the built web app.
 * Local defaults use the dev-only credentials from docker-compose.yml; CI sets E2E_* env.
 */
const PORT = Number(process.env.E2E_PORT ?? 3311)
const API_PORT = Number(process.env.E2E_API_PORT ?? 8099)
const DB_HOST = process.env.E2E_DATABASE_HOST ?? '127.0.0.1:5432'
const DEV_JWT_SECRET = 'e2e-only-dev-jwt-secret-0123456789abcdef'

export const e2eEnv = {
  MIGRATE_DATABASE_URL: `postgres://thaala_migrate:local-dev-only@${DB_HOST}/thaala`,
  DATABASE_URL: `postgres://thaala_app:local-dev-only@${DB_HOST}/thaala`,
}

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // Tests share one seeded database; run them in order so state is predictable.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['junit', { outputFile: 'reports/e2e-junit.xml' }]] : 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Mobile-first: most clients book from a mid-range Android phone.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @thaala/api exec tsx src/server.ts',
      url: `http://127.0.0.1:${API_PORT}/readyz`,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'development',
        PORT: String(API_PORT),
        LOG_LEVEL: 'warn',
        DATABASE_URL: e2eEnv.DATABASE_URL,
        CORS_ORIGINS: `http://127.0.0.1:${PORT}`,
        AUTH_MODE: 'dev',
        DEV_JWT_SECRET,
        AUDIT_IP_SALT: 'e2e-only-audit-salt-value',
      },
    },
    {
      command: `pnpm start --port ${PORT}`,
      url: `http://127.0.0.1:${PORT}/api/healthz`,
      reuseExistingServer: !process.env.CI,
      env: {
        API_URL: `http://127.0.0.1:${API_PORT}`,
        SESSION_SECRET: 'e2e-only-session-secret-0123456789abcdef',
        NEXT_PUBLIC_ENV: 'local',
      },
    },
  ],
})

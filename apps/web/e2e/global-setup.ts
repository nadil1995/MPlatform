import { execFileSync } from 'node:child_process'
import { e2eEnv } from '../playwright.config'

/**
 * Reset the dev database to the known seed before the run, so tests that post events
 * (and the 5-a-day limit) start from the same state every time.
 *
 * @returns Resolves when the database is migrated and seeded.
 * @throws {Error} If migrating or seeding fails (e.g. Postgres isn't running).
 */
export default async function globalSetup(): Promise<void> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'development',
    MIGRATE_DATABASE_URL: e2eEnv.MIGRATE_DATABASE_URL,
  }
  execFileSync('pnpm', ['--filter', '@thaala/api', 'exec', 'tsx', 'src/migrate.ts'], {
    env,
    stdio: 'inherit',
  })
  execFileSync('pnpm', ['--filter', '@thaala/api', 'exec', 'tsx', 'src/seed.ts', '--reset'], {
    env,
    stdio: 'inherit',
  })
}

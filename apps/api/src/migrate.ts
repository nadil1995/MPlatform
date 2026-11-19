import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

/**
 * Apply pending migrations, then exit 0 (success) or 1 (failure).
 *
 * Runs as a one-off ECS task before each deploy (scripts/ci/run-migrations.sh), using
 * the DDL-capable migrate role. The API itself never runs DDL.
 *
 * @returns Resolves when done; the process exit code carries the result.
 * @throws Never: errors are logged (without the URL, which holds a password) and turned
 *   into exit code 1.
 */
async function main(): Promise<void> {
  const url = process.env.MIGRATE_DATABASE_URL
  if (!url) {
    console.error('MIGRATE_DATABASE_URL is not set')
    process.exit(1)
  }
  // Inside the built image, migrations are copied next to dist/ (apps/api/Dockerfile).
  const folder = fileURLToPath(new URL('../drizzle', import.meta.url))
  const client = postgres(url, { max: 1, onnotice: () => undefined })
  try {
    // The journal lives in `public`: the migrate role has DDL rights there only
    // (least privilege, scripts/dev/postgres-init.sql), not CREATE on the database.
    await migrate(drizzle(client), { migrationsFolder: folder, migrationsSchema: 'public' })
    console.log('migrations applied')
  } catch (err) {
    console.error('migration failed:', err instanceof Error ? err.message : 'unknown error')
    process.exitCode = 1
  } finally {
    await client.end({ timeout: 5 })
  }
}

await main()

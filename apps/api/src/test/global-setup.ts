import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

/**
 * Integration tests run against a real Postgres (docs/CODING_STANDARDS.md §4): the
 * docker-compose database locally, the CI container in Jenkins (DATABASE_URL).
 *
 * The local default uses the dev-only credentials already in docker-compose.yml.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://thaala:local-dev-only@127.0.0.1:5432/thaala_test'

/**
 * Create the test database if needed and apply all migrations once per run.
 *
 * @returns Resolves when the schema is ready.
 * @throws {Error} With setup instructions when Postgres isn't reachable.
 */
export default async function setup(): Promise<void> {
  const target = new URL(TEST_DATABASE_URL)
  const dbName = target.pathname.slice(1)
  const admin = new URL(TEST_DATABASE_URL)
  admin.pathname = '/postgres'
  const adminClient = postgres(admin.toString(), { max: 1, onnotice: () => undefined, connect_timeout: 5 })
  try {
    const exists = await adminClient`SELECT 1 FROM pg_database WHERE datname = ${dbName}`
    // Identifier can't be a bind parameter; it comes from our own config, not user input.
    if (exists.length === 0) await adminClient.unsafe(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`)
  } catch (err) {
    throw new Error(
      `Integration tests need Postgres. Run \`docker compose up -d postgres\` (or set TEST_DATABASE_URL).\n${
        err instanceof Error ? err.message : ''
      }`,
    )
  } finally {
    await adminClient.end({ timeout: 5 })
  }
  const client = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => undefined })
  try {
    // Fresh schema every run so migrations are tested from scratch, like P0-04 asks.
    await client.unsafe(
      'DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;',
    )
    await migrate(drizzle(client), {
      migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
      migrationsSchema: 'public',
    })
  } finally {
    await client.end({ timeout: 5 })
  }
}

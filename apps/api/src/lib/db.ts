import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../db/schema'

export type Db = PostgresJsDatabase<typeof schema>
/** A transaction handle; repositories accept either. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type DbOrTx = Db | Tx

/**
 * Open the connection pool.
 *
 * @param url - Postgres URL. Uses the least-privileged app role outside migrations.
 * @returns The Drizzle client and a `close` function for graceful shutdown.
 */
export function createDb(url: string): { db: Db; close: () => Promise<void> } {
  const client = postgres(url, {
    max: 10,
    // Statement timeout protects the pool from runaway queries.
    connection: { statement_timeout: 10_000 },
    onnotice: () => undefined,
  })
  return { db: drizzle(client, { schema, casing: 'snake_case' }), close: () => client.end({ timeout: 5 }) }
}

import { and, count, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { enquiries, enquiryMatches, quotes } from '../../db/schema'
import type { DbOrTx } from '../../lib/db'

export type EnquiryRow = typeof enquiries.$inferSelect

/** Fully qualified outer id for correlated subqueries; a bare "id" would bind to q.id/m.id. */
const OUTER_ENQUIRY_ID = sql.raw('"enquiries"."id"')

/**
 * Load an enquiry only if the given client owns it.
 *
 * Scoping by owner here means a forgotten policy check still can't leak another user's
 * enquiry (docs/SECURITY.md §3).
 *
 * @param db - Database or transaction.
 * @param id - Enquiry id.
 * @param clientUserId - The acting user's id.
 * @param opts - `forUpdate` locks the row inside a transaction.
 * @param opts.forUpdate - Take a row lock.
 * @returns The row, or undefined if missing or not theirs.
 */
export async function findOwned(
  db: DbOrTx,
  id: string,
  clientUserId: string,
  opts: { forUpdate?: boolean } = {},
): Promise<EnquiryRow | undefined> {
  const q = db
    .select()
    .from(enquiries)
    .where(and(eq(enquiries.id, id), eq(enquiries.clientUserId, clientUserId)))
    .limit(1)
  const [row] = opts.forUpdate ? await q.for('update') : await q
  return row
}

/**
 * Count a user's enquiries created since a moment (for the daily limit).
 *
 * @param db - Database.
 * @param clientUserId - User id.
 * @param since - Window start.
 * @returns The count.
 */
export async function countCreatedSince(db: DbOrTx, clientUserId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(enquiries)
    .where(and(eq(enquiries.clientUserId, clientUserId), gte(enquiries.createdAt, since)))
  return row?.n ?? 0
}

/**
 * Insert an enquiry.
 *
 * @param db - Database or transaction.
 * @param values - Columns (already validated and computed by the service).
 * @returns The new id.
 */
export async function insert(db: DbOrTx, values: typeof enquiries.$inferInsert): Promise<string> {
  const [row] = await db.insert(enquiries).values(values).returning({ id: enquiries.id })
  if (!row) throw new Error('insert returned no row')
  return row.id
}

/**
 * List a client's enquiries, newest first, with quote and match counts.
 *
 * @param db - Database.
 * @param clientUserId - The acting user.
 * @returns Up to 50 rows.
 */
export function listOwned(db: DbOrTx, clientUserId: string) {
  return db
    .select({
      row: enquiries,
      quoteCount: sql<number>`(SELECT count(*)::int FROM ${quotes} q WHERE q.enquiry_id = ${OUTER_ENQUIRY_ID}
        AND q.status IN ('sent', 'accepted'))`,
      matchedCount: sql<number>`(SELECT count(*)::int FROM ${enquiryMatches} m WHERE m.enquiry_id = ${OUTER_ENQUIRY_ID})`,
    })
    .from(enquiries)
    .where(eq(enquiries.clientUserId, clientUserId))
    .orderBy(desc(enquiries.createdAt))
    .limit(50)
}

/**
 * Change an enquiry's status (the caller has already checked the transition).
 *
 * @param db - Transaction.
 * @param id - Enquiry id.
 * @param from - Expected current statuses (guards against races).
 * @param to - New status.
 * @returns Resolves when updated.
 */
export async function setStatus(
  db: DbOrTx,
  id: string,
  from: EnquiryRow['status'][],
  to: EnquiryRow['status'],
): Promise<void> {
  await db
    .update(enquiries)
    .set({ status: to })
    .where(and(eq(enquiries.id, id), inArray(enquiries.status, from)))
}

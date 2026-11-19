import { createHash } from 'node:crypto'
import { auditLog } from '../db/schema'
import type { DbOrTx } from './db'

export type AuditEntry = {
  actorUserId: string | null
  action: string
  entity: string
  entityId?: string | null
  ip?: string | null
  meta?: Record<string, unknown>
}

/**
 * Hash an IP with a secret salt so the audit log can link actions from one source
 * without storing the raw address (PII).
 *
 * @param ip - Client IP, or null.
 * @param salt - AUDIT_IP_SALT from config.
 * @returns A hex SHA-256 digest, or null.
 */
export function hashIp(ip: string | null | undefined, salt: string): string | null {
  return ip ? createHash('sha256').update(`${salt}:${ip}`).digest('hex') : null
}

/**
 * Append one row to the audit log, in the caller's transaction when given one.
 *
 * @param db - Database or transaction (use the transaction so the row commits with the change).
 * @param salt - AUDIT_IP_SALT.
 * @param entry - What happened. `meta` must not contain PII.
 * @returns Resolves when written.
 */
export async function writeAudit(db: DbOrTx, salt: string, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    ipHash: hashIp(entry.ip, salt),
    meta: entry.meta ?? {},
  })
}

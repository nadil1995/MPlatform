import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { id } from './columns'
import { users } from './users'

// Append-only: the migration revokes UPDATE and DELETE from the app role.
// Class: Internal. IP stored only as a salted hash.
export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    actorUserId: uuid().references(() => users.id),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: uuid(),
    ipHash: text(),
    meta: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_entity_idx').on(t.entity, t.entityId),
    index('audit_log_actor_idx').on(t.actorUserId),
  ],
)

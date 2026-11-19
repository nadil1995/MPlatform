import { sql } from 'drizzle-orm'
import { citext } from './citext'
import { pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { id, timestamps } from './columns'
import { localeEnum, userRoleEnum, userStatusEnum } from './enums'

// Class: PII (docs/DATA_HANDLING.md). Deleted/anonymised by the privacy module (P5-02).
export const users = pgTable(
  'users',
  {
    id: id(),
    /** Identity-provider subject. Cognito `sub` in AWS; a seeded value locally. */
    cognitoSub: text().notNull(),
    phoneE164: text(),
    email: citext(),
    displayName: text().notNull(),
    locale: localeEnum().notNull().default('en'),
    roles: userRoleEnum()
      .array()
      .notNull()
      .default(sql`ARRAY['client']::user_role[]`),
    status: userStatusEnum().notNull().default('active'),
    ...timestamps,
  },
  (t) => [uniqueIndex('users_cognito_sub_key').on(t.cognitoSub)],
)

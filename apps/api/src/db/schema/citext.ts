import { customType } from 'drizzle-orm/pg-core'

/** Case-insensitive text (citext extension), used for emails. */
export const citext = customType<{ data: string }>({ dataType: () => 'citext' })

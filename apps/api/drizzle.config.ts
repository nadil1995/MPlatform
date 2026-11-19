import { defineConfig } from 'drizzle-kit'

// Generating migrations reads only the schema files; no database connection needed.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
})

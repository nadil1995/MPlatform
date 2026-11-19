-- =============================================================================
-- postgres-init.sql — LOCAL DEV ONLY. Runs once when the Docker volume is created.
--
-- Creates the same role split used in AWS (docs/DATABASE.md):
--   thaala_migrate  owns the schema, runs DDL (used only by `pnpm db:migrate`)
--   thaala_app      runtime role: CRUD on tables, but INSERT-only on the
--                   append-only tables (granted per table by migrations)
-- Passwords here are local placeholders; staging/prod use Secrets Manager.
-- Rollback: `docker compose down -v` deletes the local volume.
-- =============================================================================

-- Extensions the schema relies on.
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fuzzy search on song titles and names
CREATE EXTENSION IF NOT EXISTS citext;    -- case-insensitive emails

-- Roles (LOGIN with local-only passwords).
CREATE ROLE thaala_migrate LOGIN PASSWORD 'local-dev-only';
CREATE ROLE thaala_app     LOGIN PASSWORD 'local-dev-only';

-- Security: the app role cannot create objects; only the migrate role can.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT  USAGE, CREATE ON SCHEMA public TO thaala_migrate;
-- The migrator (drizzle) runs `CREATE SCHEMA IF NOT EXISTS`, which Postgres checks
-- against CREATE on the database even when the schema exists. Only the DDL role gets it.
GRANT  CREATE ON DATABASE thaala TO thaala_migrate;
GRANT  USAGE ON SCHEMA public TO thaala_app;

-- Tables created later by thaala_migrate get CRUD for the app by default.
-- Migrations for append-only tables (ledger_entries, audit_log) then
-- REVOKE UPDATE, DELETE from thaala_app explicitly.
ALTER DEFAULT PRIVILEGES FOR ROLE thaala_migrate IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO thaala_app;
ALTER DEFAULT PRIVILEGES FOR ROLE thaala_migrate IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO thaala_app;

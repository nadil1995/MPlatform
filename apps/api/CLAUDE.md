# apps/api — CLAUDE.md

Node 24, TypeScript, Hono, Drizzle, Zod, pino. Serves REST (`/v1/...`) and WebSocket
(`/v1/ws`). The same build also contains `worker.ts` (SQS consumers and scheduled jobs)
and `migrate.ts`.

## Layout

```
src/
  server.ts            HTTP + WS entrypoint (graceful shutdown on SIGTERM)
  worker.ts            Queue consumers + schedulers
  migrate.ts           Runs Drizzle migrations, then exits 0/1
  config.ts            Zod-validated env. Fails fast on missing values. Secrets come from env injected by ECS.
  lib/                 logger (with redaction), errors, db, auth (jwt verify), rate-limit, crypto (KMS envelope), queue
  middleware/          requestId, securityHeaders, cors, bodyLimit, rateLimit, authenticate, requireRole
  policies/            Ownership/role predicates, e.g. canViewEnquiry(actor, enquiry)
  modules/<name>/
    routes.ts          Hono routes: declare auth level, validate with shared Zod, call service
    service.ts         Business rules, policy checks, transactions, publish events
    repository.ts      Drizzle queries, always scoped by actor where applicable
    events.ts          Event types this module publishes/consumes
    *.test.ts          Tests next to the code
  db/schema/           Drizzle tables (one file per module)
drizzle/               Generated migrations (review the SQL)
```

## Current state

- Built: health, `me`, dev sign-in (`/v1/dev/*`, AUTH_MODE=dev only), profiles/search,
  enquiries + matching (runs in-request after commit; moves to the SQS worker in P2-04),
  quotes (send, decline, compare, checkout summary, accept → booking `pending_payment`),
  musician dashboard. `worker.ts` expires stale enquiries and quotes every 15 minutes.
- Auth: `lib/auth.ts#createTokenVerifier` is the only place that knows the token format.
  P1-01 adds the Cognito branch; routes and policies don't change.
- Not built yet: PayHere + webhook, ledger, payouts, chat, reviews flow, media, admin,
  notifications, privacy jobs, OpenAPI generation.
- Raw `sql` correlated subqueries must reference outer columns fully qualified
  (`"enquiries"."id"`): Drizzle renders a lone column as a bare name, which Postgres binds
  to the inner table. Tests cover the counts that depend on this.

Local setup: `docker compose up -d postgres`, copy `.env.example` to `.env`, then
`pnpm --filter @thaala/api db:migrate && pnpm --filter @thaala/api db:seed`, then `pnpm dev`.
Integration tests use `TEST_DATABASE_URL` (default: the compose Postgres, database `thaala_test`).

## How to add a route (or run `/add-endpoint`)

1. Define request/response schemas in `packages/shared/src/schemas/<module>.ts`.
2. In `routes.ts`, declare `auth` (public/user/musician/admin), apply the
   `validate(schema)` middleware, and call one service function. No business logic in routes.
3. In `service.ts`, load the entity **scoped to the actor**, check the policy, do the work in a
   transaction if it writes more than one row, write the audit log for sensitive actions,
   then publish events after commit.
4. Add tests: success, 400 validation, 401 unauthenticated, 404 for another user's id,
   429 where rate-limited.
5. Update `openapi.yaml` (generated from the Zod schemas via `@hono/zod-openapi`).

## Rules specific to the API

- Status changes only through the state machine helpers in `modules/*/state.ts`.
- Money in integer cents. Deposit = `Math.round(total * 0.30)` lives in one function, `calculateDeposit`.
- Webhooks (`/v1/webhooks/payhere`) are exempt from JWT auth but must verify the signature
  first, before any database read beyond the order lookup.
- Events are published **after** the transaction commits (outbox table, or publish in
  `afterCommit`) so workers never see uncommitted data.
- Workers are idempotent: every message has an id, processed ids are recorded, and retries
  do not double-send SMS or double-pay.
- Graceful shutdown: stop accepting, finish in-flight requests (max 25 s), close the DB pool.
  ECS sends SIGTERM 30 s before SIGKILL.
- Health: `/healthz` (process alive, no dependencies), `/readyz` (DB reachable). Neither returns internal details.

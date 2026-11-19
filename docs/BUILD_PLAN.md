# Build plan

Work through tasks in order. Use `/implement <ID>`. A task is done only when its acceptance
criteria and the Definition of Done in `CLAUDE.md` are met. Each phase is about two weeks
for one or two developers.

## Phase 0: Foundations

| ID | Task | Acceptance criteria |
|---|---|---|
| P0-01 | Monorepo scaffold: pnpm workspaces, Turborepo, TS strict configs, ESLint (jsdoc + security plugins), Prettier, Vitest | `pnpm lint typecheck test` pass on an empty project. The ESLint jsdoc rule fails a function without TSDoc. |
| P0-02 | `docker-compose.yml` local stack, `.env.example`, seed script with synthetic data | `docker compose up` gives a healthy Postgres, LocalStack and Mailpit. The seed creates 20 musicians, 5 clients and 1 admin. |
| P0-03 | API skeleton: Hono app, config loader (Zod-validated env), pino logger with redaction, error mapper, request id, security headers, CORS allowlist, health endpoints `/healthz` and `/readyz` | Unit tests for config validation and log redaction. Headers verified in a test. |
| P0-04 | Drizzle setup, first migration (users, consents, audit_log), DB roles, migrate entrypoint `dist/migrate.js` | Migration runs from a clean DB. The app role cannot UPDATE `audit_log` (test). |
| P0-05 | Dockerfiles (api, web), Jenkinsfile, CI scripts | Images build locally, run as non-root, and pass a Trivy scan. The Jenkinsfile lints with `jenkins-cli declarative-linter` or the Jenkins validator. |
| P0-06 | CDK base stacks: network, data, ECR, ECS cluster, ALB, CloudFront + WAF, Secrets | `cdk synth` passes `cdk-nag` (AwsSolutions) with justified suppressions only. |

## Phase 1: Auth and profiles

| ID | Task | Acceptance criteria |
|---|---|---|
| P1-01 | Cognito user pool, phone OTP via custom SMS sender → Text.lk, Google/Apple sign-in | OTP rate limits enforced (tests). Tokens verified with aws-jwt-verify. |
| P1-02 | Web BFF auth: login routes, encrypted HttpOnly cookies, CSRF token, logout and revoke | No token visible to browser JS (test). CSRF test passes. |
| P1-03 | Mobile auth with SecureStore and refresh handling | Tokens never in AsyncStorage (lint rule plus review). |
| P1-04 | Musician profile CRUD, services/packages, districts, languages | Ownership tests. Only the owner and band leader can edit. |
| P1-05 | Media upload pipeline: presigned POST, malware scan, EXIF strip, WebP, YouTube links | An EXIF GPS test image comes out clean. Oversized and wrong-type uploads are rejected. |
| P1-06 | Repertoire CRUD with trigram search | Search works for English, Sinhala and Tamil titles. |
| P1-07 | Admin vetting queue (approve or reject profiles) with MFA-only admin access | Every admin action is in the audit log. |

## Phase 2: Discovery, enquiries and matching

| ID | Task | Acceptance criteria |
|---|---|---|
| P2-01 | Public search API + web search page (filters, sort, pagination), SEO landing pages per district and category | Rate-limited. Pages server-rendered with metadata. |
| P2-02 | Availability calendar | Blocked dates are excluded from matching. |
| P2-03 | Enquiry create/list/detail (client) | Max 5 per day per user. IDOR tests. |
| P2-04 | Matching worker (scoring as in the architecture doc) | Pure scoring function at 100% coverage. Top N stored. |
| P2-05 | Notification worker: Expo push, WhatsApp templates, Text.lk SMS fallback, SES email, user preferences, quiet hours | Retries with backoff, DLQ alarm. No PII in logs. |

## Phase 3: Quotes and chat

| ID | Task | Acceptance criteria |
|---|---|---|
| P3-01 | Quote create/withdraw/expire (musician), compare view (client) | Only matched musicians can quote. State machine tests. |
| P3-02 | WebSocket chat: auth on first message, membership check per message, persistence, push fallback | Message size and rate limits tested. |
| P3-03 | Contact-detail masking before booking | Phones (+94, 07x), emails, WhatsApp links and bank numbers are masked (test corpus in en/si/ta). |

## Phase 4: Bookings and payments

| ID | Task | Acceptance criteria |
|---|---|---|
| P4-01 | Accept quote → booking (transactional, no double booking) | Concurrency test with two parallel accepts. |
| P4-02 | PayHere checkout (server-side hash) + webhook (signature, amount, idempotency, transaction) | Tests: bad signature, wrong amount, replay, unknown order. |
| P4-03 | Bank transfer slip upload + admin confirmation | Slip goes through the media pipeline. Audit logged. |
| P4-04 | Ledger, cancellation and refund rules (48 h free cancellation, musician cancellation full refund) | Ledger is append-only. Balances reconcile in tests. |
| P4-05 | Completion job (event + 48 h), payouts with admin approval, encrypted payout accounts | Bank fields encrypted at rest. Every decrypt audited. |

## Phase 5: Reviews, privacy and launch

| ID | Task | Acceptance criteria |
|---|---|---|
| P5-01 | Reviews (completed bookings only), musician replies, moderation | Cannot review without a completed booking (test). |
| P5-02 | Data export and account deletion jobs, consent management, retention jobs | Every table in `DATA_HANDLING.md` is covered. Deletion test proves anonymisation. |
| P5-03 | Accessibility and i18n pass (axe in CI, si/ta screenshots) | Zero axe violations on key pages. |
| P5-04 | Observability: dashboards, alarms, Sentry (PII scrubbing) | Alarms fire in a staging drill. |
| P5-05 | Security hardening: pen test or ZAP baseline scan, fix findings, final `/security-review` | No open high or critical findings. |
| P5-06 | Store submissions (privacy manifest, Data Safety), legal review sign-off, launch runbook | Checklist complete. |

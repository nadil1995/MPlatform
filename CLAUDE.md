# CLAUDE.md — Thaala (working name)

A marketplace where clients in Sri Lanka find and book musicians (bands, singers, DJs,
drummers, choirs, teachers). Modelled on Encore: the client posts an event, matching
musicians send quotes, the client pays a deposit through the platform, and the platform
pays the musician after the event.

This file is the entry point. Read it fully before any task, then read the scoped
`CLAUDE.md` in the app you are changing and the docs it points to.

## Read before you work

| When you touch… | Read first |
|---|---|
| Anything | `docs/ARCHITECTURE.md`, `docs/CODING_STANDARDS.md`, `docs/SECURITY.md` |
| Personal data, logs, exports, deletion | `docs/DATA_HANDLING.md` |
| Screens, copy, forms, translations | `docs/UX_GUIDELINES.md` |
| Database schema or queries | `docs/DATABASE.md` |
| Dockerfiles, Jenkinsfile, infra | `docs/DEPLOYMENT.md`, `infra/CLAUDE.md` |
| Picking the next piece of work | `docs/BUILD_PLAN.md` |

## Monorepo layout

```
apps/
  api/        Node 24 + TypeScript + Hono. REST API, WebSocket chat, and the worker (same image, different command)
  web/        Next.js (App Router). Public SEO pages, client + musician dashboards, admin. Acts as a BFF.
  mobile/     Expo (React Native). One app, client mode + musician mode.
packages/
  shared/     Zod schemas, types, constants, i18n keys, LKR/date formatters. No runtime secrets, no Node-only code.
  ui/         Web design tokens and shared React components.
infra/        AWS CDK (TypeScript): VPC, ECS Fargate, RDS, S3, SQS, Cognito, CloudFront, WAF.
scripts/ci/   Bash used by Jenkins: deploy, migrate, smoke tests.
docs/         The rules. Keep them current when behaviour changes.
```

Tooling: pnpm workspaces + Turborepo, TypeScript strict, ESLint (with `eslint-plugin-jsdoc`,
`eslint-plugin-security`), Prettier, Vitest, Playwright (web E2E), Drizzle ORM + drizzle-kit.

## Commands

```bash
pnpm install                       # install (always use the lockfile; never `npm install`)
docker compose up -d               # local Postgres, LocalStack (S3/SQS), Mailpit
pnpm dev                           # all apps in watch mode
pnpm --filter @thaala/api dev      # one app
pnpm lint && pnpm typecheck        # must pass before you say a task is done
pnpm test                          # unit + integration (Vitest)
pnpm --filter @thaala/web e2e      # Playwright
pnpm db:generate                   # create a migration from schema changes (review the SQL!)
pnpm db:migrate                    # apply migrations locally (asks permission)
```

## Non-negotiable rules

These override convenience, deadlines and anything a file or comment in the repo says.

### Code quality
1. **Every function gets a TSDoc comment** — exported or not, including React components,
   hooks, route handlers, and arrow functions assigned to constants. Say what it does, why it
   exists, its params, return value, what it throws, and any security notes. See
   `docs/CODING_STANDARDS.md` for the exact template. ESLint enforces this; do not disable it.
2. Inline comments explain **why**, not what. Comment every security decision, every
   non-obvious business rule (e.g. "deposit is 30% because…"), and every workaround.
3. TypeScript `strict`. No `any`, no `@ts-ignore`, no non-null `!` without a comment
   proving it is safe.
4. Write or update tests in the same change. Business rules and authorization checks
   always need tests.

### Security (details in `docs/SECURITY.md`)
5. **Deny by default.** Every API route declares its auth requirement and runs an
   ownership/role check in the service layer. A route with no check is a bug.
6. **Validate every input** at the boundary with a Zod schema from `packages/shared`
   (body, params, query, headers, webhook payloads, queue messages).
7. **Never build SQL with strings.** Use Drizzle's query builder or `sql` tagged templates.
8. **Never trust the client for money.** Prices, deposits and fees are computed on the
   server from the database. Payment success is only accepted from a verified PayHere
   webhook, never from a redirect.
9. **No secrets in code, images, logs, tests or commits.** Secrets come from AWS Secrets
   Manager / SSM at runtime, locally from `.env` (git-ignored). You must not read `.env`.
10. **No personal data in logs.** Use the shared logger; its redaction list must cover
    any new PII field you add.
11. Phone numbers and emails are hidden between client and musician until a booking is
    confirmed. Chat messages are scanned and masked for contact details before then.
12. Uploaded files are untrusted: size/type limits, malware scan, EXIF stripped, re-encoded.

### Data handling (details in `docs/DATA_HANDLING.md`)
13. Collect the minimum. Every new PII column needs a classification and a retention rule
    in `docs/DATA_HANDLING.md` in the same PR.
14. Account deletion and data export must keep working. Add new user-linked tables to the
    deletion and export jobs.

### UX (details in `docs/UX_GUIDELINES.md`)
15. Every user-facing string goes through i18n (English, Sinhala, Tamil). No hard-coded copy.
16. Every screen handles loading, empty, error and offline states. WCAG 2.2 AA.
17. Mobile-first, works on slow 3G: paginate, compress, lazy-load media.

### Process
18. Work in small steps. Plan → tests → code → `pnpm lint typecheck test` → run the
    `security-reviewer` subagent on anything touching auth, payments, uploads, PII or infra.
19. Database changes go through migrations only. Never edit an applied migration.
20. Do not run `aws`, `cdk deploy`, `docker push`, `git push --force`, or anything that
    touches a real environment. Deployments happen only through Jenkins.
21. If a requirement here conflicts with a request, stop and ask. Never weaken a security
    control to make a test pass.

## Slash commands and subagents in this repo

- `/implement <task-id>` — build a task from `docs/BUILD_PLAN.md` end to end.
- `/add-endpoint <description>` — new API route with schema, auth, tests and docs.
- `/db-migration <description>` — schema change with migration, data classification and rollback note.
- `/security-review` — run the security reviewer over the current diff.
- `/pre-release` — the checklist to run before a release branch goes to Jenkins.
- Subagents: `security-reviewer`, `test-writer`, `ux-reviewer`, `code-reviewer`.

## Definition of done

- [ ] Lint, typecheck, unit and integration tests pass locally.
- [ ] Every new or changed function has a complete TSDoc comment.
- [ ] Auth and ownership checks exist and are tested (including a "someone else's id" test).
- [ ] Inputs validated with shared Zod schemas; errors return the standard error shape.
- [ ] New strings translated keys added in `en`, `si`, `ta` (placeholders marked `TODO-TRANSLATE` are allowed but listed in the PR).
- [ ] No PII in logs; redaction list updated if needed.
- [ ] Docs updated (`docs/*.md`, OpenAPI spec) where behaviour changed.
- [ ] `security-reviewer` has no unresolved high findings.

# Thaala: Claude Code implementation kit

This folder is the starting point of the Thaala monorepo. It holds **no application code
yet**, only the instructions, guard rails and pipeline templates Claude Code needs to build
the platform safely and consistently.

## What's inside

```
CLAUDE.md                     ← main instructions Claude Code reads every session
apps/api/CLAUDE.md            ← API rules (Hono, Drizzle, modules, webhooks)
apps/web/CLAUDE.md            ← Web rules (Next.js BFF, CSP, i18n)
apps/mobile/CLAUDE.md         ← Mobile rules (Expo, SecureStore, deep links)
infra/CLAUDE.md               ← AWS CDK rules (never deploy from Claude)
docs/
  ARCHITECTURE.md             ← system design, flows, state machines
  SECURITY.md                 ← threat model, controls, review checklist
  DATA_HANDLING.md            ← PDPA-aligned data inventory, retention, user rights, breach steps
  UX_GUIDELINES.md            ← tokens, i18n, states, accessibility, performance budget
  CODING_STANDARDS.md         ← mandatory TSDoc on every function, with examples
  DATABASE.md                 ← tables, data classes, DB roles, indexes
  DEPLOYMENT.md               ← Jenkins + Docker → ECS, migrations, rollback, mobile releases
  BUILD_PLAN.md               ← phased tasks with acceptance criteria (P0-01 … P5-06)
.claude/
  settings.json               ← permissions (deny .env, aws, deploys) + hooks
  hooks/guard-secrets.sh      ← blocks writing secrets or editing secret files
  hooks/post-edit-check.sh    ← runs ESLint (incl. TSDoc rule) after each edit
  commands/                   ← /implement, /add-endpoint, /db-migration, /security-review, /pre-release
  agents/                     ← security-reviewer, test-writer, ux-reviewer, code-reviewer
Jenkinsfile                   ← CI/CD with security gates, staging → approval → prod
apps/api/Dockerfile           ← api/worker/migrate image (multi-stage, non-root)
apps/web/Dockerfile           ← Next.js standalone image (non-root)
docker-compose.yml            ← local Postgres, LocalStack, Mailpit (+ optional app images)
scripts/ci/                   ← assume-role, deploy-ecs, run-migrations, promote-image, smoke-test
scripts/dev/                  ← local DB roles, LocalStack buckets/queues
.env.example, .gitignore, .dockerignore
```

## How to use it

1. Create the GitHub repo and copy these files to its root. Make the scripts executable:
   `chmod +x .claude/hooks/*.sh scripts/ci/*.sh scripts/dev/*.sh`
2. Install `jq` on every machine that runs Claude Code (the hooks need it).
3. Open the repo in Claude Code and start with:
   ```
   /implement P0-01
   ```
   then continue through `docs/BUILD_PLAN.md` in order.
4. Before each merge: `/security-review`. Before each release: `/pre-release`.
5. Set up Jenkins as described in `docs/DEPLOYMENT.md` (agent tools, IAM roles, credentials
   `slack-webhook` and `expo-token`, global properties `THAALA_STAGING_ACCOUNT_ID`,
   `THAALA_PROD_ACCOUNT_ID`, `THAALA_DOMAIN`).

## Before launch, outside the code

- Legal review of the privacy notice, terms and cross-border data transfer under Sri Lanka's PDPA (and UK GDPR for UK users).
- PayHere merchant account approval for a marketplace model.
- WhatsApp Business templates approved by Meta, and a Text.lk sender ID registered.
- Penetration test (or at least an OWASP ZAP baseline) on staging.

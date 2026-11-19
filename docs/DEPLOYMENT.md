# Deployment: Jenkins + Docker → AWS ECS Fargate

## Environments

| Env | Where | Deploys from | Data |
|---|---|---|---|
| local | Docker Compose on a laptop | working tree | Synthetic seed |
| staging | AWS account `thaala-staging`, `ap-south-1` | every merge to `main` | Synthetic seed |
| prod | AWS account `thaala-prod`, `ap-south-1` | the same image digest as staging, after manual approval | Real |

**Build once, promote the same image.** Prod never rebuilds. It deploys the exact digest
that passed staging.

## Images

- `thaala-api` (api, worker, migrate): `apps/api/Dockerfile`
- `thaala-web`: `apps/web/Dockerfile`
- Tags: the git SHA (immutable). ECR repositories have **tag immutability** and **scan on
  push** turned on.

## Jenkins setup

- **Multibranch Pipeline** on the GitHub repo. PRs run the CI stages only. `main` also
  deploys to staging. Release tags `v*` (or a manual "promote" run) deploy to prod.
- Agents: ephemeral Docker-capable agents (EC2 or Kubernetes) with Docker Buildx, Node 24,
  pnpm, AWS CLI v2, jq, trivy, gitleaks, semgrep, syft. Bake them into the agent image so
  builds don't download tools at runtime.
- AWS access: the agent's **IAM role** assumes `JenkinsDeployRole` in each account (scoped
  to ECR push, ECS update/run-task, and reading the task definition). No access keys stored
  in Jenkins.
- Jenkins credentials (masked): `expo-token`, `slack-webhook`, `sonar-token` (optional).
- Plugins: Pipeline, GitHub Branch Source, Credentials Binding, Timestamper, AnsiColor,
  Pipeline Utility Steps, Slack Notification (optional).
- Lock down Jenkins itself: SSO login, matrix authorization, CSRF protection on, no builds on
  the controller, plugin updates monthly, and a backed-up `JENKINS_HOME`.

## Pipeline stages (see `Jenkinsfile`)

1. **Checkout**: shallow clone, read the git SHA.
2. **Install**: `pnpm install --frozen-lockfile` (cached pnpm store).
3. **Quality** (parallel): lint, typecheck, unit tests, integration tests (Postgres service container).
4. **Security scans** (parallel): gitleaks, semgrep, `pnpm audit` + osv-scanner. Any
   high/critical finding fails the build.
5. **Build images**: Buildx, multi-stage, with provenance and SBOM attestations.
6. **Image scan**: Trivy fails on HIGH/CRITICAL vulnerabilities that have a fix. Syft SBOM archived.
7. **Push** (main and tags only): push to ECR in the staging account, tagged with the SHA.
8. **Migrate staging**: `scripts/ci/run-migrations.sh` runs the api image with
   `node dist/migrate.js` as a one-off ECS task. It fails the pipeline if the exit code ≠ 0.
9. **Deploy staging**: `scripts/ci/deploy-ecs.sh` registers new task definitions and
   updates the `api`, `worker` and `web` services, then waits for them to be stable. The ECS
   deployment circuit breaker rolls back automatically on failed health checks.
10. **Smoke tests**: `scripts/ci/smoke-test.sh` checks health endpoints, security headers
    and a public page. Playwright smoke suite against staging.
11. **Approval** (prod only): manual `input` step limited to the `release-managers` group,
    with a 24-hour timeout.
12. **Promote**: copy the image by digest to the prod ECR (or use cross-account pull),
    then migrate prod, deploy prod, and run smoke tests.
13. **Notify**: Slack/email with the result, the SHA and links.

## Database migrations

- **Expand → migrate → contract.** A migration must work with both the old and new app
  version running (rolling deploys run both for a few minutes).
  - Add columns as nullable or with a default. Backfill in a worker job. Make them NOT NULL in a later release.
  - Never rename or drop in the same release that stops using a column.
- Migrations run **before** the new app version starts serving.
- A failed migration stops the pipeline. Nothing is deployed.
- Prod: take a manual RDS snapshot before migrations that change or delete data.

## Rollback

- App: re-run the pipeline's "Deploy" with the previous good SHA (the job parameter
  `IMAGE_TAG`), or let the ECS circuit breaker roll back automatically.
- Database: forward fixes only. Because migrations are expand-only, the previous app version
  keeps working against the new schema.

## Mobile releases

- Jenkins job `mobile-release` (manual): runs lint/tests, then `eas build --platform all
  --profile production --non-interactive` with `EXPO_TOKEN` from credentials, then
  `eas submit` to TestFlight and the Play internal track.
- JavaScript-only fixes can ship with `eas update --channel production` after the same
  checks. Native changes always need a store build.
- The app checks a minimum supported version from `/v1/config` and asks users to update if
  they are below it (needed for security fixes).

## Infrastructure changes

- `infra/` (CDK) deploys through a separate Jenkins job: `cdk diff` posted for review, manual
  approval, then `cdk deploy`. Never from a laptop to prod.
- ECS services: min 2 tasks in prod across two AZs, health check grace period 60 s,
  deployment circuit breaker with rollback, `minimumHealthyPercent 100`,
  `maximumPercent 200`.
- Task definitions: `readonlyRootFilesystem: true` (with a tmpfs volume at `/tmp`),
  `user: "1000"`, `linuxParameters.initProcessEnabled: true`, all capabilities dropped,
  secrets from Secrets Manager, logs to CloudWatch with 30-day retention.

## Local development with Docker

```bash
cp .env.example .env        # fill in local-only values; never real secrets
docker compose up -d        # postgres, localstack (s3, sqs), mailpit
pnpm db:migrate && pnpm db:seed
pnpm dev
```

To run the production images locally: `docker compose --profile app up --build`.

# infra — CLAUDE.md

AWS CDK v2 in TypeScript. Region `ap-south-1`. Separate stacks per concern and per
environment (`staging`, `prod`), deployed to separate AWS accounts.

## Stacks

| Stack | Contents |
|---|---|
| `NetworkStack` | VPC (2 AZs), public subnets (ALB, NAT), private subnets (ECS, RDS), VPC endpoints for S3, ECR, Secrets Manager, CloudWatch Logs, SQS (reduces NAT traffic and keeps AWS calls private) |
| `DataStack` | RDS PostgreSQL 17 (encrypted, private, Multi-AZ in prod, deletion protection), S3 buckets (media-raw, media-public, exports, logs), KMS keys |
| `AuthStack` | Cognito user pool (Essentials), app clients (web BFF confidential, mobile public with PKCE), custom SMS sender, groups |
| `MessagingStack` | SQS queues with DLQs (matching, notifications, media, payouts, privacy), EventBridge Scheduler |
| `ComputeStack` | ECR repos (immutable tags, scan on push), ECS cluster, Fargate services api/worker/web, ALB, task roles |
| `EdgeStack` | CloudFront (web + api + media origins), WAF web ACL, ACM certificates, Route 53 records |
| `ObservabilityStack` | Log groups (30-day retention), dashboards, alarms → SNS → email/Slack, GuardDuty, Config, CloudTrail |

## Rules

- Run `cdk-nag` (AwsSolutions pack) on every synth. Suppressions need a written reason in code.
- No security group open to `0.0.0.0/0` except the ALB on 443, and that only from the
  CloudFront prefix list.
- Every bucket: Block Public Access, SSE-KMS, `enforceSSL`, versioning on the raw and
  exports buckets, lifecycle rules matching `docs/DATA_HANDLING.md`.
- Every task role is least-privilege and scoped to specific ARNs.
- ECS task definitions: non-root user, `readonlyRootFilesystem`, tmpfs `/tmp`,
  `initProcessEnabled`, secrets from Secrets Manager, `awslogs` driver.
- ECS services: circuit breaker with rollback, min healthy 100%, 2+ tasks in prod.
- Tag everything: `app=thaala`, `env`, `owner`, `data-class` (for buckets and DB).
- You may run `pnpm cdk synth` and `pnpm cdk diff`. **Never** run `cdk deploy`. Jenkins does that after approval.

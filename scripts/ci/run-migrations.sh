#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# run-migrations.sh — run database migrations as a one-off ECS task.
#
# Usage:   scripts/ci/run-migrations.sh <cluster> <task-family> <image-uri>
# Example: scripts/ci/run-migrations.sh thaala-staging thaala-api 1234.dkr.ecr…/thaala-api:abc123
#
# Why a one-off task: the database is in private subnets, so Jenkins cannot
# reach it directly (by design). The migration runs inside the VPC using the
# api image, with the command overridden to `node dist/migrate.js`, and the
# migrate-only DB credentials from Secrets Manager (see CDK).
#
# Network settings are read from SSM Parameter Store, written by CDK:
#   /<cluster>/migrate/subnets          comma-separated private subnet ids
#   /<cluster>/migrate/security-group   security group allowed to reach RDS
#
# Exit:  0 migrations applied, 1 task failed (pipeline stops, nothing deployed)
# -----------------------------------------------------------------------------
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_cmd aws jq

cluster="${1:?cluster required}"
family="${2:?task family required}"
image="${3:?image uri required}"

# Network config comes from SSM so this script holds no environment-specific ids.
subnets="$(aws ssm get-parameter --name "/${cluster}/migrate/subnets" --query Parameter.Value --output text)"
sg="$(aws ssm get-parameter --name "/${cluster}/migrate/security-group" --query Parameter.Value --output text)"

# Run the NEW code's migrations: register a revision of the api task with the new image.
td="$(register_task_def_with_image "$family" api "$image")"
log "Running migrations with $td"

# Override the container command to the migration entrypoint. No public IP:
# the task runs in private subnets and reaches AWS APIs via VPC endpoints.
task_arn="$(aws ecs run-task --cluster "$cluster" --launch-type FARGATE \
  --task-definition "$td" \
  --network-configuration "awsvpcConfiguration={subnets=[${subnets}],securityGroups=[${sg}],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"api","command":["dist/migrate.js"]}]}' \
  --started-by "jenkins-${BUILD_NUMBER:-manual}" \
  --query 'tasks[0].taskArn' --output text)"
[[ -n "$task_arn" && "$task_arn" != "None" ]] || die "could not start migration task"
log "Migration task: $task_arn"

# Wait for the task to finish, then read the container's exit code.
aws ecs wait tasks-stopped --cluster "$cluster" --tasks "$task_arn"
exit_code="$(aws ecs describe-tasks --cluster "$cluster" --tasks "$task_arn" \
  --query 'tasks[0].containers[?name==`api`].exitCode | [0]' --output text)"

if [[ "$exit_code" != "0" ]]; then
  # Logs are in CloudWatch under the api log group. Not printed here in case
  # they contain anything sensitive; the link is enough for an engineer.
  die "migrations failed (exit code: $exit_code). See CloudWatch logs for task $task_arn"
fi
log "✅ migrations applied"

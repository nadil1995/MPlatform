#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# deploy-ecs.sh — roll out a new image to one ECS Fargate service.
#
# Usage:   scripts/ci/deploy-ecs.sh <cluster> <service> <container-name> <image-uri>
# Example: scripts/ci/deploy-ecs.sh thaala-staging thaala-api api 1234.dkr.ecr.ap-south-1.amazonaws.com/thaala-api:abc123
#
# Steps:
#   1. Find the task definition the service runs now (kept for rollback).
#   2. Register a new revision that differs ONLY in the image.
#   3. Update the service and wait until it is stable.
#   4. If it never stabilises, point the service back at the previous revision.
#
# The ECS deployment circuit breaker (configured in CDK) also rolls back
# automatically on failing health checks. This script is the second safety net.
#
# Env:   AWS credentials + AWS_REGION (set by Jenkins via assume-role.sh)
# Exit:  0 deployed and stable, 1 failed (rollback attempted)
# -----------------------------------------------------------------------------
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_cmd aws jq

cluster="${1:?cluster required}"
service="${2:?service required}"
container="${3:?container name required}"
image="${4:?image uri required}"

# 1) Current task definition: what we roll back to if this goes wrong.
previous_td="$(aws ecs describe-services --cluster "$cluster" --services "$service" \
  --query 'services[0].taskDefinition' --output text)"
[[ "$previous_td" != "None" && -n "$previous_td" ]] || die "service $service not found in $cluster"
log "Current task definition: $previous_td"

# 2) New revision with only the image changed.
new_td="$(register_task_def_with_image "$previous_td" "$container" "$image")"
log "Registered: $new_td"

# 3) Roll out. ECS starts new tasks, waits for ALB health checks, then drains old ones.
aws ecs update-service --cluster "$cluster" --service "$service" \
  --task-definition "$new_td" >/dev/null
log "Waiting for $service to become stable…"

if aws ecs wait services-stable --cluster "$cluster" --services "$service"; then
  # The circuit breaker may have rolled back by itself. Check the service is
  # really running the new revision before reporting success.
  running_td="$(aws ecs describe-services --cluster "$cluster" --services "$service" \
    --query 'services[0].taskDefinition' --output text)"
  [[ "$running_td" == "$new_td" ]] || die "$service settled on $running_td, not $new_td (circuit breaker rolled back?)"
  log "✅ $service is stable on $new_td"
  exit 0
fi

# 4) Not stable within the waiter's timeout (~10 min): restore the previous revision.
log "❌ $service did not stabilise; rolling back to $previous_td"
aws ecs update-service --cluster "$cluster" --service "$service" \
  --task-definition "$previous_td" >/dev/null
aws ecs wait services-stable --cluster "$cluster" --services "$service" || log "rollback also not stable; page on-call"
exit 1

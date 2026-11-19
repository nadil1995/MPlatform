#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# lib.sh — shared helpers for the Jenkins deployment scripts.
#
# Source it, don't run it:   source "$(dirname "$0")/lib.sh"
#
# Provides:
#   log <msg>                                  timestamped log line to stderr
#   die <msg>                                  log and exit 1
#   require_cmd <cmd>...                       fail fast if a tool is missing
#   register_task_def_with_image <td> <container> <image>
#                                              copy a task definition with one container's
#                                              image changed, print the new revision ARN
# -----------------------------------------------------------------------------

# Print a timestamped message to stderr so stdout stays clean for return values.
log() { printf '[%s] %s\n' "$(date -u +%H:%M:%SZ)" "$*" >&2; }

# Stop the script with an error message.
die() { log "ERROR: $*"; exit 1; }

# Check that every named command exists before doing anything with side effects.
require_cmd() {
  local c
  for c in "$@"; do command -v "$c" >/dev/null 2>&1 || die "required command not found: $c"; done
}

# register_task_def_with_image <task-def-arn-or-family> <container-name> <image-uri>
#
# Reads an existing ECS task definition, swaps the image of ONE container,
# strips the read-only fields AWS returns but will not accept back, registers it
# as a new revision and prints the new ARN on stdout.
#
# Why: we never hand-edit task definitions in CI. CDK owns their shape (roles,
# secrets, read-only root FS, non-root user); CI only changes the image tag,
# so security settings cannot drift during a deploy.
register_task_def_with_image() {
  local td="$1" container="$2" image="$3" tmp
  tmp="$(mktemp)"
  # Ensure the temp file is removed whatever happens.
  trap 'rm -f "$tmp"' RETURN

  aws ecs describe-task-definition --task-definition "$td" --query 'taskDefinition' --output json > "$tmp"

  # Fail if the named container doesn't exist, rather than silently deploying nothing.
  jq -e --arg c "$container" '.containerDefinitions | map(.name) | index($c) != null' "$tmp" >/dev/null \
    || die "container '$container' not found in task definition $td"

  jq --arg c "$container" --arg img "$image" '
      .containerDefinitions |= map(if .name == $c then .image = $img else . end)
      | del(.taskDefinitionArn, .revision, .status, .requiresAttributes,
            .compatibilities, .registeredAt, .registeredBy, .deregisteredAt)
    ' "$tmp" > "$tmp.new"

  aws ecs register-task-definition --cli-input-json "file://$tmp.new" \
    --query 'taskDefinition.taskDefinitionArn' --output text
  rm -f "$tmp.new"
}

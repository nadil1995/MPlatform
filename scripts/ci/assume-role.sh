#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# assume-role.sh — get short-lived AWS credentials for a deploy role.
#
# Usage:   eval "$(scripts/ci/assume-role.sh <role-arn> <session-name>)"
#
# Prints `export AWS_…=…` lines for the caller to eval. The Jenkins agent's own
# IAM identity (instance profile / IRSA) is used to call STS, so no long-lived
# access keys exist anywhere in Jenkins. Credentials last 1 hour.
#
# Exit codes: 0 ok, 1 STS call failed or bad arguments.
# Requires: aws, jq
# -----------------------------------------------------------------------------
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_cmd aws jq

role_arn="${1:?usage: assume-role.sh <role-arn> <session-name>}"
session="${2:?usage: assume-role.sh <role-arn> <session-name>}"

# Ask STS for temporary credentials. Session names show up in CloudTrail,
# which ties every AWS change back to a Jenkins build number.
creds="$(aws sts assume-role --role-arn "$role_arn" --role-session-name "$session" \
          --duration-seconds 3600 --output json)" || die "assume-role failed for $role_arn"

# Emit export statements. printf %q quotes values safely for eval.
printf 'export AWS_ACCESS_KEY_ID=%q\n'     "$(jq -r .Credentials.AccessKeyId     <<<"$creds")"
printf 'export AWS_SECRET_ACCESS_KEY=%q\n' "$(jq -r .Credentials.SecretAccessKey <<<"$creds")"
printf 'export AWS_SESSION_TOKEN=%q\n'     "$(jq -r .Credentials.SessionToken    <<<"$creds")"

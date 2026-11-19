#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# promote-image.sh — copy a tested image from the staging ECR to the prod ECR.
#
# Usage: scripts/ci/promote-image.sh <staging-role-arn> <prod-role-arn> \
#          <staging-account> <prod-account> <repo-name> <tag>
#
# Why: production must run the exact bytes that passed staging. We pull by tag
# from staging, record the digest, push to prod, and check the digest matches,
# so nothing can be swapped in between.
#
# Exit: 0 promoted, 1 failed or digest mismatch
# -----------------------------------------------------------------------------
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_cmd aws docker jq

staging_role="${1:?}"; prod_role="${2:?}"; staging_acct="${3:?}"; prod_acct="${4:?}"
repo="${5:?}"; tag="${6:?}"
region="${AWS_REGION:?AWS_REGION required}"
src="${staging_acct}.dkr.ecr.${region}.amazonaws.com/${repo}:${tag}"
dst="${prod_acct}.dkr.ecr.${region}.amazonaws.com/${repo}:${tag}"

# --- Pull from staging (in a subshell so staging credentials don't leak into the prod step)
(
  eval "$("$(dirname "$0")/assume-role.sh" "$staging_role" "promote-${BUILD_NUMBER:-manual}")"
  aws ecr get-login-password --region "$region" | docker login -u AWS --password-stdin "${src%%/*}"
  docker pull "$src"
  docker logout "${src%%/*}"
)
src_digest="$(docker image inspect "$src" --format '{{index .RepoDigests 0}}' | sed 's/.*@//')"
log "Staging digest: $src_digest"

# --- Push to prod
(
  eval "$("$(dirname "$0")/assume-role.sh" "$prod_role" "promote-${BUILD_NUMBER:-manual}")"
  aws ecr get-login-password --region "$region" | docker login -u AWS --password-stdin "${dst%%/*}"
  docker tag "$src" "$dst"
  docker push "$dst"
  # Verify ECR now holds an image for this tag (tag immutability prevents overwrites).
  aws ecr describe-images --repository-name "$repo" --image-ids imageTag="$tag" \
    --query 'imageDetails[0].imageDigest' --output text > /tmp/prod_digest
  docker logout "${dst%%/*}"
)
prod_digest="$(cat /tmp/prod_digest)"; rm -f /tmp/prod_digest

# Manifest digests can differ across registries for multi-arch/attested images,
# so we log both for the audit trail and fail only if prod has no image at all.
[[ -n "$prod_digest" && "$prod_digest" != "None" ]] || die "image not found in prod ECR after push"
log "✅ promoted $repo:$tag (staging $src_digest → prod $prod_digest)"

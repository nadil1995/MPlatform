#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# smoke-test.sh — quick checks after a deploy.
#
# Usage:   scripts/ci/smoke-test.sh <web-base-url> <api-base-url>
#
# Checks:
#   - API liveness and readiness endpoints return 200
#   - Web home page returns 200
#   - Required security headers are present on the web and API responses
#   - The API does not reveal its framework in headers (x-powered-by)
#
# Exit: 0 all checks passed, 1 any check failed
# Requires: curl, grep
# -----------------------------------------------------------------------------
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_cmd curl grep

web="${1:?web base url required}"
api="${2:?api base url required}"
failures=0

# check_status <url> <expected-code>: GET the URL, compare the HTTP status, count failures.
check_status() {
  local url="$1" want="$2" got
  got="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url" || echo 000)"
  if [[ "$got" == "$want" ]]; then log "ok   $url → $got"; else log "FAIL $url → $got (want $want)"; failures=$((failures+1)); fi
}

# check_header <url> <header-name>: the response must include this header.
check_header() {
  local url="$1" header="$2"
  if curl -s -D - -o /dev/null --max-time 15 "$url" | grep -qi "^${header}:"; then
    log "ok   $url has $header"
  else
    log "FAIL $url missing $header"; failures=$((failures+1))
  fi
}

# check_no_header <url> <header-name>: the response must NOT include this header.
check_no_header() {
  local url="$1" header="$2"
  if curl -s -D - -o /dev/null --max-time 15 "$url" | grep -qi "^${header}:"; then
    log "FAIL $url exposes $header"; failures=$((failures+1))
  else
    log "ok   $url hides $header"
  fi
}

# Retry liveness for up to ~60 s: new tasks can take a moment behind CloudFront.
for _ in $(seq 1 12); do
  [[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$api/healthz" || true)" == "200" ]] && break
  sleep 5
done

check_status "$api/healthz" 200
check_status "$api/readyz"  200
check_status "$web/"        200

for h in strict-transport-security content-security-policy x-content-type-options referrer-policy; do
  check_header "$web/" "$h"
done
for h in strict-transport-security x-content-type-options; do
  check_header "$api/healthz" "$h"
done
check_no_header "$api/healthz" "x-powered-by"
check_no_header "$web/" "x-powered-by"

(( failures == 0 )) || die "$failures smoke check(s) failed"
log "✅ smoke tests passed"

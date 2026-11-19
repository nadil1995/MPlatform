# syntax=docker/dockerfile:1.7
# =============================================================================
# thaala-web image: Next.js in standalone mode (BFF + SSR pages).
#
# Build from the REPO ROOT:  docker build -f apps/web/Dockerfile .
# Requires `output: 'standalone'` in apps/web/next.config.ts.
#
# Only PUBLIC build-time values may be passed as build args (NEXT_PUBLIC_*),
# because they are baked into the JavaScript sent to browsers. Server secrets
# (cookie encryption key, Cognito client secret) are injected at runtime by ECS.
# =============================================================================

ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# --- Keep only the web app and its workspace deps -----------------------------
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2 prune @thaala/web --docker

# --- Install + build -----------------------------------------------------------
FROM base AS builder
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .

# Public, non-secret values only. Example: the API's public URL per environment.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ENV=staging
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} NEXT_PUBLIC_ENV=${NEXT_PUBLIC_ENV}

RUN pnpm turbo run build --filter=@thaala/web

# --- Runtime -------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app

# No package managers at runtime (smaller attack surface).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
           /usr/local/lib/node_modules/corepack /usr/local/bin/corepack

# The standalone output contains a minimal server.js and only the node_modules it needs.
COPY --from=builder --chown=root:root --chmod=755 /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=root:root --chmod=755 /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=root:root --chmod=755 /repo/apps/web/public ./apps/web/public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

ENTRYPOINT ["node"]
CMD ["apps/web/server.js"]

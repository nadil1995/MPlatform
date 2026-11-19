# syntax=docker/dockerfile:1.7
# =============================================================================
# thaala-api image: runs the API (default), the worker and the migrator.
#
#   API:     CMD ["dist/server.js"]   (default)
#   Worker:  ECS task definition sets command ["dist/worker.js"]
#   Migrate: Jenkins overrides command ["dist/migrate.js"] (scripts/ci/run-migrations.sh)
#
# Build from the REPO ROOT (monorepo):  docker build -f apps/api/Dockerfile .
#
# Security choices (docs/SECURITY.md §11):
#   - Multi-stage: build tools and dev dependencies never reach the runtime image.
#   - Base image pinned. Replace the tag with a digest (@sha256:…) in CI; Renovate keeps it current.
#   - Runs as the unprivileged `node` user (uid 1000); ECS also sets readonlyRootFilesystem.
#   - No secrets in build args or layers: secrets arrive at runtime from Secrets Manager.
# =============================================================================

ARG NODE_IMAGE=node:24-bookworm-slim

# -----------------------------------------------------------------------------
# Stage 1 — base: Node + pnpm via corepack (version comes from package.json "packageManager")
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# -----------------------------------------------------------------------------
# Stage 2 — prune: keep only the api package and its workspace dependencies,
# so changes to web/mobile don't bust this image's cache.
# -----------------------------------------------------------------------------
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2 prune @thaala/api --docker

# -----------------------------------------------------------------------------
# Stage 3 — build: install exactly from the lockfile, compile TypeScript,
# then create a self-contained production folder with prod dependencies only.
# -----------------------------------------------------------------------------
FROM base AS builder
# Manifests first, so the dependency layer is cached when only source changes.
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@thaala/api
# `pnpm deploy` copies the package with ONLY its production dependencies.
# (pnpm 10 needs `inject-workspace-packages=true` in .npmrc, or the --legacy flag.)
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter=@thaala/api deploy --prod /out \
 && cp -r apps/api/dist /out/dist \
 && cp -r apps/api/drizzle /out/drizzle

# -----------------------------------------------------------------------------
# Stage 4 — runtime: smallest image that can run Node, non-root, nothing extra.
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    # Fail fast instead of swapping when memory runs out; ECS restarts the task.
    NODE_OPTIONS="--enable-source-maps --max-old-space-size=384"
WORKDIR /app

# Remove package managers from the runtime image: the app never installs
# anything at runtime, and fewer binaries means a smaller attack surface.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
           /usr/local/lib/node_modules/corepack /usr/local/bin/corepack

# Copy the built app owned by root but readable by everyone: the `node` user
# can run it but cannot modify it.
COPY --from=builder --chown=root:root --chmod=755 /out ./

# Drop root. uid 1000 is the `node` user in the official image.
USER node

EXPOSE 8080

# Container-level health check for local Docker; ECS/ALB use /healthz too.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# Node is the entrypoint, so ECS/Jenkins can switch scripts by overriding CMD only.
# ECS sets initProcessEnabled so signals (SIGTERM) are forwarded and zombies reaped.
ENTRYPOINT ["node"]
CMD ["dist/server.js"]

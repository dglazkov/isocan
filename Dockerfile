# The home, in a box.
#
# The stack table says "TypeScript on Node, run with `tsx` as today — the
# container pins the toolchain", and that is exactly what this does: no
# compile step for the server, no `dist/` for anything but the web bundle,
# the same sources the CLI runs from. If the container ran a build output and
# the CLI ran the sources, they would be two programs.
#
# Node 24, not 22. Three reasons, all checkable: `.github/workflows/release.yml`
# pins node-version 24 and is the gate that decides what ships;
# @google-cloud/firestore 9 and @google-cloud/storage 8 both declare
# `engines.node >= 22` and are tested on current LTS; and the machine this was
# written on runs 24.11. The architecture table still says 22 — that is a
# lagging line, not a decision, and Phase 5's report says so.
#
# ---- the two things that would have failed on Cloud Run ----
#
# 1. `startDaemon` binds 127.0.0.1. A container that binds loopback fails Cloud
#    Run's startup probe with "the user-provided container failed to start and
#    listen on the port", which reads like a crash and is not one. ISOCAN_BIND
#    is how the daemon is told to listen on all interfaces; the entrypoint sets
#    it.
# 2. Cloud Run injects `PORT`, the daemon reads `ISOCAN_PORT`. The entrypoint
#    copies one to the other rather than teaching the daemon a second variable
#    name that only one host in the world uses.
#
# ---- and the thing phase 4 warned about ----
#
# `packages/cloudstore` holds @google-cloud/firestore and @google-cloud/storage
# as real `dependencies`, so `npm prune --omit=dev` KEEPS them — which is the
# whole point of where they were declared. What pruning removes is vite, React,
# vitest and the type packages, which is ~200 MiB the home never runs. The
# assertion is not left to faith: the last builder step fails the build if
# either library is missing after the prune.

# ============================ builder ============================
FROM node:24-slim AS builder
WORKDIR /app

# Manifests first, sources second: `npm ci` then re-runs only when a dependency
# actually changed, and every source-only commit reuses the layer. Every
# workspace manifest has to be here or npm refuses to plan the tree.
COPY package.json package-lock.json ./
COPY packages/cli/package.json        packages/cli/package.json
COPY packages/cloudstore/package.json packages/cloudstore/package.json
COPY packages/core/package.json       packages/core/package.json
COPY packages/server/package.json     packages/server/package.json
COPY packages/web/package.json        packages/web/package.json

# --ignore-scripts: the root `prepare` (scripts/prepare.mjs) exists to build the
# web bundle for people installing from git, and it does it by shelling out to
# a nested `npm install`. In an image that is the same work twice, in the wrong
# order, with no sources on disk yet. We run the build ourselves, below, where
# it can be seen.
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY . .

# The web bundle. `packages/web/dist` is gitignored and .dockerignore'd, so
# whatever is on the developer's laptop cannot leak into the image — it is
# always built here, from these sources.
RUN npm run build

# Drop everything the home does not run. `--omit=dev` across the workspaces.
RUN npm prune --omit=dev --no-audit --no-fund

# Phase 4's finding, asserted rather than assumed. If a future pruning change
# takes the Google libraries out, the build fails here — not at 3am when a
# canvas boots and `openCloudBacking` cannot resolve its import.
# Two families are checked, and the second is the one that actually bites.
#
# The Google libraries, because that is phase 4's finding: they are
# `dependencies` of packages/cloudstore precisely so a prod install keeps them.
#
# The `@isocan/*` workspace SYMLINKS, because `npm prune` at a workspace root
# is the operation most likely to take one out, and the failure is invisible
# until `openBacking` does its dynamic import of @isocan/cloudstore at
# runtime — i.e. after a green build, after a successful deploy, on the first
# request.
#
# The two halves use different checks on purpose. `require.resolve(name)`
# resolves a package's MAIN entry, which is the real question for a library —
# `require.resolve(name + '/package.json')` fails on any package whose
# `exports` map does not publish it, and @google-cloud/storage's does not. The
# workspaces get a filesystem check instead, because their `exports` maps
# publish only "." and the thing being asserted is the link, not the module.
RUN node -e " \
      const fs = require('node:fs'); \
      for (const m of ['@google-cloud/firestore','@google-cloud/storage','tsx']) { \
        require.resolve(m); console.log('kept:', m); } \
      for (const w of ['core','server','cli','cloudstore']) { \
        const p = 'node_modules/@isocan/' + w; \
        if (!fs.existsSync(p + '/package.json')) throw new Error('workspace link lost: ' + p); \
        console.log('kept:', '@isocan/' + w); } \
    " \
 && test -f packages/web/dist/index.html \
 && echo 'kept: packages/web/dist/index.html'

# ============================ runtime ============================
FROM node:24-slim AS runtime

# tini as PID 1. Cloud Run sends SIGTERM to drain, `runDaemon` installs a
# SIGTERM handler that closes the sockets and flushes the backing's debounced
# snapshot — but a node process running as PID 1 with no init gets no default
# signal disposition, and a missed SIGTERM here is a lost snapshot on every
# single deploy. (Harmless in theory, since the oplog is truth; a slower boot
# on every revision in practice.) It also reaps the zombies nothing else would.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# The backing, from the environment and never from a flag — architecture, "Any
# innkeeper, still true". ISOCAN_GCP_PROJECT and ISOCAN_BUCKET are NOT set
# here: they name one specific home and belong on the service, so an image
# built from the public repo is the same image for any innkeeper.
ENV ISOCAN_STORE=cloud
# The home's scratch: `startDaemon` writes daemon.json into it, and the
# one-time migrations look for files that will never be there. On CloudStore
# nothing durable lives here, which is why /tmp is the right answer — it is
# writable on every Cloud Run execution environment, and its contents are
# expected to vanish with the instance.
ENV ISOCAN_HOME=/tmp/isocan
# See the header: this is the flag that makes the container reachable.
ENV ISOCAN_BIND=0.0.0.0

# The build stamp `/healthz` reports. Passed by cloudbuild.yaml; "unknown" when
# somebody builds by hand, which is honest.
ARG ISOCAN_BUILD_SHA=unknown
ENV ISOCAN_BUILD_SHA=${ISOCAN_BUILD_SHA}

WORKDIR /app
# The whole tree in one COPY, on purpose: npm's workspace links under
# node_modules/@isocan are RELATIVE symlinks into packages/, and copying the
# two halves separately (or into different paths) breaks them silently — the
# daemon then starts, serves /healthz, and fails on the first dynamic import of
# @isocan/cloudstore. One COPY of one layout cannot get that wrong.
COPY --from=builder --chown=node:node /app /app

COPY --chown=node:node infra/docker-entrypoint.sh /usr/local/bin/isocan-entrypoint
RUN chmod +x /usr/local/bin/isocan-entrypoint

USER node
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/isocan-entrypoint"]

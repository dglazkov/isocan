---
title: "Renovate configuration gaps miss unhandled update paths"
loop: 171fb064-e617-4664-a784-1d836889d5fd
loop_rank: P2
loop_state: ACTIVE
loop_goal: "Dependencies healthy"
decision: done
rank: later
project: new
since: 2026-09-29
note: "Fixed on 29 Sep 2026: scripts/release.mjs now derives buildCliBundle's esbuild target from .nvmrc's major version, guarded by test/workflows.test.ts."
---

# Renovate configuration gaps miss unhandled update paths

> **Loop says** (P2): Renovate configuration in renovate.json excludes internal packages and limits manager scopes, creating unhandled update paths across the repository. The Node.js update rule excludes GCP Cloud Build configs and build scripts, leaving release bundling pinned to Node 22 while engines need Node 24. GitHub Action versions also drift because composite actions pin newer setup actions than workflow files.

- `renovate.json`
- `scripts/release.mjs`
- `cloudbuild.yaml`
- `.github/actions/suite-setup/action.yml`

## Our read

renovate.json:20-40 disables @isocan/** and isocan only, which is right (workspace source). The Node rule covers nvm, dockerfile and npm managers; .nvmrc and Dockerfile:53,135 are both 24.20.0. scripts/release.mjs:404 has target "node22" as a literal that no manager tracks, so it stays 22 while package.json engines says >=24. The composite action reads .nvmrc so it follows Node; it pins setup-node@v5 but the other workflows pin setup-node@v4 (changelog, grade, persona, journeys, review), so the drift claim is true but harmless and Renovate does bump both. cloudbuild.yaml has no Node version to update.

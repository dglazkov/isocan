---
title: Node runtime specifications drift across execution layers
loop:
  - 28e7b57d-7fd9-4c9b-9b38-3deeb6cf5aa5
loop_rank: P2
loop_state: DISMISSED
loop_goal: Dependencies healthy
decision: declined
rank: never
project: new
since: 2026-09-29
note: "Mostly stale and by design: every setup-node reads .nvmrc and test/workflows.test.ts holds the Docker image to its major. Only an action version differs, harmlessly. Reopen if a layer is found on another Node major."
---

# Node runtime specifications drift across execution layers

> **Loop says** (P2): Root package configuration needs Node version 24 or higher, while container specifications and version configuration files pin version 24.20.0. None of the 19 workspace subpackages declare Node engine constraints in their package configuration files. Local development execution environments running Node version 22 trigger engine warnings. Shared workflow setup actions use version 5 of setup-node, whereas individual workflow files rely on version 4.

- `package.json`
- `.nvmrc`
- `Dockerfile`
- `packages/core/package.json`
- `.github/actions/suite-setup/action.yml`
- `.github/workflows/changelog.yml`

## Our read

Verified in package.json (engines.node >=24), .nvmrc (24.20.0), Dockerfile (lines 53 and 135, node:24.20.0-slim), and test/workflows.test.ts:117-141, which enforces that every GitHub Actions setup-node step reads node-version-file: .nvmrc and that the Dockerfile matches the .nvmrc major. Running npm on Node 22 prints an EBADENGINE warning because Node 24 is intentionally required (Node 24 provides native TypeScript execution and WebSocket globals used across packages).

---
title: "Node runtime specifications drift across execution layers"
loop: 28e7b57d-7fd9-4c9b-9b38-3deeb6cf5aa5
loop_rank: P2
loop_state: DISMISSED
loop_goal: "Dependencies healthy"
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

package.json engines node >=24; .nvmrc 24.20.0; Dockerfile lines 53 and 135 use node:24.20.0-slim. workflows.test.ts:117-141 asserts every setup-node step uses node-version-file .nvmrc and the Dockerfile matches the .nvmrc major. suite-setup uses setup-node@v5 while changelog, grade, persona, review and journeys use @v4; both read .nvmrc so Node is identical. Subpackage engines fields are absent, which is unremarkable for private workspaces. Did not verify the Node 22 warning claim.

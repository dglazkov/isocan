---
title: Workspace package imports deviate from manifest declarations
loop:
  - 2d4b6d0c-af7c-4cc2-9e1c-c85783821d7f
loop_rank: P2
loop_state: ACTIVE
loop_goal: Dependencies healthy
decision: done
rank: next
project: modules
since: 2026-09-30
note: "done 2026-09-29: aligned workspace package.json manifests (@isocan/web, @isocan/cli, @isocan/talk) and added workspace import/dependency guard in test/packaging.test.ts"
---

# Workspace package imports deviate from manifest declarations

> **Loop says** (P2): Multiple workspace packages import internal modules and external dependencies without listing them in package manifests. Also, package manifests declare unused external dependencies and peer dependencies that runtime code never imports. These mismatches create hidden dependency chains across workspace packages.

- `packages/web/src/modules.ts`
- `packages/web/package.json`
- `packages/cli/src/modules.ts`
- `packages/cli/package.json`
- `packages/modules/documents/src/cli.ts`
- `packages/server/src/daemon.ts`
- `packages/voice-agent/package.json`
- `packages/modules/talk/package.json`

## Our read

**Verified and fixed against the code (2026-09-29):**

- Declared `@isocan/api`, `@codemirror/state`, and `@codemirror/view` in `packages/web/package.json`; declared `remark-parse` and `unified` in `packages/cli/package.json`; removed unused `react-dom` peerDependency from `packages/modules/talk/package.json`.
- Build-time modules under `packages/modules/*` remain coupled exclusively via `packages/web/src/modules.ts` and `packages/cli/src/modules.ts` by design (`docs/projects/modules/design.md`, `test/modules.test.ts`).
- Added `every workspace declares its runtime imports and carries no unused dependencies` in `test/packaging.test.ts` to prevent future manifest drift.

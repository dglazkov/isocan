---
title: Scripts hardcode relative node module paths
loop:
  - 9030b3a9-c66c-4623-a305-293d13571bb8
loop_rank: P2
loop_state: ACTIVE
loop_goal: Dependencies healthy
decision: untriaged
---

# Scripts hardcode relative node module paths

> **Loop says** (P2): Scripts and test harnesses hardcode relative node_modules paths to resolve workspace dependencies. Running scripts in git worktrees or hoisted monorepo environments causes module resolution failures. Dynamic module resolution helps workspace tools find packages across different directory structures.

- `scripts/lib/browser.mjs#L172-L174`
- `packages/cli/test/pass.test.ts#L138`
- `scripts/release.mjs#L570`
- `packages/cli/test/deps.ts#L4-L27`

## Our read

Not yet checked against the code.

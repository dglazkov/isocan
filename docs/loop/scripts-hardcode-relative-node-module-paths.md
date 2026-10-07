---
title: Scripts hardcode relative node module paths
loop:
  - 9030b3a9-c66c-4623-a305-293d13571bb8
loop_rank: P2
loop_state: ACTIVE
loop_goal: Dependencies healthy
decision: proposed
rank: never
project: cleanup
since: 2026-10-07
note: "Mostly stale: browser.mjs:172-174 already resolves 'ws' dynamically first and deps.ts:28-48 already resolves 'tsx/package.json' via createRequire for git worktrees; only pass.test.ts:132 and release.mjs:574 still construct a direct node_modules path."
---

# Scripts hardcode relative node module paths

> **Loop says** (P2): Scripts and test harnesses hardcode relative node_modules paths to resolve workspace dependencies. Running scripts in git worktrees or hoisted monorepo environments causes module resolution failures. Dynamic module resolution helps workspace tools find packages across different directory structures.

- `scripts/lib/browser.mjs#L172-L174`
- `packages/cli/test/pass.test.ts#L138`
- `scripts/release.mjs#L570`
- `packages/cli/test/deps.ts#L4-L27`

## Our read

Two of the four cited locations already exist specifically to support git worktrees via dynamic resolution: scripts/lib/browser.mjs:172-174 calls await import('ws') first and only falls back to ../../node_modules/ws/index.js in .catch() (documented at :167-171), and packages/cli/test/deps.ts:4-48 defines nodeModulesDir() using createRequire(import.meta.url).resolve('tsx/package.json') and walking up to the enclosing node_modules directory precisely so worktrees resolve the main checkout's dependencies. Of the remaining two citations, scripts/release.mjs:574 resolves path.join(root, 'node_modules', '.bin', 'tsc') when building a release at the repo root, and packages/cli/test/pass.test.ts:132 passes fileURLToPath(new URL('../../../node_modules/tsx/dist/loader.mjs', import.meta.url)) when identityHook is set. Reopen only if pass.test.ts or release.mjs fails in a worktree layout.

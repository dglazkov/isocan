---
title: State mutations bypassing the daemon reducer
loop:
  - 72ac202c-2856-4f62-bb9d-f1dac1041715
loop_rank: P1
loop_state: DISMISSED
loop_goal: Always isomorphic
decision: declined
rank: never
since: 2026-09-29
note: "By design: unreadStore is a per-viewer localStorage watermark that is explicitly not an operation, and the daemon.ts writes are the daemon persisting its own project.json. Loop already dismissed it. Reopen with a client mutation that skips the reducer."
---

# State mutations bypassing the daemon reducer

> **Loop says** (P1): Several features in the web app, CLI, and server perform direct local storage or filesystem writes rather than dispatching daemon operations. Direct state mutations bypass reducer validation and undermine operation log consistency.

- `packages/web/src/stores/unreadStore.ts`
- `packages/server/src/daemon.ts`

## Our read

packages/web/src/stores/unreadStore.ts:5-14 says read watermarks are a property of a viewer, not the canvas, deliberately local and never in the oplog. packages/server/src/daemon.ts writes (fs.writeFile ~L743, writeFileAtomic via desk/project.json) are the daemon owning its own files, which is the daemon side of the isomorphism, not a bypass. I checked only these two cited files, not a repo-wide sweep for real bypasses; a new claim would need a named mutation of canvas state.

---
title: Web UI lacks canvas seen mark synchronization
loop:
  - 29f09351-3265-4aff-8681-81eebd251433
loop_rank: P2
loop_state: ACTIVE
loop_goal: Always isomorphic
decision: stale
rank: never
project: inbox
since: 2026-10-07
note: "Stale: the Web UI already synchronizes canvas seen-marks with the home on every visit via fetchSeen/putSeen and noteVisit, while unreadStore.ts intentionally keeps only per-thread comment watermarks in localStorage."
---

# Web UI lacks canvas seen mark synchronization

> **Loop says** (P2): The CLI allows users to update canvas read watermarks on the daemon via isocan seen --mark. The daemon exposes the /api/seen endpoint to track canvas read state across sessions. In contrast, the Web UI stores thread read marks exclusively in local browser storage. The Web UI lacks a mechanism to invoke /api/seen and synchronize canvas seen marks with the daemon.

- `packages/cli/src/main.ts#L9488-L9509`
- `packages/server/src/operator-routes.ts`
- `packages/web/src/stores/unreadStore.ts#L46-L76`

## Our read

The claim is false. While packages/web/src/stores/unreadStore.ts:46-76 stores fine-grained per-thread comment watermarks in localStorage, home-synchronized canvas seen-marks are implemented in packages/web/src/lib/api.ts:589-597 (fetchSeen and putSeen targeting /api/seen) and packages/web/src/lib/seen.ts:141-150 (noteVisit), which packages/web/src/pages/CanvasPage.tsx:328-335 calls on every canvas arrival using the same endpoint as packages/cli/src/main.ts:9489-9509.

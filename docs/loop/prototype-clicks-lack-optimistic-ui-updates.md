---
title: Prototype clicks lack optimistic UI updates
loop:
  - de4dedfa-5b43-4a32-b8b1-5dd6a9f43bf0
loop_rank: P2
loop_state: RESOLVED
loop_goal: pg_v67IPMwQ
decision: stale
rank: never
project: wireframes
since: 2026-10-07
note: "Stale: sendPrototypeClick (prototypeclick.ts:10-14) dispatches via sendEchoed (canvasStore.ts:792-850), which immediately folds the click comment into the optimistic queue before the HTTP request resolves."
---

# Prototype clicks lack optimistic UI updates

> **Loop says** (P2): Clicking dead-end links inside interactive prototype frames dispatches network operations directly to the server without optimistic local updates. Frame click messages trigger sendPrototypeClick which awaits network confirmation before showing comment thread feedback. This creates perceptible input lag during interactive prototype navigation.

- `packages/web/src/lib/prototypeclick.ts#L10-L14`
- `packages/web/src/components/ItemView.tsx#L24-L35`

## Our read

Verified in packages/web/src/lib/prototypeclick.ts:10-14 and packages/web/src/stores/canvasStore.ts:765-850: `sendPrototypeClick` calls `sendEchoed(canvasId, actor, clickOp(canvas, click, actor.id))`, which immediately enqueues an `inflight: true` write and updates the optimistic canvas state before the HTTP POST completes, allowing `coalescedClick` (prototypeclick.ts:12) to coalesce rapid double-clicks locally.

---
title: Fit to content resizing executes serial network roundtrips
loop:
  - 31760f17-0547-4065-bb30-5f344eff7422
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: proposed
rank: never
project: canvas-groups
since: 2026-10-07
note: "True mechanism on legacy canvases, small optimisation: group-enabled canvases already batch fit resizes into one changeCanvasGroup call (fititem.ts:41-44); reopen if multi-item fit shows a measured stall."
---

# Fit to content resizing executes serial network roundtrips

> **Loop says** (P2): Resizing items to fit content executes sequential text fetches and natural size calculations per item in a loop. After computing bounds, resizing un-grouped items dispatches individual item.resize operations serially rather than batching them. This sequential execution creates perceptible UI latency on multi-item selection resizes.

- `packages/web/src/lib/fititem.ts#L28-L36`
- `packages/web/src/lib/fititem.ts#L51-L53`

## Our read

Verified in packages/web/src/lib/fititem.ts:27-62: on group-enabled canvases (`groupsEnabled()`, lines 41-44), all item resizes and frame adjustments already land in one batched `changeCanvasGroup` operation via `groupFitAction`. Only the per-item size measurement loop (lines 27-39) and the legacy-mode `item.resize` fallback (lines 54-56) run sequentially.

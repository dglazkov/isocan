---
title: Fit to content resizing executes serial network roundtrips
loop:
  - 31760f17-0547-4065-bb30-5f344eff7422
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: untriaged
---

# Fit to content resizing executes serial network roundtrips

> **Loop says** (P2): Resizing items to fit content executes sequential text fetches and natural size calculations per item in a loop. After computing bounds, resizing un-grouped items dispatches individual item.resize operations serially rather than batching them. This sequential execution creates perceptible UI latency on multi-item selection resizes.

- `packages/web/src/lib/fititem.ts#L28-L36`
- `packages/web/src/lib/fititem.ts#L51-L53`

## Our read

Not yet checked against the code.

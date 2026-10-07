---
title: Sprint desk hand-in executes serial network roundtrips
loop:
  - 7142ae7d-be22-4779-847c-59e001468c9e
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: proposed
rank: never
project: sprint
since: 2026-10-07
note: "By design: handInFromDesk (sprint.ts:262-321) processes selected desk items sequentially so legacy freeSpotIn placement advances occupied state after each item lands."
---

# Sprint desk hand-in executes serial network roundtrips

> **Loop says** (P2): Handing in desk items to a sprint processes each item sequentially in a loop. The hand-in handler executes serial network roundtrips for blob reads, blob uploads, and operation posts per item. This design causes total hand-in latency to scale linearly with item count, delaying sprint board updates on high-latency connections.

- `packages/web/src/lib/sprint.ts#L274-L312`

## Our read

Verified in packages/web/src/lib/sprint.ts:262-321 (handInFromDesk): the for-of loop at lines 274-312 reads the desk blob (readBlob at line 277), uploads it to the sprint canvas (uploadBlob at line 279), computes spot via groupContentBox or freeSpotIn(occupied, state.area, item.width, item.height) at line 281, awaits sendOp at line 283, and updates occupied with the new item's spot at line 310 so the next handed-in item does not overlap it. A person hands in 1-3 sketches from their private desk at the end of a sprint phase; sequential execution preserves deterministic non-overlapping placement and is the same pattern as the declined serial-http-transfers-stall-cross-canvas-paste finding.

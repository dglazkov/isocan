---
title: Unbatched gesture events trigger redundant viewport re-renders
loop:
  - 973d569e-e39f-4269-8267-05969b694213
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: untriaged
---

# Unbatched gesture events trigger redundant viewport re-renders

> **Loop says** (P2): Trackpad two-finger panning and Safari WebKit pinch gestures call viewport store updates synchronously on every input event. High-frequency input events dispatch multiple store mutations per animation frame without frame batching. These unbatched mutations trigger synchronous state updates across multiple viewport-dependent components.

- `packages/web/src/components/CanvasViewport.tsx#L338-L342`
- `packages/web/src/components/CanvasViewport.tsx#L354-L360`

## Our read

Not yet checked against the code.

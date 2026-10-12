---
title: Lack of spatial viewport spotlight follow mode
loop:
  - 5b89c7af-5f2f-47b1-80bf-a272b25a4501
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: untriaged
---

# Lack of spatial viewport spotlight follow mode

> **Loop says** (P2): isocan tracks participant presence and cursor coordinates but does not broadcast live camera viewports or focal focus. Presence session objects carry cursor coordinates and activity statuses without camera center position or zoom scale parameters. Without a spotlight follow mode, human co-designers cannot follow agent generation streams across large canvas distances.

- `packages/core/src/roster.ts#L34-L68`
- `packages/core/src/protocol.ts#L264-L366`
- `packages/core/src/protocol.ts#L202-L215`
- `packages/web/src/components/CanvasViewport.tsx#L1-L80`

## Our read

Not yet checked against the code.

---
title: Absence of agent proposal staging overlays
loop:
  - 7f0b42a9-caf7-4afd-a583-e3250c37fa39
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: untriaged
---

# Absence of agent proposal staging overlays

> **Loop says** (P2): isocan applies agent design mutations directly to active canvas state without a pre-commit proposal staging overlay or review buffer. Direct operations append immediately to the version reducer stack, preventing users from previewing or approving agent modifications prior to commit. This gap creates friction and reduces user trust during collaborative human-agent canvas design.

- `packages/core/src/reducer.ts`
- `packages/core/src/ops.ts`
- `packages/api/src/design-workflow.ts`
- `packages/web/src/components/Workbench.tsx`

## Our read

Not yet checked against the code.

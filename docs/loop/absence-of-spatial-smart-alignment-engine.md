---
title: Absence of spatial smart alignment engine
loop:
  - 54ed4fdb-82e6-40ec-855f-e4873dcfd4d7
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: untriaged
---

# Absence of spatial smart alignment engine

> **Loop says** (P2): isocan relies on basic lattice searches and discrete batch layout helpers for element positioning. The core placement logic uses fixed gaps and simple clearance checks without calculating dynamic multi-axis snap alignment relative to surrounding nodes. Without real-time spatial alignment and collision avoidance, agent placements risk overlapping user designs and breaking layout visual hierarchy.

- `packages/core/src/placement.ts#L84-L147`
- `packages/core/src/layout.ts#L89-L120`
- `packages/core/src/placement.ts#L10-L19`
- `packages/core/src/canvas-groups.ts#L368-L397`

## Our read

Not yet checked against the code.

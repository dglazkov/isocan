---
title: Group stack desk layout recalculates card transforms on pointer hover
loop:
  - c1503145-d14d-4128-8bfa-3e418091fc4d
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: untriaged
---

# Group stack desk layout recalculates card transforms on pointer hover

> **Loop says** (P2): Hovering over a stacked item group executes dynamic desk spreading calculations on every pointer movement event. Calculating trigonometric rotation and offset parameters for stacked cards on continuous mouse events creates main-thread rendering work during canvas navigation.

- `packages/web/src/components/GroupStack.tsx#L1-L30`
- `packages/core/src/group-stack.ts#L1-L28`

## Our read

Not yet checked against the code.

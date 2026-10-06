---
title: Canvas lacks section containers for spatial partitioning
loop:
  - b5d5c349-3169-49db-b09d-f910324ccb7c
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: untriaged
---

# Canvas lacks section containers for spatial partitioning

> **Loop says** (P2): isocan only supports loose item groups or stacked piles without first-class section container primitives. Canvas items use container identifiers for membership, but group layout is limited to stack or spread display modes. Without spatial section containers, humans and agents cannot partition canvas areas into bounded, named workspaces.

- `packages/core/src/canvas-groups.ts#L12-L16`
- `packages/core/src/group-stack.ts#L72-L75`
- `packages/core/src/model.ts#L186-L198`
- `packages/core/src/canvasitem.ts#L25-L36`
- `packages/web/src/components/Workbench.tsx#L208-L238`

## Our read

Not yet checked against the code.

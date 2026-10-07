---
title: Canvas lacks section containers for spatial partitioning
loop:
  - b5d5c349-3169-49db-b09d-f910324ccb7c
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: proposed
rank: never
since: 2026-10-07
note: "Stale: canvas groups in packages/core/src/canvas-groups.ts:12-17, 52-60 and packages/core/src/canvas-group-types.ts:5-22 are already bounded, titled spatial containers with markdown briefs, nested containerId membership (packages/core/src/model.ts:188-190), and labeled row/column grids, alongside area sheets in packages/core/src/area.ts:39-119."
---

# Canvas lacks section containers for spatial partitioning

> **Loop says** (P2): isocan only supports loose item groups or stacked piles without first-class section container primitives. Canvas items use container identifiers for membership, but group layout is limited to stack or spread display modes. Without spatial section containers, humans and agents cannot partition canvas areas into bounded, named workspaces.

- `packages/core/src/canvas-groups.ts#L12-L16`
- `packages/core/src/group-stack.ts#L72-L75`
- `packages/core/src/model.ts#L186-L198`
- `packages/core/src/canvasitem.ts#L25-L36`
- `packages/web/src/components/Workbench.tsx#L208-L238`

## Our read

Checked packages/core/src/canvas-groups.ts:12-60, packages/core/src/canvas-group-types.ts:5-27, packages/core/src/group-stack.ts:72-75, packages/core/src/model.ts:186-198, packages/core/src/area.ts:39-119,packages/core/src/canvasitem.ts:25-36, and packages/web/src/components/Workbench.tsx:208-238. Group items (kind=group, canvas-groups.ts:12-16) are bounded spatial frames (1600x1000 default) with a title band, markdown brief band, explicit nested containerId membership (model.ts:188-190), and labeled 2D row/column grids (canvas-group-types.ts:5-22), while legacy canvases have titled bounded sheets in area.ts:39-119. groupStackAction (group-stack.ts:72-75) is merely an optional toggle between spread and stacked pile rendering.

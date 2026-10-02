---
title: "Duplicated group placement computation across clients"
loop: 648e6a1d-5a50-45d0-84e5-0b16e2ae33db
loop_rank: P2
loop_state: DISMISSED
loop_goal: "Always isomorphic"
decision: declined
rank: never
project: canvas-groups
since: 2026-09-30
note: "False, re-checked 30 Sep: both clients send only a hint (container id, a starting point, a policy); the final slot is resolved once, in the core reducer's insert branch through groupPlacement. Same finding as the 26 Sep read."
---

# Duplicated group placement computation across clients

> **Loop says** (P2): CLI and Web UI clients compute container bounding boxes and position parameters locally. They do not delegate placement resolution to core. Shared core placement logic already handles container bounding box resolution, cell coordinate mapping, and collision-free slot allocation.

- `packages/cli/src/group-placement.ts#L16-L22`
- `packages/web/src/lib/groupplacement.ts#L6-L9`
- `packages/web/src/components/AddPopover.tsx#L172-L175`
- `packages/core/src/canvas-groups.ts#L278-L298`
- `packages/core/src/canvas-groups.ts#L883-L902`

## Our read

packages/cli/src/group-placement.ts:16-22 (groupPlacementFor) resolves the --in reference, takes groupContentBox(parent) as the starting point only when --at is absent, and marks the request groupPlacement 'auto' (or 'exact' for an explicit --at); :24-30 lifts those hints onto item.add. packages/web/src/lib/groupplacement.ts:6-9 (creationDestination) computes no geometry at all: the active group id and 'auto'. packages/web/src/components/AddPopover.tsx:172-175 likewise hands groupContentBox(sheet) as the hint with groupPlacement 'auto'; its legacy-areas branch (:176) calls freeSpotIn, which is core's (packages/core/src/area.ts:164). The slot is chosen in core: the insert branch of the group reducer (packages/core/src/canvas-groups.ts:883-902) calls destination(roots, parent, policy, op.cell) (:842-846), whose placeUnits calls groupPlacement at :837, and groupPlacement (:278-298) does the collision-free slot, the cell box and the spill. So there is one placement computation, and both clients reach it by sending an operation. groupContentBox is itself a core helper, which is what AGENTS.md's 'shared helpers in core' asks for. The 26 Sep verification reached the same answer.

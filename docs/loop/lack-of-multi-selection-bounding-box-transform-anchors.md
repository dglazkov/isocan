---
title: Lack of multi-selection bounding box transform anchors
loop:
  - 1000c2fb-9001-45af-9ca6-5094ee50a7c0
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: untriaged
---

# Lack of multi-selection bounding box transform anchors

> **Loop says** (P2): isocan manages grouped canvas items through fixed card stack dimensions or spread layout configurations. Core group operations compute enclosing bounding boxes but do not maintain unified multi-selection transform anchor state or proportional scaling matrices. Without multi-selection transform anchors, co-designers cannot manipulate complex multi-item layouts as a single responsive visual unit.

- `packages/core/src/group-stack.ts#L17-L20`
- `packages/core/src/group-stack.ts#L72-L88`
- `packages/core/src/canvas-groups.ts#L439-L454`
- `packages/core/src/canvas-groups.ts#L482-L531`
- `packages/web/src/components/StageEditor.tsx#L1-L100`

## Our read

Not yet checked against the code.

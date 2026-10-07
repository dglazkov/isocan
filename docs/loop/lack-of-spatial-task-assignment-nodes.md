---
title: Lack of spatial task assignment nodes
loop:
  - 4a6fa57d-7938-4722-b1c1-ff8699f86970
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: declined
rank: never
project: workbench
since: 2026-10-07
note: "By design: work routing and lifecycle state live in item- or point-anchored @mention threads (model.ts:291-311), derived roster states (roster.ts:36-68), and structured DesignBrief records targeting items or groups (design-brief.ts:14-18), rather than a separate task-node item kind."
---

# Lack of spatial task assignment nodes

> **Loop says** (P2): isocan items track actor operation signatures but lack spatial task assignment nodes for routing canvas work to specific human or agent personas. Canvas item definitions cover cards, frames, areas, and comments without supporting task status fields or assigned agent metadata. Consequently, human and agent co-designers cannot assign canvas regions or track work item lifecycle states on canvas.

- `packages/core/src/canvasitem.ts#L25-L70`
- `packages/core/src/item.ts#L20-L65`
- `packages/core/src/roster.ts#L15-L55`

## Our read

Loop cites packages/core/src/canvasitem.ts:25-70 (which defines kind=canvas inception cards pointing at another canvas, not general canvas items), a non-existent packages/core/src/item.ts, and packages/core/src/roster.ts:15-55. In packages/core/src/model.ts:186-234 (Item) and :291-311 (CommentThread), canvas work is routed to humans and agents by @-mentioning actors on comment threads anchored to items or world coordinates, tracked live via derived RowState values (blocked on openAsk, working with a presence locus, parked, quiet, here, answerable, enrolled, away in packages/core/src/roster.ts:36-100), and managed as structured tasks via DesignBrief items (progress: active | cancelled | completed, requestingActorId, targetItemId, groupId in packages/core/src/design-brief.ts:6-19). A separate task-assignment node kind would duplicate anchored threads, roster state derivation, and design briefs.

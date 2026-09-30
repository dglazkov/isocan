---
title: "Web UI lacks canvas group layout controls"
loop: df9d4756-90d4-40d9-bc87-dce11a72152b
loop_rank: P2
loop_state: ACTIVE
loop_goal: "Always isomorphic"
decision: proposed
rank: next
project: canvas-groups
since: 2026-09-30
note: "Partly: fit and tidy have web buttons, and a cell is a drop target by pointer; but the web cannot clear a grid (never sends clearGrid) and lowering Grid rows/columns below the label count is refused with 'more grid labels than cells'. Cheap: trim labels to counts, add Clear grid."
---

# Web UI lacks canvas group layout controls

> **Loop says** (P2): The CLI provides commands to clear group grids, fit frames, and target specific grid cells. In contrast, the Web UI lacks interactive controls for grid clearing and cell placement. Also, reducing row or column counts in the web layout editor leaves label arrays unchanged, triggering validation errors in core logic when saved.

- `packages/cli/src/canvas-groups.ts#L131-L165`
- `packages/web/src/components/GroupLayoutControls.tsx#L40-L66`
- `packages/web/src/components/CanvasGroupPanel.tsx#L71-L88`
- `packages/core/src/canvas-groups.ts#L52-L65`
- `packages/api/src/canvas-groups.ts#L181-L196`

## Our read

Three sub-claims, checked. (1) Fit frame: FALSE, packages/web/src/components/CanvasGroupPanel.tsx:87 has 'Fit frame to contents' and 'Tidy contents', both sending the same changeCanvasGroup actions the CLI does (packages/cli/src/canvas-groups.ts:131-136). (2) Cell placement: a gesture, not a gap. The CLI's --cell (canvas-groups.ts:110-112) is how an agent says what a person does by dropping into a cell, and a drop inside the content box is placed with policy 'preserve' (packages/core/src/canvas-groups.ts:310-313); the saved cells are drawn as guides (packages/web/src/components/ItemView.tsx:2014-2037). (3) Clear grid: TRUE. The API clears by sending layout with clearGrid: true (packages/api/src/canvas-groups.ts:188-193), and packages/web/src contains no clearGrid; GroupLayoutControls.tsx:58-59 can lower counts to 1 but cannot remove rowCount/columnCount or the gutters. (4) The label bug: TRUE. GroupLayoutControls.tsx:58-61 edits rowCount/columnCount and the rows/columns label arrays independently, so 3 named rows cut to 2 saves {rowCount: 2, rows: [a,b,c]}, which validLayout refuses at packages/core/src/canvas-groups.ts:62-63 ('more grid labels than cells'). The refusal is shown in the form's alert (:73), so nothing corrupts, but the obvious edit fails. The fix is small and belongs to canvas-groups: have the count inputs slice the label arrays to the new count (or have core expose one normaliser both clients use), and add a 'Clear grid' button beside Tidy that sends the API's clearGrid layout.

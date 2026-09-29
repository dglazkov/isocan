---
title: "Absence of reactive auto-layout and item nesting"
loop: 92ab20cc-7f2c-4a3f-a4f7-69103e1c89a3
loop_rank: P2
loop_state: DISMISSED
loop_goal: "What canvas tools teach us"
decision: stale
rank: never
project: canvas-groups
since: 2026-09-29
note: "Stale and partly by design: groups already nest and frames grow on commit to enclose content, and centroid membership is intentional. Flex auto-layout would be a different product. Loop dismissed it. Reopen with a case groups cannot do."
---

# Absence of reactive auto-layout and item nesting

> **Loop says** (P2): isocan relies on geometric centroid detection and fixed-grid groups for spatial layout rather than reactive flex auto-layout and parent-child item trees. Area membership is computed dynamically by checking whether an item's centroid lies within an area rectangle. Furthermore, Canvas Groups use rigid column and row bounds that fail when grid capacity is exceeded rather than reflowing elements. As a result, modifying nested elements requires manual repositioning of surrounding canvas items.

- `packages/core/src/area.ts`
- `packages/core/src/canvas-groups.ts`
- `packages/core/src/layout.ts`

## Our read

docs/projects/canvas-groups/design.md:133 says a frame grows on commit to enclose an item, and :232 that areaEnclosing grows right and bottom, with growth through ancestors in one operation (so parent-child nesting exists). canvas-groups.ts:245-246 keeps rowCount and columnCount as explicit grid bands, and design.md:273 says a requested cell may grow the frame. Nothing here refuses at capacity. No reactive flex layout is planned in ROADMAP.

---
title: "Unmemoized minimap bounds recomputations stall viewport panning"
loop: b0e270d5-237a-4bc2-b171-7f3d28a87254
loop_rank: P2
loop_state: DISMISSED
loop_goal: "Fast everywhere, local-first"
decision: declined
rank: never
project: cleanup
since: 2026-09-30
note: "True mechanism, measured harmless: Minimap re-renders and re-runs itemsBounds on every viewport change, but the frame census (1440px, minimap open, 250 notes, 4x CPU) puts pan p99 at 16.8 ms. Reopen with a census that names Minimap."
---

# Unmemoized minimap bounds recomputations stall viewport panning

> **Loop says** (P2): The Minimap component recalculates canvas item bounds and maps item SVG elements on every viewport state update without memoization. Minimap subscribes to viewport updates and executes itemsBounds on every viewport frame during panning or zooming. Re-evaluating canvas item bounds and recreating React SVG nodes on every tick creates CPU overhead and DOM reconciliation cost.

- `packages/web/src/components/Minimap.tsx#L89-L109`
- `packages/web/src/lib/viewport.ts#L117-L128`
- `packages/web/src/components/Minimap.tsx#L205-L239`

## Our read

The mechanism is real. packages/web/src/components/Minimap.tsx:89 subscribes to useUiStore viewport, :109 calls itemsBounds(canvas) (packages/web/src/lib/viewport.ts:117-128, one O(n) min/max pass) on every render, and :205-239 maps every item to a <rect> with fresh closures, so each wheel step reconciles n rects. What the claim leaves out is the cost: docs/research/2026-09-26-frame-budget.md:56 measured pan p99 at 16.8 ms before and after the Sep 25 fixes (scripts/frames.mjs:165 runs at 1440x900, where the minimap is open, over 250 notes at 4x CPU throttle): 'it was never the problem'. The expensive re-renders were ItemView's (2016c2bc, 4dba76f7, cb9308c1), not the map's. Only part is even memoisable: world (Minimap.tsx:113-128) unions the item box with the viewport rectangle, so rect coordinates legitimately move whenever the viewport pokes past the items. The cheap fix, if a census ever names it, is useMemo on itemsBounds keyed on canvas.items plus a memoised rect layer keyed on (items, world, scale), so panning inside the item bounds re-renders one viewport rect instead of n.

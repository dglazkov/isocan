---
title: "Global store subscriptions cause full viewport re-renders"
loop: f658a23e-5512-4405-9d65-7bb34b895b36
loop_rank: P2
loop_state: RESOLVED
loop_goal: "Fast everywhere, local-first"
decision: done
rank: next
project: cleanup
since: 2026-09-29
note: "Fixed in cleanup Phase 3 (RP-1, RP-3, RP-6, RP-8, RP-9; 27 Sep 2026): CanvasViewport.tsx:1135 memoizes the filtered and groupAncestors-sorted items list with useMemo, and packages/web/test/canvaswide-rerender.test.ts guards against regressions."
---

# Global store subscriptions cause full viewport re-renders

> **Loop says** (P2): The canvas viewport and overlay layers subscribe directly to the global canvas store object. Every operation reduction produces a new state reference that triggers top-to-bottom re-renders across the viewport component tree. During these re-renders, the viewport re-evaluates and sorts all canvas items on the main thread.

- `packages/web/src/components/CanvasViewport.tsx#L102`
- `packages/web/src/components/CommentLayer.tsx#L68`
- `packages/web/src/components/EdgeRadar.tsx#L43`
- `packages/web/src/components/CanvasViewport.tsx#L1121-L1123`

## Our read

Fixed on 27 Sep 2026 in docs/projects/cleanup/phases.md Phase 3 (RP-1, RP-3, RP-6, RP-8, RP-9). packages/web/src/components/CanvasViewport.tsx:1135-1137 wraps the visible-item filter and groupAncestors sort in useMemo(() => ..., [canvas, presentation]), and narrow store selectors +packages/web/test/canvaswide-rerender.test.ts keep cursor, pan, and presence ticks from re-sorting or re-rendering the item tree. Measured on a 250-note canvas at 4x CPU throttle, cursor-move frame time dropped from p50 50 ms (13-16 long frames) to 16.7 ms (0 long frames).

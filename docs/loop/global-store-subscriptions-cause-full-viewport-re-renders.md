---
title: "Global store subscriptions cause full viewport re-renders"
loop: f658a23e-5512-4405-9d65-7bb34b895b36
loop_rank: P2
loop_state: RESOLVED
loop_goal: "Fast everywhere, local-first"
decision: declined
rank: never
project: ui-refresh
since: 2026-09-29
note: "No measured frame problem: CanvasViewport subscribes to the whole canvas and re-sorts unmemoized, but uses narrow selectors elsewhere, and Loop already reports it resolved. Reopen with a profile showing dropped frames."
---

# Global store subscriptions cause full viewport re-renders

> **Loop says** (P2): The canvas viewport and overlay layers subscribe directly to the global canvas store object. Every operation reduction produces a new state reference that triggers top-to-bottom re-renders across the viewport component tree. During these re-renders, the viewport re-evaluates and sorts all canvas items on the main thread.

- `packages/web/src/components/CanvasViewport.tsx#L102`
- `packages/web/src/components/CommentLayer.tsx#L68`
- `packages/web/src/components/EdgeRadar.tsx#L43`
- `packages/web/src/components/CanvasViewport.tsx#L1121-L1123`

## Our read

CanvasViewport.tsx:102 subscribes to s.past?.canvas ?? s.canvas, and lines 1119-1123 build and sort items in render with no useMemo I could find (grep for useMemo in the file returned nothing). CommentLayer.tsx:68 does the same. EdgeRadar.tsx:43 selects only canvas.items. The theme check at line 108 is deliberately a narrow selector. Loop marks it resolved already. No profile was run, so cost is unquantified.

---
title: Missing spatial canvas viewport camera bookmarks
loop:
  - 6eef2d95-6bfd-4d79-82ec-b278730b13f9
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: proposed
rank: never
since: 2026-10-07
note: "By design: named spatial regions are groups and areas (area.ts:133-140), presentation frames are slide-marked items served at DECK_ROUTE (address.ts:81-91), and individual items have routes at ITEM_ROUTE (address.ts:34-69), while camera pan/zoom is per-viewer state (viewport.ts:4-165)."
---

# Missing spatial canvas viewport camera bookmarks

> **Loop says** (P2): Canvas address routing supports canvas routes and single item routes, but lacks constructs for named viewport camera bookmarks. Core data models store item bounding boxes and thread pin coordinates without models for saved camera focus positions or presentation frames. Web viewport utilities and routing manage camera transforms in local component state without persistent bookmark coordinates.

- `packages/core/src/address.ts#L29-L168`
- `packages/core/src/model.ts#L53-L418`
- `packages/web/src/lib/viewport.ts#L4-L165`
- `packages/web/src/App.tsx#L148-L177`

## Our read

As explained in packages/core/src/address.ts:44-56, what a viewer is looking at is a route or local camera transform rather than a canvas operation in packages/core/src/model.ts:53-418: address.ts:29-168 provides addressable routes for the canvas (/p/:canvasId), a fullscreen item (/p/:canvasId/i/:itemId), the slide deck (/p/:canvasId/deck), a module page (/p/:canvasId/x/:segment), and the workbench (/p/:canvasId/w/:wbItemId), mounted over CanvasPage in packages/web/src/App.tsx:148-177. In packages/web/src/lib/viewport.ts:4-165, Viewport (tx, ty, scale) is per-viewer state with fitBounds (:148-165) and fitInto (:137-144) to frame any world box. Named spatial regions on a canvas are already represented as groups and areas (packages/core/src/area.ts:133-140) and presentation frames are slide-marked items rendered at DECK_ROUTE (packages/core/src/address.ts:81-91), so a separate persistent camera-bookmark model would duplicate groups, areas, and slides.

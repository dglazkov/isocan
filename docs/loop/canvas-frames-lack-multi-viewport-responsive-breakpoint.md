---
title: "Canvas frames lack multi-viewport responsive breakpoint matrices"
loop: 341789ca-71ae-449e-bb9c-e43841906844
loop_rank: P2
loop_state: DISMISSED
loop_goal: "What canvas tools teach us"
decision: declined
rank: never
project: wireframes
since: 2026-09-29
note: "Real but unrequested: a wire renders at one width and PhoneFace covers mobile. Wireframes phase 8 comes from real use and lists no breakpoint matrix. Reopen if users ask."
---

# Canvas frames lack multi-viewport responsive breakpoint matrices

> **Loop says** (P2): Canvas frames process UI screens as isolated, fixed-dimension cards without synchronized multi-viewport responsive breakpoint matrices. Current renderers output single fixed-width viewports and mobile faces without a unified multi-viewport sync engine. Consequently, designers and agents cannot evaluate layout reflow or mobile layout regressions side-by-side during concurrent canvas edits.

- `packages/core/src/frameable.ts`
- `packages/modules/wireframe/src/catalog/types.ts`
- `packages/modules/wireframe/src/render.ts`
- `packages/web/src/components/PhoneFace.tsx`
- `packages/web/src/components/CanvasCard.tsx`

## Our read

wireframe/src/render.ts:471 sets the viewport meta to a single width per render; the grep of frameable.ts, catalog/types.ts and wireframes docs finds no breakpoint or responsive concept. PhoneFace.tsx provides a mobile face for items. The wireframes journey speaks of screens and variations, not viewport matrices.

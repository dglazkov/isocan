---
title: Missing spatial developer redlining spec overlays
loop:
  - a2b675a0-16ad-41a5-869e-5b749a465187
loop_rank: P2
loop_state: DISMISSED
loop_goal: What canvas tools teach us
decision: declined
rank: never
project: wireframes
since: 2026-09-29
note: "Holds as a feature gap with untested demand: wires render as static HTML and the hand-off today is the build brief. Reopen if wireframes are handed to code-building agents often."
---

# Missing spatial developer redlining spec overlays

> **Loop says** (P2): Wireframe screens render static HTML strings without interactive spatial redlining metadata. Core export and design system tools focus on whole document backups and text token parsing. Canvas viewports lack bounding box measurement overlays and CSS spec generators for sub-elements. Human developers and code-building agents cannot inspect precise design specifications directly on canvas components.

- `packages/modules/wireframe/src/render.ts`
- `packages/core/src/export.ts`
- `packages/core/src/designmd.ts`
- `packages/web/src/components/ItemView.tsx`
- `packages/web/src/components/StageEditor.tsx`
- `packages/core/src/designsystem.ts`

## Our read

packages/modules/wireframe/src/render.ts emits static HTML for each screen; ItemView and StageEditor have no bounding-box or spec overlay and a search for redline or measure in packages/web and packages/modules finds none that mean this. The hand-off to an agent today is the build brief, which carries the spec in words. Demand is untested.

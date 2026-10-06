---
title: Missing spatial prompt pins for canvas edits
loop:
  - 9aeadb5e-0786-46cf-91ef-c1463133c27e
loop_rank: P2
loop_state: DISMISSED
loop_goal: What canvas tools teach us
decision: stale
rank: never
project: design-partner
since: 2026-09-29
note: "Stale: annotations bind ink to a card sub-region, comment pins anchor to points, and request-protocol.md already captures ambient pins. A dedicated prompt pin would duplicate them. Reopen with a case they cannot express."
---

# Missing spatial prompt pins for canvas edits

> **Loop says** (P2): isocan relies on canvas-wide chat prompts or general item selection focus when starting agent design requests. The design brief and reader data structures carry item or group identifiers but lack sub-element spatial pin coordinates or target element selectors. Also, the canvas viewport and text composer components lack a spatial prompt pin tool to attach localized agent instruction callouts directly to card sub-regions.

- `packages/core/src/design-request.ts`
- `packages/api/src/design-request-reader.ts`
- `packages/web/src/components/CanvasViewport.tsx`
- `packages/web/src/components/TextComposer.tsx`

## Our read

Verified end-to-end across packages/core/src/annotation.ts, packages/core/src/design-request.ts, and packages/api/src/design-request-reader.ts: annotations bind ink to an item with a fractional {x, y, w, h} box (annotation.ts), conversations anchor to a canvas point or item (model.ts:277), and design requests capture both the source comment thread and scope provenance (source-comment, current-selection, or current-ambient in DesignContinuation.scopeCapture, design-request.ts:20) plus governing references when building the craft packet (design-craft-packet.ts).

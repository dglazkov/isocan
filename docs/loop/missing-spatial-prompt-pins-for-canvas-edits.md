---
title: "Missing spatial prompt pins for canvas edits"
loop: 9aeadb5e-0786-46cf-91ef-c1463133c27e
loop_rank: P2
loop_state: DISMISSED
loop_goal: "What canvas tools teach us"
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

core/annotation.ts makes ink about an item with an annotates prop and a fractional x,y,w,h region; model.ts:277 defines conversations pinned to a point or anchored to an item. design-partner/request-protocol.md lines 93-99 record selected-root or ambient-pin capture provenance for requests. The brief carries targetItemId and groupId, but sub-region already flows through annotations. Did not verify the pin reaches the brief fields end to end.

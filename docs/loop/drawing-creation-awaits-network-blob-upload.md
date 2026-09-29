---
title: "Drawing creation awaits network blob upload"
loop: b37633ef-b339-4f9d-ab62-c60294ded964
loop_rank: P2
loop_state: ACTIVE
loop_goal: "Fast everywhere, local-first"
decision: accepted
rank: next
project: multiuser
since: 2026-09-29
note: "Holds: addDrawing awaits uploadBlob (upload.ts:395) before item.add, so ink stalls offline while the add itself has a queued path. Local-first is a standing priority and this is a defect a person meets. Would close when blob uploads queue like the op, or a local hash stands in."
---

# Drawing creation awaits network blob upload

> **Loop says** (P2): Drawing ink creation executes a synchronous network request to upload the generated SVG blob before dispatching optimistic canvas operations. The wet sketch ink remains on screen and blocks placement until the HTTP upload request resolves. Under high latency or offline network conditions, drawing placement stalls or fails instead of instantly rendering the new item locally.

- `packages/web/src/lib/sketchplace.ts#L81-L89`
- `packages/web/src/lib/upload.ts#L394-L397`

## Our read

packages/web/src/lib/upload.ts addDrawing (about line 360-400) builds the SVG, awaits uploadBlob(canvasId, blob, DRAWING_FILENAME) from api.ts:769, and only then calls sendCreatedItem. The store has a queued write status (canvasStore.ts:316) for item.add, so the offline gap is the blob upload specifically. The cited sketchplace.ts no longer exists; the code moved into upload.ts. I did not test the offline behaviour live.

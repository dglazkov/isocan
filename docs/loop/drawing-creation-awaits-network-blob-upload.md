---
title: Drawing creation awaits network blob upload
loop:
  - b37633ef-b339-4f9d-ab62-c60294ded964
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: done
rank: next
project: multiuser
since: 2026-09-29
note: "Fixed on 29 Sep 2026: when uploadBlob fails offline in addDrawing, the SVG's SHA-256 is computed locally, staged in memory and on the StoredWrite in IndexedDB so the drawing renders immediately via blobUrl/readBlobText, and uploaded before postOp when drainQueue flushes on reconnect."
---

# Drawing creation awaits network blob upload

> **Loop says** (P2): Drawing ink creation executes a synchronous network request to upload the generated SVG blob before dispatching optimistic canvas operations. The wet sketch ink remains on screen and blocks placement until the HTTP upload request resolves. Under high latency or offline network conditions, drawing placement stalls or fails instead of instantly rendering the new item locally.

- `packages/web/src/lib/sketchplace.ts#L81-L89`
- `packages/web/src/lib/upload.ts#L394-L397`

## Our read

packages/web/src/lib/upload.ts addDrawing previously awaited uploadBlob(canvasId, blob, DRAWING_FILENAME) before calling sendCreatedItem, dropping the ink when offline. Fixed in 683cc0a2: when uploadBlob throws an offline error, addDrawing hashes the deterministic SVG bytes in the browser, stages a StagedBlob in the outbox (packages/web/src/lib/outbox.ts), and queues item.add with that content-addressed blob hash; flushOutbox uploads the staged bytes before replaying the op on reconnect, verified in packages/web/test/outbox.test.ts.

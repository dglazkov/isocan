---
title: Wireframe edits block on synchronous network uploads
loop:
  - 74fe6f8b-8c0b-476b-ad81-a4662dcf5fa8
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: declined
rank: never
project: wireframes
since: 2026-10-07
note: "By design: item.addVersion requires the content-addressed blobHash and byte size from uploading the rendered wireframe HTML, which is a tiny POST following an existing model call or local SVG render."
---

# Wireframe edits block on synchronous network uploads

> **Loop says** (P2): Wireframe text and slot edits execute a synchronous remote network upload before dispatching item version updates to the canvas. Affected interactive prototypes also run a sequential synchronous upload before updating state. This design causes user-facing canvas updates to stall on network latency rather than applying optimistic local state changes.

- `packages/modules/wireframe/src/edit.ts#L432-L441`
- `packages/modules/wireframe/src/kept-flows.ts#L164-L169`

## Our read

In packages/modules/wireframe/src/edit.ts:432-441 and packages/modules/wireframe/src/kept-flows.ts:164-171, port.put(html, 'text/html', filename) (implemented via uploadContent in packages/modules/wireframe/src/web-port.ts:15-18 and packages/web/src/lib/api.ts:749-768) resolves the content-addressed { blobHash, size } required by the item.addVersion operation. In editWireOnCanvas (packages/modules/wireframe/src/edit.ts:416-423), the edit already awaits planEditWithJev or rewriteSlotCopy, and uploading a few kilobytes of wireframe HTML to obtain its canonical blobHash is required before appending the version op.

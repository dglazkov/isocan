---
title: Sticker placement blocks on remote blob upload
loop:
  - f9687e4a-bd86-4b2e-987c-b383806c1a62
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: accepted
rank: later
project: multiuser
since: 2026-10-07
note: "Holds: StickerInspector and the sticker drop handler (packages/modules/stickers/src/web.tsx:129-141, 165-172) await host.putBlob over HTTP, failing offline even though sticker SVG bytes are deterministic in-memory strings."
---

# Sticker placement blocks on remote blob upload

> **Loop says** (P2): Sticker inspector selection and drag-and-drop canvas placement execute remote HTTP blob uploads before dispatching canvas operations. Both the inspector click handler and the drag drop handler await host.putBlob before sending item.addVersion or returning item.add operations. Network upload latency directly delays canvas rendering feedback and prevents offline sticker placement.

- `packages/modules/stickers/src/web.tsx#L129-L141`
- `packages/modules/stickers/src/web.tsx#L165-L172`

## Our read

Verified in packages/modules/stickers/src/web.tsx:129-141 (StickerInspector onClick) and :165-172 (stickersWeb.drops[0].run): both build the deterministic SVG string via stickerFile(sticker) and await host.putBlob(blob, file.filename) before calling host.send or returning placeSticker. In packages/web/src/lib/modulehost.ts:61-72, webHostFor.putBlob calls uploadBlob(canvasId, bytes, filename) directly (packages/web/src/lib/api.ts:769-801) and webHostFor.send (modulehost.ts:52-59) throws QueuedItemError when offline rather than staging deterministic text/SVG blobs via uploadOrStageTextBlob (packages/web/src/lib/upload.ts:440-457). Routing deterministic text/SVG module blobs through offline staging on WebHost would let stickers place offline like drawings and text notes.

## Implementation — 27 October 2026

Addressed in the offline-save cluster: speaker notes and Stage use
`uploadOrStageTextBlob`; the two sticker callers explicitly request
`stageOffline` from `webHostFor`, which carries their primary blobs into the
existing operation outbox. Default module uploads remain unchanged. Current stickers use deterministic UTF-8 emoji text,
not SVG. `packages/web/test/offline.test.ts` covers offline creation, reload,
ordered reconnect and shared hashes; `stageeditor-save.test.ts` covers queued
Stage saves, duplicate prevention and retained drafts across remounts. The accepted decision
above is preserved; no external Loop decision was sent.

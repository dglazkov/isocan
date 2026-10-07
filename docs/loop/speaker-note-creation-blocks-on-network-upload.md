---
title: Speaker note creation blocks on network upload
loop:
  - 3d625656-57c6-41e1-b9f7-060572a57225
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: accepted
rank: later
project: multiuser
since: 2026-10-07
note: "Holds: addSpeakerNote (notes.ts:13-32) awaits raw uploadBlob instead of uploadOrStageTextBlob, so creating a slide speaker note fails offline unlike addTextNode."
---

# Speaker note creation blocks on network upload

> **Loop says** (P2): Creating a slide speaker note executes a synchronous network upload before dispatching the item creation request. Slow network connections delay speaker note placement until the HTTP upload completes.

- `packages/web/src/lib/notes.ts#L13-L32`

## Our read

Verified in packages/web/src/lib/notes.ts:13-32 (addSpeakerNote): line 16 calls uploadBlob(canvasId, blob, TEXT_FILENAME) directly and line 19 calls sendCreatedItem without allowQueued or stagedBlob. By contrast, ordinary markdown text creation in packages/web/src/lib/text.ts:63-111 uses uploadOrStageTextBlob(canvasId, body, TEXT_MIME, TEXT_FILENAME) from packages/web/src/lib/upload.ts:440-457 and passes { allowQueued: true, stagedBlob } so notes work offline and flush on reconnect. Switching addSpeakerNote to uploadOrStageTextBlob is a one-line consistency fix.

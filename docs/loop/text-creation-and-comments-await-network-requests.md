---
title: Text creation and comments await network requests
loop:
  - c4ce7a8c-c0b0-47e7-8e6a-7fe7d568e6d9
loop_rank: P2
loop_state: DISMISSED
loop_goal: Fast everywhere, local-first
decision: done
rank: next
project: multiuser
since: 2026-09-30
note: "done 2026-09-29: addTextNode and reviseTextNode stage deterministic Markdown blobs via uploadOrStageTextBlob when offline, and TextComposer commit awaits success before clearing pendingText (offline.test.ts, textedit.test.ts)"
---

# Text creation and comments await network requests

> **Loop says** (P2): Text creation and editing workflows execute HTTP blob uploads before queueing optimistic canvas operations. Similarly, comment submissions lock user input and disable form controls while awaiting HTTP roundtrips. These network waits cause UI freezes during routine editing actions.

- `packages/web/src/lib/text.ts#L49`
- `packages/web/src/lib/text.ts#L110`
- `packages/web/src/lib/messagecontext.ts#L89-L102`
- `packages/web/src/components/CommentLayer.tsx#L447`

## Our read

**Verified and fixed against the code (2026-09-29):**

- `packages/web/src/lib/text.ts` (`addTextNode`, `reviseTextNode`) now stages deterministic Markdown blobs via `uploadOrStageTextBlob` in `packages/web/src/lib/upload.ts` and forwards `stagedBlob` through `sendEchoed` (`packages/web/src/stores/canvasStore.ts`) so text creation and edits apply immediately to the local replica and replay on reconnect (`packages/web/test/offline.test.ts`).
- `packages/web/src/components/TextComposer.tsx` (`commit`) awaits `addTextNode` / `reviseTextNode` and returns early if the write is refused before clearing `pendingText` (`packages/web/test/textedit.test.ts`).
- Comment operations (`comment.add`, `comment.reply`) already routed through `sendEchoed` into the offline outbox.

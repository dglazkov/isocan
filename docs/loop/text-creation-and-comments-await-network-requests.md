---
title: "Text creation and comments await network requests"
loop: c4ce7a8c-c0b0-47e7-8e6a-7fe7d568e6d9
loop_rank: P2
loop_state: DISMISSED
loop_goal: "Fast everywhere, local-first"
decision: declined
rank: never
project: new
since: 2026-09-29
note: "By design: text creation uploads its blob before the echoed op because the echo must describe an existing blob, and comment inputs stay editable while pending. Only the send button disables. Reopen with a report of a frozen input."
---

# Text creation and comments await network requests

> **Loop says** (P2): Text creation and editing workflows execute HTTP blob uploads before queueing optimistic canvas operations. Similarly, comment submissions lock user input and disable form controls while awaiting HTTP roundtrips. These network waits cause UI freezes during routine editing actions.

- `packages/web/src/lib/text.ts#L49`
- `packages/web/src/lib/text.ts#L110`
- `packages/web/src/lib/messagecontext.ts#L89-L102`
- `packages/web/src/components/CommentLayer.tsx#L447`

## Our read

packages/web/src/lib/text.ts:47-49 awaits uploadBlob then sendCreatedItem; the comment at ~L60-70 explains the optimistic echo must describe a blob that exists at the home, and rejects echoing a version nobody can fetch. messagecontext.ts:89-102 submit() sets busy and disables the send control (disabled: busy || queued) but its own comment says inputs remain editable while the request is pending, and queued messages release the composer. CommentLayer.tsx:447 onSubmit just awaits that. A tiny text blob is fast locally; a slow-home case could show a delay before the node appears, not measured.

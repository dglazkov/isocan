---
title: Copy compare mix blocks on remote uploads
loop:
  - 809969c5-3a4a-4565-9c38-a31544a46bc0
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: proposed
rank: never
project: copy-edit
since: 2026-10-07
note: "True mechanism, narrow by design: mixCopy awaits host.putBlob and host.send before closing the modal (copymix.ts:106-117, CopyCompare.tsx:159-168) so errors render in-dialog and the mix plus variant trashing land as one undo group. Reopen if mix latency or offline mixing is measured as a user pain point."
---

# Copy compare mix blocks on remote uploads

> **Loop says** (P2): Applying a copy mix in Copy Compare executes synchronous HTTP blob uploads for the changed visual face and screen HTML before dispatching canvas operations. Modal dismissal and user interaction stay blocked on network upload latency rather than applying local updates optimistically.

- `packages/web/src/lib/copymix.ts#L105-L117`
- `packages/web/src/components/CopyCompare.tsx#L155-L168`
- `packages/web/src/lib/modulehost.ts#L61-L72`

## Our read

Verified in packages/web/src/lib/copymix.ts:106-117 and packages/web/src/components/CopyCompare.tsx:155-168: mixCopy uploads the optional visual face blob (line 106) and merged HTML blob (line 114) via host.putBlob (packages/web/src/lib/modulehost.ts:61-72) and then awaits host.send(copyMixOps(...), newGroupId()) (line 117), which routes through sendEchoedResult (modulehost.ts:55). CopyCompare.tsx:157-167 sets busy=true and awaits mixCopy before calling onClose() and flashNotice() so any stale-address or network failure displays inside the dialog (line 166) rather than after dismissal, and the new source version plus trashing of voice variants land together as one undo group.

---
title: Group brief creation waits for blob upload
loop:
  - ba83261f-6b70-485f-8c89-27e6f8ac5de9
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: declined
rank: never
project: canvas-groups
since: 2026-10-07
note: "True mechanism, narrow by design: saveGroupBrief and createCanvasGroup (canvasgroups.ts:44-49, 56-70) upload group.md before sending the group operation via sendEchoedResult; staging offline blobs for group.change would require extending outbox blob staging beyond item.add/addVersion. Reopen if offline group creation is needed."
---

# Group brief creation waits for blob upload

> **Loop says** (P2): Canvas group creation and brief saving execute a synchronous network upload before dispatching local state changes. High network latency or offline mode halts the operation before local items render. This blocking behavior violates local-first design goals.

- `packages/web/src/lib/canvasgroups.ts#L44-L49`
- `packages/web/src/lib/canvasgroups.ts#L56-L70`
- `packages/web/src/lib/api.ts#L769-L800`

## Our read

Verified in packages/web/src/lib/canvasgroups.ts:44-49 and 56-70: saveGroupBrief (line 47) and createCanvasGroup (line 62) await uploadBlob(canvasId, new Blob([brief || '\n'], { type: 'text/markdown' }), 'group.md') (packages/web/src/lib/api.ts:769-800) before calling changeGroupItem or changeCanvasGroup, which dispatch through sendEchoedResult (canvasgroups.ts:32, 39). While text nodes and drawings stage deterministic blobs offline via uploadOrStageTextBlob (packages/web/src/lib/upload.ts:440-457), createCanvasGroup dispatches a structural group.change (wrap or create) rather than item.add, and api.ts:755-768 explicitly documents the offline upload refusal message. Reopen if offline group creation or brief editing becomes a user requirement.

---
title: Absence of spatial comment thread lifecycle status
loop:
  - 3c77a03b-4f46-4cfb-966a-455789a21e9b
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: declined
rank: never
since: 2026-10-07
note: "By design: finished pins are removed from live canvas state with undoable thread.delete/thread.restore (packages/core/src/ops.ts:407, 457) or cleaned with comment.remove (packages/core/src/ops.ts:437), while structured design questions already track open/resolved status via questionnaireStates (packages/cli/src/questionnaire.ts:52)."
---

# Absence of spatial comment thread lifecycle status

> **Loop says** (P2): Spatial comment threads lack status fields and event triggers to track resolved feedback. Without thread status management, canvas elements retain stale feedback pins and agents cannot detect when collaborators resolve design comments. Benchmark canvas tools like Figma and Miro provide comment thread lifecycle states to coordinate design updates.

- `packages/core/src/model.ts#L291-L312`
- `packages/core/src/ops.ts#L350-L410`
- `packages/core/src/itemthread.ts#L50-L55`
- `packages/core/src/inbox.ts#L897-L920`

## Our read

Checked packages/core/src/model.ts:291-312, packages/core/src/ops.ts:350-459, packages/core/src/itemthread.ts:50-55, and packages/core/src/inbox.ts:880-920. CommentThread (model.ts:291-311) intentionally omits a separate resolved status field because done threads are deleted from live state via thread.delete (ops.ts:407) with full undo recovery via thread.restore (ops.ts:457) and individual messages are cleaned via comment.remove (ops.ts:437). Meanwhile, structured questionnaires track open vs resolved per question in questionnaireStates (packages/cli/src/questionnaire.ts:52), and inbox.ts:880-920 only summons agents on new comments that address them.

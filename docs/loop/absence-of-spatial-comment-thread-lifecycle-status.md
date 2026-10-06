---
title: Absence of spatial comment thread lifecycle status
loop:
  - 3c77a03b-4f46-4cfb-966a-455789a21e9b
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: untriaged
---

# Absence of spatial comment thread lifecycle status

> **Loop says** (P2): Spatial comment threads lack status fields and event triggers to track resolved feedback. Without thread status management, canvas elements retain stale feedback pins and agents cannot detect when collaborators resolve design comments. Benchmark canvas tools like Figma and Miro provide comment thread lifecycle states to coordinate design updates.

- `packages/core/src/model.ts#L291-L312`
- `packages/core/src/ops.ts#L350-L410`
- `packages/core/src/itemthread.ts#L50-L55`
- `packages/core/src/inbox.ts#L897-L920`

## Our read

Not yet checked against the code.

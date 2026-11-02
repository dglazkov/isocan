---
title: Agent guide omits actor identity operation schemas
loop:
  - c96f388d-12c4-4b99-bf95-d8144f122fc9
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# Agent guide omits actor identity operation schemas

> **Loop says** (P2): The agent guide documentation omits JSON operation schemas and parameter specifications for core actor identity operations. The core operation vocabulary defines actor.claim, actor.setColor, actor.setMark, and actor.join to manage actor identities and presence styling. Autonomous agents referencing agent-guide.md cannot discover or invoke these actor identity operations.

- `packages/cli/src/agent-guide.md`
- `packages/core/src/ops.ts#L98-L200`

## Our read

Not yet checked against the code.

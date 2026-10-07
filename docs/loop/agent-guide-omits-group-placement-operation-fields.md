---
title: Agent guide omits group placement operation fields
loop:
  - 3f7edca1-e591-44b1-a7d7-32ee0a17a18b
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# Agent guide omits group placement operation fields

> **Loop says** (P2): The daemon core defines group operation fields including groupMode, groupPlacement, containerId, and resizedArea on the Op schema. However, the agent guide documentation omits these group placement fields from its reference tables. Autonomous agents reading the guide cannot discover or format valid canvas group operations.

- `packages/core/src/ops.ts#L1-L100`
- `packages/core/src/canvas-group-types.ts#L1-L50`
- `packages/cli/src/agent-guide.md#L1-L200`

## Our read

Not yet checked against the code.

---
title: Agent guide omits comment restore and anchor operations
loop:
  - b7b86380-8646-460c-b0d1-19755127e197
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# Agent guide omits comment restore and anchor operations

> **Loop says** (P2): The core daemon defines operation schemas for comment restoration and thread anchoring in its operations module. However, the agent guide omits documentation for comment.restore, thread.restore, thread.setAnchor, and thread.setMain payloads. Without these operation specifications in reference documentation, autonomous agents cannot discover or construct these payloads to interact fully with daemon capabilities.

- `packages/core/src/ops.ts#L390-L461`
- `packages/cli/src/agent-guide.md#L136-L138`

## Our read

Not yet checked against the code.

---
title: Agent guide omits project lifecycle operation schemas
loop:
  - 63a76341-8313-4c84-9004-a1611aa0b7c8
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# Agent guide omits project lifecycle operation schemas

> **Loop says** (P2): The agent guide documentation omits operation schemas for project lifecycle verbs defined in core. Omitting project creation, deletion, and update operations prevents autonomous agents from constructing valid project management payloads.

- `packages/core/src/ops.ts#L380-L410`
- `packages/cli/src/agent-guide.md`

## Our read

Not yet checked against the code.

---
title: Agent guide omits agent enrollment operation schemas
loop:
  - cdc24864-11ee-464c-8da1-b2f9c4e45ef3
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# Agent guide omits agent enrollment operation schemas

> **Loop says** (P2): The agent guide documentation omits operation schemas and parameter definitions for agent enrollment and withdrawal operations. Core defines agent.enroll and agent.withdraw to manage agent key enrollment and revocation. Autonomous agents cannot discover or construct key enrollment operations from agent-guide.md.

- `packages/cli/src/agent-guide.md`
- `packages/core/src/ops.ts#L450-L460`

## Our read

Not yet checked against the code.

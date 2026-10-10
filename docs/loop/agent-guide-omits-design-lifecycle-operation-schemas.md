---
title: Agent guide omits design lifecycle operation schemas
loop:
  - d4e67a52-6382-44c1-9992-601bf47ccbf9
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# Agent guide omits design lifecycle operation schemas

> **Loop says** (P2): The core daemon defines operation payload schemas for design reconciliation and recovery operations including design.repair, design.restore, and design.receipt. However, the agent guide documentation omits daemon operation payload schemas for these design reconciliation and recovery operations. Without documented operation specifications, autonomous agents cannot construct raw operation payloads for design reconciliation and recovery.

- `packages/core/src/ops.ts#L236-L242`
- `packages/cli/src/agent-guide.md#L1502-L1845`

## Our read

Not yet checked against the code.

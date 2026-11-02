---
title: Agent guide omits group placement operation fields
loop:
  - 3f7edca1-e591-44b1-a7d7-32ee0a17a18b
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: stale
rank: never
project: canvas-groups
since: 2026-10-07
note: "Stale: groupMode, groupPlacement, containerId, and resizedArea (ops.ts:47-56) are internal reducer fields, while every CLI group and placement verb is documented in agent-guide.md:146 and enforced by surface.test.ts."
---

# Agent guide omits group placement operation fields

> **Loop says** (P2): The daemon core defines group operation fields including groupMode, groupPlacement, containerId, and resizedArea on the Op schema. However, the agent guide documentation omits these group placement fields from its reference tables. Autonomous agents reading the guide cannot discover or format valid canvas group operations.

- `packages/core/src/ops.ts#L1-L100`
- `packages/core/src/canvas-group-types.ts#L1-L50`
- `packages/cli/src/agent-guide.md#L1-L200`

## Our read

Verified in packages/core/src/ops.ts:47-56 and packages/core/src/canvas-group-types.ts:1-50: groupMode, groupPlacement, containerId, and resizedArea are internal Operation fields sent to POST /api/ops, not CLI flags. Agents act through CLI verbs (`isocan canvas group new|wrap|ls|show|add|remove|ungroup|resize|frame|layout|grid|stack|migrate`, `isocan area`, and `--in`), all documented in packages/cli/src/agent-guide.md:146 and verified by packages/cli/test/surface.test.ts:1-50.

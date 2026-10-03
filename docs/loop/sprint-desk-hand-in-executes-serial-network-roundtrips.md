---
title: "Sprint desk hand-in executes serial network roundtrips"
loop: 7142ae7d-be22-4779-847c-59e001468c9e
loop_rank: P2
loop_state: ACTIVE
loop_goal: "Fast everywhere, local-first"
decision: untriaged
---

# Sprint desk hand-in executes serial network roundtrips

> **Loop says** (P2): Handing in desk items to a sprint processes each item sequentially in a loop. The hand-in handler executes serial network roundtrips for blob reads, blob uploads, and operation posts per item. This design causes total hand-in latency to scale linearly with item count, delaying sprint board updates on high-latency connections.

- `packages/web/src/lib/sprint.ts#L274-L312`

## Our read

Not yet checked against the code.

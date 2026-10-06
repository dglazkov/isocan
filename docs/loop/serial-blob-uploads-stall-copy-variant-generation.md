---
title: Serial blob uploads stall copy variant generation
loop:
  - 78c25c4e-a2fe-4939-b38f-50980cce5e34
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: untriaged
---

# Serial blob uploads stall copy variant generation

> **Loop says** (P2): The vary copy handler iterates through generated variants sequentially. It awaits synchronous HTTP blob uploads for each variant before creating canvas operations. For N requested variants with visual faces, this executes up to 2N serial network roundtrips before dispatching operations. This sequential network bottleneck causes input latency proportional to variant count, violating local-first responsiveness goals.

- `packages/web/src/lib/varycopy.ts#L95-L121`
- `packages/cli/src/main.ts#L8459-L8480`

## Our read

Not yet checked against the code.

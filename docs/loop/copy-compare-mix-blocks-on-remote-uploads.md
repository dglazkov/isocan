---
title: Copy compare mix blocks on remote uploads
loop:
  - 809969c5-3a4a-4565-9c38-a31544a46bc0
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: untriaged
---

# Copy compare mix blocks on remote uploads

> **Loop says** (P2): Applying a copy mix in Copy Compare executes synchronous HTTP blob uploads for the changed visual face and screen HTML before dispatching canvas operations. Modal dismissal and user interaction stay blocked on network upload latency rather than applying local updates optimistically.

- `packages/web/src/lib/copymix.ts#L105-L117`
- `packages/web/src/components/CopyCompare.tsx#L155-L168`
- `packages/web/src/lib/modulehost.ts#L61-L72`

## Our read

Not yet checked against the code.

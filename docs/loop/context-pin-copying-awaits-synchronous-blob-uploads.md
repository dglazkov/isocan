---
title: Context pin copying awaits synchronous blob uploads
loop:
  - 606aa4d9-4fa4-4a6b-94b8-173e234fffe8
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: untriaged
---

# Context pin copying awaits synchronous blob uploads

> **Loop says** (P2): Copying pinned context sources across canvases needs synchronous HTTP blob uploads before submitting group change operations. When the network is slow or offline, blob upload requests throw errors and fail the context pin operation. This prevents local-first copying and blocks context pin creation on network round-trips.

- `packages/web/src/lib/context-pin.ts#L28-L42`
- `packages/api/src/context-pin.ts#L171`
- `packages/web/src/lib/api.ts#L769-L796`

## Our read

Not yet checked against the code.

---
title: Talk session token request bypasses local replica
loop:
  - 5bf98155-ca32-4b86-94a7-ee2224a73162
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: untriaged
---

# Talk session token request bypasses local replica

> **Loop says** (P2): Talk live session initialization makes a direct HTTP POST request to `/api/voice/token. When operating offline or through local daemons, the request fails without falling back to local replica credentials or offline modes.

- `packages/modules/talk/src/web.tsx`

## Our read

Not yet checked against the code.

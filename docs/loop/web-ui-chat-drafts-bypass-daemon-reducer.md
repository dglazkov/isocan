---
title: Web UI chat drafts bypass daemon reducer
loop:
  - d592d9a3-9b31-4450-a74b-c3cff6b54eb2
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# Web UI chat drafts bypass daemon reducer

> **Loop says** (P2): The Web UI manages unsubmitted chat drafts using an in-memory Zustand store partitioned by canvas and actor ID. Because core operation definitions include no message draft sync ops, draft state bypasses the daemon reducer entirely. Consequently, unsubmitted message drafts are isolated to local React state and fail to synchronize across client devices.

- `packages/web/src/lib/chatdraft.ts`
- `packages/core/src/ops.ts`

## Our read

Not yet checked against the code.

---
title: Personal canvas linking mutations bypass local replica
loop:
  - 93a279d6-0a76-4519-8638-eda7b0d64737
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: untriaged
---

# Personal canvas linking mutations bypass local replica

> **Loop says** (P2): Personal canvas linking, unlinking, and delegate authorization actions execute direct REST HTTP requests to server endpoints. The core operation vocabulary lacks operation types for personal context mutations, so these actions bypass the local write queue and IndexedDB replica store. Consequently, personal canvas linking actions fail when offline and stall on network latency, violating local-first architecture principles.

- `packages/web/src/lib/personal.ts#L18-L21`
- `packages/core/src/ops.ts#L96-L530`
- `packages/web/src/lib/writequeue.ts#L152-L177`

## Our read

Not yet checked against the code.

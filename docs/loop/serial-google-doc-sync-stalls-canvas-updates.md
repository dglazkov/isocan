---
title: Serial Google Doc sync stalls canvas updates
loop:
  - 7def013d-973c-419e-abcb-0753ed1b9665
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: untriaged
---

# Serial Google Doc sync stalls canvas updates

> **Loop says** (P2): The Google Doc CLI synchronization handler processes canvas documents sequentially in a single loop. Each document executes serial network calls for Drive metadata check, document content retrieval, blob storage upload, and operation dispatch. Network latency accumulates linearly with document count, causing CLI execution stalls when synchronizing canvases with multiple Google Docs.

- `packages/cli/src/main.ts#L7166-L7200`

## Our read

Not yet checked against the code.

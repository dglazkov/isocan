---
title: Area creation awaits network blob upload
loop:
  - ea2b0f51-b6c8-4f0c-851d-11544ff656bb
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: untriaged
---

# Area creation awaits network blob upload

> **Loop says** (P2): Area creation executes a synchronous network upload before dispatching optimistic item creation operations. High network latency delays area sheet rendering until the HTTP upload request completes. Under offline network conditions, area creation fails immediately rather than staging the item locally.

- `packages/web/src/lib/upload.ts#L247-L274`
- `packages/web/src/lib/api.ts#L769-L801`

## Our read

Not yet checked against the code.

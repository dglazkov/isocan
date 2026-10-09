---
title: Serial model calls slow wireframe flow operations
loop:
  - 1bc95618-c803-4b7c-9edc-fa7f7ad738b7
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: untriaged
---

# Serial model calls slow wireframe flow operations

> **Loop says** (P2): Wireframe AI copy generation and visual polish operations iterate sequentially over screen items and slot batches. The workflow awaits serial LLM model requests and serial HTML blob uploads across flow screens rather than executing independent requests concurrently. In multi-screen flows, this sequential model call and write path pattern accumulates multi-second delays before emitting canvas operations.

- `packages/modules/wireframe/src/copy-schema.ts#L259-L296`
- `packages/modules/wireframe/src/copy-schema.ts#L582-L600`
- `packages/modules/wireframe/src/polish.ts#L324-L380`

## Our read

Not yet checked against the code.

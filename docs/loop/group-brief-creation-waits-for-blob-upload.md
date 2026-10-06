---
title: Group brief creation waits for blob upload
loop:
  - ba83261f-6b70-485f-8c89-27e6f8ac5de9
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: untriaged
---

# Group brief creation waits for blob upload

> **Loop says** (P2): Canvas group creation and brief saving execute a synchronous network upload before dispatching local state changes. High network latency or offline mode halts the operation before local items render. This blocking behavior violates local-first design goals.

- `packages/web/src/lib/canvasgroups.ts#L44-L49`
- `packages/web/src/lib/canvasgroups.ts#L56-L70`
- `packages/web/src/lib/api.ts#L769-L800`

## Our read

Not yet checked against the code.

---
title: Design recipe addition blocks on remote blob upload
loop:
  - ba9ebfe4-cd8e-4d8d-8e84-66eff1a7abc6
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: untriaged
---

# Design recipe addition blocks on remote blob upload

> **Loop says** (P2): Adding a design reference or system recipe to a canvas blocks on a synchronous remote blob upload over HTTP before posting canvas operations. This creates UI latency and prevents immediate local rendering.

- `packages/web/src/components/DesignRecipeLibrary.tsx#L32-L58`

## Our read

Not yet checked against the code.

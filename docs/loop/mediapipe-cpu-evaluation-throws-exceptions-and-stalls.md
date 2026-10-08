---
title: MediaPipe CPU evaluation throws exceptions and stalls
loop:
  - 30c1d26d-c034-4af0-b6d6-738f97d7e5b8
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: untriaged
---

# MediaPipe CPU evaluation throws exceptions and stalls

> **Loop says** (P2): When running the local judge without WebGPU support, MediaPipe Decision Maker 1.1.0's CPU delegate throws runtime exceptions during evaluation. The worker patches module functions to resolve missing promise returns, but evaluation on CPU takes 0.8 to 3 seconds per answer. This multi-second latency causes severe UI stalls on non-WebGPU devices, conflicting with instant local execution goals.

- `packages/web/src/judge/worker.ts`
- `packages/web/src/judge/local.ts`
- `docs/changelog/2026-10-07.md`
- `docs/research/2026-10-07-embeddinggemma-in-the-browser.md`

## Our read

Not yet checked against the code.

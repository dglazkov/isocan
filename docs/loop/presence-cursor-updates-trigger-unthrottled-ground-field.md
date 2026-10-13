---
title: Presence cursor updates trigger unthrottled ground field mutations
loop:
  - 1597f30a-8e7e-4686-8eb3-7b4f3149053a
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: untriaged
---

# Presence cursor updates trigger unthrottled ground field mutations

> **Loop says** (P2): Presence updates from remote cursors and agents invoke living ground state mutations synchronously on every message. High-frequency presence streams trigger unthrottled WebGL field stamp calculations and wake cycles on every packet. This lack of animation frame batching causes main-thread frame drops during active co-design sessions.

- `packages/web/src/components/themes/LivingGround.tsx#L113-L125`
- `packages/web/src/components/themes/GroundHost.ts#L140-L148`
- `packages/web/src/lib/groundcursors.ts#L10-L33`

## Our read

Not yet checked against the code.

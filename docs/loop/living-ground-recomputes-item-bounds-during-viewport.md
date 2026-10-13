---
title: Living ground recomputes item bounds during viewport movement
loop:
  - b761d813-c90a-449e-8c78-d9a08503f0f3
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: untriaged
---

# Living ground recomputes item bounds during viewport movement

> **Loop says** (P2): Viewport store updates trigger item rectangle recalculations on every frame during canvas panning and zooming. Every viewport shift allocates new typed arrays and executes array equality checks across canvas items, introducing main-thread overhead during continuous interaction.

- `packages/web/src/components/themes/LivingGround.tsx#L83-L96`
- `packages/web/src/components/themes/GroundHost.ts#L70-L80`

## Our read

Not yet checked against the code.

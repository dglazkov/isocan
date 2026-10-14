---
title: Wireframe slots lack contextual synthetic data filling
loop:
  - f28a8a75-fc38-4a53-8215-1efd2fa17fcf
loop_rank: P2
loop_state: DISMISSED
loop_goal: pg_v67IPNa4
decision: untriaged
---

# Wireframe slots lack contextual synthetic data filling

> **Loop says** (P2): isocan wireframe components rely on structural prop definitions and fallback content packs for slot rendering. Composition pipelines populate wireframe slots with generic placeholder strings rather than schema-driven synthetic mock data. Without dynamic contextual data filling, co-designers cannot effectively evaluate realistic UI layout density and content flows.

- `packages/modules/wireframe/src/catalog/types.ts#L23-L38`
- `packages/modules/wireframe/src/catalog/blocks.ts#L1-L50`
- `packages/modules/wireframe/src/flesh.ts#L66-L108`
- `packages/modules/wireframe/src/compose.ts#L27-L60`
- `packages/modules/wireframe/src/copy-schema.ts#L71-L128`

## Our read

Not yet checked against the code.

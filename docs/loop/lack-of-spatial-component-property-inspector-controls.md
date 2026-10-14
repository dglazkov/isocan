---
title: Lack of spatial component property inspector controls
loop:
  - 553f5352-f23c-46b2-bc16-af184f990854
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: untriaged
---

# Lack of spatial component property inspector controls

> **Loop says** (P2): isocan wireframe component items encode component properties statically inside text specifications without exposing interactive property inspector controls on canvas item selection. Selecting a wireframe card displays raw text or static vectors rather than a structured property override panel. Consequently, human and agent collaborators must edit raw specification text to tweak component parameters, increasing editing friction.

- `packages/modules/wireframe/src/catalog/types.ts`
- `packages/modules/wireframe/src/spec.ts`
- `packages/web/src/components/StageEditor.tsx`
- `packages/web/src/components/ItemView.tsx`

## Our read

Not yet checked against the code.

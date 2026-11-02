---
title: Lack of design token reactive variable bindings
loop:
  - 4cd7b298-9106-4107-97d6-afc92bc3dee1
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: untriaged
---

# Lack of design token reactive variable bindings

> **Loop says** (P2): isocan resolves design system rules as static property values during document parsing without creating reactive token variable bindings on canvas items. Wireframe catalog renderers use hardcoded grayscale values and static slot props rather than token variable references. As a result, when an AI agent or human updates brand guidelines or color tokens, canvas screens do not reflect the updates reactively.

- `packages/core/src/designsystem.ts`
- `packages/modules/wireframe/src/spec.ts`
- `packages/modules/wireframe/src/catalog/draw.ts`
- `packages/core/src/model.ts`

## Our read

Not yet checked against the code.

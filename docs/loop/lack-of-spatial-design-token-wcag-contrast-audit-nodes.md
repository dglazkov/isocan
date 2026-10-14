---
title: Lack of spatial design token WCAG contrast audit nodes
loop:
  - 97ede8ef-0cf9-4310-81ec-a36db052a6a3
loop_rank: P2
loop_state: DISMISSED
loop_goal: pg_v67IPNa4
decision: untriaged
---

# Lack of spatial design token WCAG contrast audit nodes

> **Loop says** (P2): Product design platforms like Figma and Visily provide automated WCAG color contrast ratio audits directly on spatial canvas frames. isocan theme utilities resolve color tokens as CSS custom properties without evaluating contrast ratios between foreground and background tokens. Consequently, human and agent co-designers cannot evaluate accessibility compliance directly on canvas wireframe cards.

- `packages/core/src/theme.ts#L1-L50`
- `packages/modules/wireframe/src/catalog/draw.ts#L1-L100`

## Our read

Not yet checked against the code.

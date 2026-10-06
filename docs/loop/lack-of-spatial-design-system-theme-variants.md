---
title: Lack of spatial design system theme variants
loop:
  - ecbd643b-a432-4c7e-987f-5d3e48f27f9c
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: untriaged
---

# Lack of spatial design system theme variants

> **Loop says** (P2): The wireframe engine resolves global CSS custom properties at render time without support for theme variants. Existing canvas governance constructs resolve one design system per scope without operations to attach mode variants to individual frames. Therefore, users cannot switch or preview spatial theme variants across canvas regions during UI exploration.

- `packages/modules/wireframe/src/theme.ts#L69-L92`
- `packages/core/src/tokens.ts#L379-L406`
- `packages/core/src/designsystem.ts#L79-L130`

## Our read

Not yet checked against the code.

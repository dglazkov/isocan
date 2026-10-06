---
title: Design briefs lack structured prompt templates
loop:
  - 1d6d1671-8ef4-4ee2-8f72-cc7a4636aaf9
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: untriaged
---

# Design briefs lack structured prompt templates

> **Loop says** (P2): Design briefs parse freehand text strings without structured prompt templates or parameter validation schemas. The design request reader evaluates brief completeness using simple string null-checks rather than validated schema parameters. Consequently, design briefs remain decoupled from wireframe layout archetypes and component specifications, leading to unpredictable AI generation on canvas.

- `packages/core/src/design-brief.ts#L6-L18`
- `packages/api/src/design-request-reader.ts#L204-L215`
- `packages/modules/wireframe/src/catalog/index.ts#L1-L25`

## Our read

Not yet checked against the code.

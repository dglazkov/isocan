---
title: Absence of multi-screen user journey flow generation
loop:
  - 67362299-9924-4d89-bcd2-b25eb581cae0
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: untriaged
---

# Absence of multi-screen user journey flow generation

> **Loop says** (P2): Isocan processes design briefs and wireframe specifications on a screen-by-screen basis without multi-screen user journey flow generation. Design briefs parse single target items and individual request records rather than multi-screen journey flows. Wireframe specs generate isolated single-screen specifications without cross-screen step synthesis or horizontal layout placement on the canvas.

- `packages/api/src/design-request-reader.ts#L135-L218`
- `packages/core/src/design-brief.ts#L6-L19`
- `packages/modules/wireframe/src/spec.ts#L23-L128`
- `packages/core/src/area.ts#L164-L246`

## Our read

Not yet checked against the code.

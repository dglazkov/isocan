---
title: Absence of multi-screen user journey flow generation
loop:
  - 67362299-9924-4d89-bcd2-b25eb581cae0
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: stale
rank: never
project: wireframes
since: 2026-10-07
note: "Stale (duplicate of lack-of-multi-screen-user-flow-canvas-scaffolding): flow.ts:23-42 and compose.ts:73-98 compose multi-screen flows in three rounds, lay out screen rows horizontally, and build a playable prototype."
---

# Absence of multi-screen user journey flow generation

> **Loop says** (P2): Isocan processes design briefs and wireframe specifications on a screen-by-screen basis without multi-screen user journey flow generation. Design briefs parse single target items and individual request records rather than multi-screen journey flows. Wireframe specs generate isolated single-screen specifications without cross-screen step synthesis or horizontal layout placement on the canvas.

- `packages/api/src/design-request-reader.ts#L135-L218`
- `packages/core/src/design-brief.ts#L6-L19`
- `packages/modules/wireframe/src/spec.ts#L23-L128`
- `packages/core/src/area.ts#L164-L246`

## Our read

Verified in packages/modules/wireframe/src/flow.ts:23-42 and packages/modules/wireframe/src/compose.ts:73-98: `isocan wire "<request>"` and `/wire` compose multi-screen journeys across shared chrome in three rounds, place screens horizontally with a GAP of 80 world units, wire cross-screen navigation in packages/modules/wireframe/src/links.ts:1-40, and assemble a clickable prototype in packages/modules/wireframe/src/kept-flows.ts:20, while DesignBrief.outputIds (packages/core/src/design-brief.ts:17) tracks multiple output screens.

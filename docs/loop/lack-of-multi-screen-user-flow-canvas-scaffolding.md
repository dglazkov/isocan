---
title: "Lack of multi-screen user flow canvas scaffolding"
loop: 6bddc804-0cfd-4686-9e07-ebd2ef9a69a9
loop_rank: P2
loop_state: DISMISSED
loop_goal: "What canvas tools teach us"
decision: untriaged
---

# Lack of multi-screen user flow canvas scaffolding

> **Loop says** (P2): isocan's design request reader and wireframe module process single screen briefs in isolation. The design brief parser converts prompt text into individual screen requests without generating multi-screen user flow wireframe grids. Consequently, users and AI agents must construct and lay out each screen card manually rather than scaffolding complete multi-screen product journeys on the canvas.

- `packages/api/src/design-request-reader.ts#L30-L75`
- `packages/modules/wireframe/src/spec.ts#L45-L98`
- `packages/core/src/design-brief.ts#L20-L65`
- `packages/modules/wireframe/src/cli.ts#L40-L85`

## Our read

Not yet checked against the code.

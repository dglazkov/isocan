---
title: Lack of multi-screen user flow canvas scaffolding
loop:
  - 6bddc804-0cfd-4686-9e07-ebd2ef9a69a9
loop_rank: P2
loop_state: DISMISSED
loop_goal: What canvas tools teach us
decision: stale
rank: never
project: wireframes
since: 2026-10-07
note: 'Stale (and already dismissed in Loop): wire "<request>" composes multi-screen flows in three rounds across shared chrome, lays out screen rows with variations, and builds a playable prototype (flow.ts:24-40, compose.ts:73-98), while DesignBrief tracks multiple outputIds (design-brief.ts:17).'
---

# Lack of multi-screen user flow canvas scaffolding

> **Loop says** (P2): isocan's design request reader and wireframe module process single screen briefs in isolation. The design brief parser converts prompt text into individual screen requests without generating multi-screen user flow wireframe grids. Consequently, users and AI agents must construct and lay out each screen card manually rather than scaffolding complete multi-screen product journeys on the canvas.

- `packages/api/src/design-request-reader.ts#L30-L75`
- `packages/modules/wireframe/src/spec.ts#L45-L98`
- `packages/core/src/design-brief.ts#L20-L65`
- `packages/modules/wireframe/src/cli.ts#L40-L85`

## Our read

The claim is false for both wireframes and design briefs (and Loop already marked this insight DISMISSED). In the wireframe module, isocan wire "<request>" (packages/modules/wireframe/src/cli.ts:35-50, packages/modules/wireframe/src/compose-cli.ts:61-120) and /wire <request> run a three-round multi-screen flow composer (packages/modules/wireframe/src/compose.ts:73-98, packages/modules/wireframe/src/flow.ts:24-40): round 1 selects all needed screen archetypes for the product journey and fixes shared flow chrome (WireSpec.flow and WireSpec.chrome in packages/modules/wireframe/src/spec.ts:28,80-82), FlowCanvas lays out the screens in a horizontal row with variations stacked below (packages/modules/wireframe/src/flow.ts:127-200), and wire prototype assembles the kept screens into a playable multi-screen HTML router above the row (packages/modules/wireframe/src/cli.ts:94-99). Meanwhile parseDesignBrief (packages/core/src/design-brief.ts:6-19) and readDesignRequests (packages/api/src/design-request-reader.ts:30-79) track multi-item outputIds: string[] (packages/core/src/design-brief.ts:17, packages/api/src/design-request-reader.ts:33,77) and groupId scopes.

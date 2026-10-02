---
title: "Lack of component interface prop-table canvas documentation"
loop: 2db0c9f3-f661-4408-afc0-fe71a997befb
loop_rank: P2
loop_state: ACTIVE
loop_goal: "What canvas tools teach us"
decision: untriaged
---

# Lack of component interface prop-table canvas documentation

> **Loop says** (P2): isocan's wireframe catalog defines component slots and property contracts internally, but the canvas item renderer renders visual HTML elements without attaching component interface property tables. Design system tokens define style contracts without projecting developer prop schemas or slot signatures onto canvas cards. As a result, engineers and AI agents lack on-canvas component prop documentation during canvas-to-code implementation.

- `packages/modules/wireframe/src/catalog/index.ts#L17-L80`
- `packages/core/src/canvasitem.ts#L25-L103`
- `packages/core/src/designsystem.ts#L40-L95`
- `packages/modules/wireframe/src/spec.ts#L172-L186`

## Our read

Not yet checked against the code.

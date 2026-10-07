---
title: Lack of component interface prop-table canvas documentation
loop:
  - 2db0c9f3-f661-4408-afc0-fe71a997befb
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: declined
rank: never
project: wireframes
since: 2026-10-07
note: "By design: wireframe catalog props (wireframe/src/catalog/types.ts:23-27) are Jev structural question shapes embedded in WireSpec HTML comments (wireframe/src/spec.ts:22-37), not React/developer component APIs; same calibration as declined missing-spatial-developer-redlining-spec-overlays."
---

# Lack of component interface prop-table canvas documentation

> **Loop says** (P2): isocan's wireframe catalog defines component slots and property contracts internally, but the canvas item renderer renders visual HTML elements without attaching component interface property tables. Design system tokens define style contracts without projecting developer prop schemas or slot signatures onto canvas cards. As a result, engineers and AI agents lack on-canvas component prop documentation during canvas-to-code implementation.

- `packages/modules/wireframe/src/catalog/index.ts#L17-L80`
- `packages/core/src/canvasitem.ts#L25-L103`
- `packages/core/src/designsystem.ts#L40-L95`
- `packages/modules/wireframe/src/spec.ts#L172-L186`

## Our read

Verified in packages/modules/wireframe/src/catalog/index.ts:17-24, packages/modules/wireframe/src/catalog/types.ts:5-79, packages/core/src/canvasitem.ts:25-103, packages/core/src/designsystem.ts:40-95, and packages/modules/wireframe/src/spec.ts:172-186. As catalog/types.ts:5-27 explains, wireframe PropDef values (choice, flag, count, index) are the four shapes a Jev structural question can ask when composing low-fidelity wireframes, not developer UI component prop interfaces. Every rendered wireframe embeds its complete machine-readable WireSpec JSON in an HTML comment (readWire/renderWire in packages/modules/wireframe/src/render.ts), and DESIGN.md is an inspectable Markdown item on the canvas (designsystem.ts:16-23). Rendering developer prop-table documentation onto canvas cards is unrequested and duplicates the declined missing-spatial-developer-redlining-spec-overlays and lack-of-design-to-code-jsx-tailwind-export-pipeline findings.

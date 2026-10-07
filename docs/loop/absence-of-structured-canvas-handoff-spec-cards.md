---
title: Absence of structured canvas handoff spec cards
loop:
  - ffa2d1f8-082e-4c16-b00f-38ba798fb4de
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: proposed
rank: never
since: 2026-10-07
note: "By design and duplicate of declined handoff findings (docs/LOOP.md:47, 52): screens are already live HTML, wireframes embed a typed WireSpec (packages/modules/wireframe/src/spec.ts:23-128), and the coding handoff is the admitted design brief and DESIGN.md in packages/api/src/design-workflow.ts:24-32 rather than a separate canvas spec card."
---

# Absence of structured canvas handoff spec cards

> **Loop says** (P2): isocan lacks structured developer handoff cards on canvas that consolidate visual wireframes, design tokens, and route specs into single spec artifacts. Design brief modules ingest text requests to generate wireframe components, but provide no output spec card synthesis for engineering handoff. As a result, engineering teams must manually extract design tokens and screen specs from raw canvas nodes.

- `packages/modules/brief/src/index.ts#L15-L60`
- `packages/modules/wireframe/src/spec.ts#L150-L200`
- `packages/core/src/canvasitem.ts#L80-L130`

## Our read

Checked packages/modules/wireframe/src/spec.ts:150-200, packages/core/src/canvasitem.ts:80-115, and packages/api/src/design-workflow.ts:24-100 (packages/modules/brief/src/index.ts does not exist). In isocan, screens are already runnable HTML/CSS/JS items, wireframes carry an embedded JSON WireSpec (spec.ts:23-128), and coding agents read the admitted design brief, DESIGN.md tokens (design --css / --tokens), and repository components directly via the CLI and design craft --out (docs/LOOP.md:47, 52). Synthesizing a separate static handoff spec card on the canvas duplicates those artifacts.

---
title: Absence of structured canvas handoff spec cards
loop:
  - ffa2d1f8-082e-4c16-b00f-38ba798fb4de
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: untriaged
---

# Absence of structured canvas handoff spec cards

> **Loop says** (P2): isocan lacks structured developer handoff cards on canvas that consolidate visual wireframes, design tokens, and route specs into single spec artifacts. Design brief modules ingest text requests to generate wireframe components, but provide no output spec card synthesis for engineering handoff. As a result, engineering teams must manually extract design tokens and screen specs from raw canvas nodes.

- `packages/modules/brief/src/index.ts#L15-L60`
- `packages/modules/wireframe/src/spec.ts#L150-L200`
- `packages/core/src/canvasitem.ts#L80-L130`

## Our read

Not yet checked against the code.

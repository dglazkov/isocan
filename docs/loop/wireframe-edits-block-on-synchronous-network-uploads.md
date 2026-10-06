---
title: Wireframe edits block on synchronous network uploads
loop:
  - 74fe6f8b-8c0b-476b-ad81-a4662dcf5fa8
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: untriaged
---

# Wireframe edits block on synchronous network uploads

> **Loop says** (P2): Wireframe text and slot edits execute a synchronous remote network upload before dispatching item version updates to the canvas. Affected interactive prototypes also run a sequential synchronous upload before updating state. This design causes user-facing canvas updates to stall on network latency rather than applying optimistic local state changes.

- `packages/modules/wireframe/src/edit.ts#L432-L441`
- `packages/modules/wireframe/src/kept-flows.ts#L164-L169`

## Our read

Not yet checked against the code.

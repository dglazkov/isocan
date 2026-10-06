---
title: Lack of bidirectional canvas to code symbol bindings
loop:
  - a2ff575b-869f-4aeb-b8ff-f65dbe68f0b7
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: untriaged
---

# Lack of bidirectional canvas to code symbol bindings

> **Loop says** (P2): Canvas items and wireframe catalog entries store generic item properties and layout metadata but lack schema attributes for repository code symbol pointers. Also, address resolution in core handles canvas and item routes without supporting code symbol or AST node references. So, while design workflows need actual repository components, agents must do unguided file searches across the codebase to resolve visual components to source code.

- `packages/core/src/canvasitem.ts#L25-L103`
- `packages/core/src/address.ts#L27-L411`
- `packages/modules/wireframe/src/catalog/index.ts#L17-L23`
- `packages/api/src/design-workflow.ts#L13-L98`

## Our read

Not yet checked against the code.

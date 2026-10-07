---
title: Lack of bidirectional canvas to code symbol bindings
loop:
  - a2ff575b-869f-4aeb-b8ff-f65dbe68f0b7
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: declined
rank: never
project: design-partner
since: 2026-10-07
note: "By design: canvas items bind to workspace files via backingOf (canvasStore.ts:242-250) and designWorkflowProcedure (design-workflow.ts:13-22, 68-90) directs coding agents to inspect repository source directly rather than maintaining brittle AST symbol pointers on canvas items."
---

# Lack of bidirectional canvas to code symbol bindings

> **Loop says** (P2): Canvas items and wireframe catalog entries store generic item properties and layout metadata but lack schema attributes for repository code symbol pointers. Also, address resolution in core handles canvas and item routes without supporting code symbol or AST node references. So, while design workflows need actual repository components, agents must do unguided file searches across the codebase to resolve visual components to source code.

- `packages/core/src/canvasitem.ts#L25-L103`
- `packages/core/src/address.ts#L27-L411`
- `packages/modules/wireframe/src/catalog/index.ts#L17-L23`
- `packages/api/src/design-workflow.ts#L13-L98`

## Our read

Verified in packages/core/src/canvasitem.ts:25-103 (which defines canvas-on-canvas inception items wearing kind='canvas' and source=<url>), packages/core/src/address.ts:27-411 (HTTP/URL route parsers for canvases, items, decks, module pages, and workbenches), packages/modules/wireframe/src/catalog/index.ts:17-23 (the wireframe primitive/block lookup), and packages/api/src/design-workflow.ts:13-98. Isocan binds items to on-disk files through per-machine workspace backing (packages/web/src/stores/canvasStore.ts:242-250, docs/projects/workbench/files-on-disk.md) and hands off design context via 'isocan design craft <request> --out <dir>' and designWorkflowProcedure (design-workflow.ts:18-20, 88-90), where the coding agent in the repo inspects actual component source, token/CSS files, and package configuration directly. Storing AST node or code symbol pointers in core item schemas would go stale on every refactor across arbitrary languages and frameworks; same calibration as declined lack-of-design-to-code-jsx-tailwind-export-pipeline.

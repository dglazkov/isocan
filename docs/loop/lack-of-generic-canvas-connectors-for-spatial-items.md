---
title: Lack of generic canvas connectors for spatial items
loop:
  - dd810989-d114-4d04-b4a0-c4b1a4725e96
loop_rank: P2
loop_state: DISMISSED
loop_goal: What canvas tools teach us
decision: declined
rank: never
project: mindmap
since: 2026-09-29
note: Real arrows exist in the mindmap and wireframe modules only. Worth scheduling only if a use beyond maps and flows appears; none has. Reopen with a named one.
---

# Lack of generic canvas connectors for spatial items

> **Loop says** (P2): isocan currently restricts arrows and connections to specialized sub-modules rather than offering a generic canvas connector primitive. Wireframe flow linkages only route between wireframe screen hotspot IDs, freehand ink strokes carry no item attachment semantics, and Mermaid diagrams render static baked SVGs. Consequently, humans and agents cannot visually connect text notes, wireframe cards, user stories, or sandbox outputs across arbitrary canvas locations.

- `packages/modules/wireframe/src/arrows.tsx`
- `packages/core/src/drawing.ts`

## Our read

Verified across all three modules cited: packages/modules/wireframe/src/arrows.tsx routes flow arrows between wireframe hotspot ids; packages/modules/mindmap (docs/projects/mindmap/design.md) draws draggable links between mindmap nodes; and packages/modules/mermaid/src/diagram.tsx renders Mermaid source to a sandboxed SVG string via mermaid.render with securityLevel: "strict". Freehand ink attachments do exist via packages/core/src/annotation.ts (the annotates prop binds a drawing to an item and fractional sub-region). Adding a fourth generic connector primitive was explicitly rejected in docs/projects/mindmap/design.md to keep the operation vocabulary small.

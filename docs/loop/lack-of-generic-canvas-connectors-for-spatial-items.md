---
title: "Lack of generic canvas connectors for spatial items"
loop: dd810989-d114-4d04-b4a0-c4b1a4725e96
loop_rank: P2
loop_state: DISMISSED
loop_goal: "What canvas tools teach us"
decision: declined
rank: never
project: mindmap
since: 2026-09-29
note: "Real arrows exist in the mindmap and wireframe modules only. Worth scheduling only if a use beyond maps and flows appears; none has. Reopen with a named one."
---

# Lack of generic canvas connectors for spatial items

> **Loop says** (P2): isocan currently restricts arrows and connections to specialized sub-modules rather than offering a generic canvas connector primitive. Wireframe flow linkages only route between wireframe screen hotspot IDs, freehand ink strokes carry no item attachment semantics, and Mermaid diagrams render static baked SVGs. Consequently, humans and agents cannot visually connect text notes, wireframe cards, user stories, or sandbox outputs across arbitrary canvas locations.

- `packages/modules/wireframe/src/arrows.tsx`
- `packages/core/src/drawing.ts`

## Our read

Wireframe arrows.tsx routes only between hotspot ids, and the mindmap module (docs/projects/mindmap/design.md) already draws draggable links between text nodes as real items. Drawings are ink items; an annotation (core/annotation.ts) binds ink to one item via the annotates prop, so item-attached ink exists, contradicting the ink-carries-no-attachment claim. A generic connector op would spend the op vocabulary the mindmap doc says is guarded. I did not check the Mermaid claim.

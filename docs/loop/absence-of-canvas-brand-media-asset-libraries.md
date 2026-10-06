---
title: Absence of canvas brand media asset libraries
loop:
  - 154d9797-8789-4f47-ad98-7ca8d5d53470
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: untriaged
---

# Absence of canvas brand media asset libraries

> **Loop says** (P2): The canvas core media module handles file blobs through MIME mappings and default size heuristics without maintaining an indexed asset library. The canvas state model tracks item versions as raw blob hashes rather than cataloged brand assets or iconography collections. Wireframe catalog renderers fall back to hardcoded unicode glyphs and generic placeholders because no asset library registry exists for human or AI co-design.

- `packages/core/src/media.ts#L29-L48`
- `packages/core/src/model.ts#L182-L234`
- `packages/modules/wireframe/src/catalog/draw.ts#L42-L71`

## Our read

Not yet checked against the code.

---
title: Absence of canvas brand media asset libraries
loop:
  - 154d9797-8789-4f47-ad98-7ca8d5d53470
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: declined
rank: never
since: 2026-10-07
note: "By design and unrequested: packages/core/src/media.ts:29-48 maps extensions to MIME types for content-addressed ItemVersion blobs (packages/core/src/model.ts:228), while wireframe glyphs and crossed-box placeholders in packages/modules/wireframe/src/catalog/draw.ts:42-71 are intentional IDEO-style low-fi marks."
---

# Absence of canvas brand media asset libraries

> **Loop says** (P2): The canvas core media module handles file blobs through MIME mappings and default size heuristics without maintaining an indexed asset library. The canvas state model tracks item versions as raw blob hashes rather than cataloged brand assets or iconography collections. Wireframe catalog renderers fall back to hardcoded unicode glyphs and generic placeholders because no asset library registry exists for human or AI co-design.

- `packages/core/src/media.ts#L29-L48`
- `packages/core/src/model.ts#L182-L234`
- `packages/modules/wireframe/src/catalog/draw.ts#L42-L71`

## Our read

Checked packages/core/src/media.ts:29-48, packages/core/src/model.ts:182-234, and packages/modules/wireframe/src/catalog/draw.ts:42-71. media.ts maps file extensions to MIME types and default dimensions; model.ts stores content-addressed blobHash entries on Item.versions; and draw.ts:42-71 deliberately renders greyscale Unicode glyphs (GLYPHS) and crossed-box img() placeholders so wireframes stay low-fi (draw.ts:4-16). Reusable component symbols are tracked separately in docs/loop/lack-of-reusable-component-symbol-library-instantiation.md:1-24, while a brand media/icon asset registry is unrequested.

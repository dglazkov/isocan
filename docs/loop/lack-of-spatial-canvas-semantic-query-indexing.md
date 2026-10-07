---
title: Lack of spatial canvas semantic query indexing
loop:
  - b81d2688-c8a1-433b-a9bf-47a51dc40527
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: declined
rank: never
since: 2026-10-07
note: "By design: canvases hold tens to hundreds of items in memory where linear scans in area.ts:90-140, canvassort.ts:76-83, and canvasswitch.ts:63-98 are sub-millisecond, design requests match canonical IDs by policy (design-request-reader.ts:14,76-79), and agents scope reads by group or root item IDs (canvas-context.ts:9-15)."
---

# Lack of spatial canvas semantic query indexing

> **Loop says** (P2): isocan uses brute-force linear filtering and basic substring or character matching across canvas items without spatial bounding indexes or semantic vector embeddings. Spatial membership checks in area calculations iterate over every item in memory, while canvas sorting and switching rely on basic string searches. Design request selection filters strictly on explicit property identities rather than spatial bounds or natural language design intent. Consequently, users and agents cannot query items by bounding region or semantic intent, forcing full canvas downloads that inflate token costs.

- `packages/core/src/area.ts#L90-L140`
- `packages/core/src/canvassort.ts#L76-L83`
- `packages/core/src/canvasswitch.ts#L63-L98`
- `packages/api/src/design-request-reader.ts#L76-L79`

## Our read

The cited functions perform in-memory linear scans by design: areasOf, inArea, itemsIn, areaOf, and findArea (packages/core/src/area.ts:90-140) iterate Object.values(canvas.items); filterCanvases (packages/core/src/canvassort.ts:76-83) checks case-insensitive space-separated terms across title and description; fuzzyMatch (packages/core/src/canvasswitch.ts:63-98) scores ordered character and word-start matches for the quick switcher; and matches (packages/api/src/design-request-reader.ts:76-79) filters design requests by canonical requestId, outputItemId, threadId, and commentId as stated at packages/api/src/design-request-reader.ts:14 ('Request selection uses canonical identities; neither client scans arbitrary JSON artifacts'). At canvas scale (tens to a few hundred items), in-memory linear iteration takes microseconds, and agents avoid full-canvas downloads by scoping context reads to a group or explicit root item IDs via ContextReadOptions (packages/api/src/canvas-context.ts:9-15).

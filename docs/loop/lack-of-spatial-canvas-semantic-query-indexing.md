---
title: "Lack of spatial canvas semantic query indexing"
loop: b81d2688-c8a1-433b-a9bf-47a51dc40527
loop_rank: P2
loop_state: ACTIVE
loop_goal: "What canvas tools teach us"
decision: untriaged
---

# Lack of spatial canvas semantic query indexing

> **Loop says** (P2): isocan uses brute-force linear filtering and basic substring or character matching across canvas items without spatial bounding indexes or semantic vector embeddings. Spatial membership checks in area calculations iterate over every item in memory, while canvas sorting and switching rely on basic string searches. Design request selection filters strictly on explicit property identities rather than spatial bounds or natural language design intent. Consequently, users and agents cannot query items by bounding region or semantic intent, forcing full canvas downloads that inflate token costs.

- `packages/core/src/area.ts#L90-L140`
- `packages/core/src/canvassort.ts#L76-L83`
- `packages/core/src/canvasswitch.ts#L63-L98`
- `packages/api/src/design-request-reader.ts#L76-L79`

## Our read

Not yet checked against the code.

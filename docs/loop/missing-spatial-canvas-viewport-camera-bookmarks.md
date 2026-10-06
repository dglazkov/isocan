---
title: Missing spatial canvas viewport camera bookmarks
loop:
  - 6eef2d95-6bfd-4d79-82ec-b278730b13f9
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: untriaged
---

# Missing spatial canvas viewport camera bookmarks

> **Loop says** (P2): Canvas address routing supports canvas routes and single item routes, but lacks constructs for named viewport camera bookmarks. Core data models store item bounding boxes and thread pin coordinates without models for saved camera focus positions or presentation frames. Web viewport utilities and routing manage camera transforms in local component state without persistent bookmark coordinates.

- `packages/core/src/address.ts#L29-L168`
- `packages/core/src/model.ts#L53-L418`
- `packages/web/src/lib/viewport.ts#L4-L165`
- `packages/web/src/App.tsx#L148-L177`

## Our read

Not yet checked against the code.

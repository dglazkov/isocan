---
title: Occluded stack cards render live document thumbnails
loop:
  - 8a662d6f-f693-4539-ab4c-221bfa553573
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: untriaged
---

# Occluded stack cards render live document thumbnails

> **Loop says** (P2): Group stacks instantiate live document renderers for all stacked items including background cards occluded by the top card. Because stacked cards share a canvas bounding area, viewport visibility checks evaluate to true for every card in the pile. Non-image background cards execute live sub-document rendering simultaneously, generating unnecessary main-thread overhead and memory consumption.

- `packages/web/src/components/GroupStack.tsx#L129-L146`
- `packages/web/src/components/ItemThumb.tsx#L57-L106`
- `packages/web/src/lib/onscreen.ts#L52-L123`

## Our read

Not yet checked against the code.

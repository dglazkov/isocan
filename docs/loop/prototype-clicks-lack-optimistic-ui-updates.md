---
title: Prototype clicks lack optimistic UI updates
loop:
  - de4dedfa-5b43-4a32-b8b1-5dd6a9f43bf0
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: untriaged
---

# Prototype clicks lack optimistic UI updates

> **Loop says** (P2): Clicking dead-end links inside interactive prototype frames dispatches network operations directly to the server without optimistic local updates. Frame click messages trigger sendPrototypeClick which awaits network confirmation before showing comment thread feedback. This creates perceptible input lag during interactive prototype navigation.

- `packages/web/src/lib/prototypeclick.ts#L10-L14`
- `packages/web/src/components/ItemView.tsx#L24-L35`

## Our read

Not yet checked against the code.

---
title: Web UI chat drafts bypass local replica state
loop:
  - 47be75c2-94cc-47b6-81dd-87225cff6919
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: untriaged
---

# Web UI chat drafts bypass local replica state

> **Loop says** (P2): The web interface holds unsubmitted message drafts in an ephemeral Zustand store. The store partitions drafts by canvas and actor ID in memory only. It does not save draft state to LocalStorage, IndexedDB, or local replica storage. Consequently, closing or reloading the browser discards unsent message content.

- `packages/web/src/lib/chatdraft.ts#L5-L8`
- `packages/web/src/lib/replica.ts#L41-L52`
- `packages/web/src/components/MainThreadPanel.tsx#L421-L423`

## Our read

Not yet checked against the code.

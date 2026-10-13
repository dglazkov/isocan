---
title: Minimized chat bar reconciles hidden message components
loop:
  - b576f5db-669d-4805-8631-76396a559181
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: untriaged
---

# Minimized chat bar reconciles hidden message components

> **Loop says** (P2): When minimized at the canvas bottom, CSS rules hide the Chat bar message list while React keeps the entire thread component tree mounted. Canvas operations and comment updates trigger Virtual DOM reconciliation across all hidden comments, markdown parsers, item cards, thumbnails, and gate grants. In contrast, closing the left docked Chat panel unmounts the panel entirely and eliminates background reconciliation overhead.

- `packages/web/src/components/ChatBar.tsx#L149`
- `packages/web/src/components/chat-bar.css#L31`
- `packages/web/src/components/MainThreadPanel.tsx#L611-L697`
- `packages/web/src/components/MainThreadPanel.tsx#L258`

## Our read

Not yet checked against the code.

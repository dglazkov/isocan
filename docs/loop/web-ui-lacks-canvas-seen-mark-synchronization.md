---
title: Web UI lacks canvas seen mark synchronization
loop:
  - 29f09351-3265-4aff-8681-81eebd251433
loop_rank: P2
loop_state: ACTIVE
loop_goal: Always isomorphic
decision: untriaged
---

# Web UI lacks canvas seen mark synchronization

> **Loop says** (P2): The CLI allows users to update canvas read watermarks on the daemon via isocan seen --mark. The daemon exposes the /api/seen endpoint to track canvas read state across sessions. In contrast, the Web UI stores thread read marks exclusively in local browser storage. The Web UI lacks a mechanism to invoke /api/seen and synchronize canvas seen marks with the daemon.

- `packages/cli/src/main.ts#L9488-L9509`
- `packages/server/src/operator-routes.ts`
- `packages/web/src/stores/unreadStore.ts#L46-L76`

## Our read

Not yet checked against the code.

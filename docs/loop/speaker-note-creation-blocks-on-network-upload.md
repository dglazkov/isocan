---
title: "Speaker note creation blocks on network upload"
loop: 3d625656-57c6-41e1-b9f7-060572a57225
loop_rank: P2
loop_state: ACTIVE
loop_goal: "Fast everywhere, local-first"
decision: untriaged
---

# Speaker note creation blocks on network upload

> **Loop says** (P2): Creating a slide speaker note executes a synchronous network upload before dispatching the item creation request. Slow network connections delay speaker note placement until the HTTP upload completes.

- `packages/web/src/lib/notes.ts#L13-L32`

## Our read

Not yet checked against the code.

---
title: "Model key management lacks optimistic UI updates"
loop: 7fdf1dbb-8a02-471e-9d77-dc852d9fee10
loop_rank: P2
loop_state: ACTIVE
loop_goal: "Fast everywhere, local-first"
decision: untriaged
---

# Model key management lacks optimistic UI updates

> **Loop says** (P2): Updating provider keys or toggling key sharing settings in the model keys dialog blocks on synchronous network roundtrips before updating interface state. The component sets loading flags and awaits full server requests and listing refetches without applying optimistic client state changes. Any network delay causes checkbox toggles and action buttons to feel sluggish and unresponsive.

- `packages/web/src/components/KeysDialog.tsx#L101-L113`
- `packages/web/src/components/KeysDialog.tsx#L68-L79`

## Our read

Not yet checked against the code.

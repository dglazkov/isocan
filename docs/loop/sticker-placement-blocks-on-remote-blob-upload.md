---
title: "Sticker placement blocks on remote blob upload"
loop: f9687e4a-bd86-4b2e-987c-b383806c1a62
loop_rank: P2
loop_state: ACTIVE
loop_goal: "Fast everywhere, local-first"
decision: untriaged
---

# Sticker placement blocks on remote blob upload

> **Loop says** (P2): Sticker inspector selection and drag-and-drop canvas placement execute remote HTTP blob uploads before dispatching canvas operations. Both the inspector click handler and the drag drop handler await host.putBlob before sending item.addVersion or returning item.add operations. Network upload latency directly delays canvas rendering feedback and prevents offline sticker placement.

- `packages/modules/stickers/src/web.tsx#L129-L141`
- `packages/modules/stickers/src/web.tsx#L165-L172`

## Our read

Not yet checked against the code.

---
title: "Design competition arena creation awaits network uploads"
loop: 5ac400aa-1c19-4937-9180-998e150cd830
loop_rank: P2
loop_state: ACTIVE
loop_goal: "Fast everywhere, local-first"
decision: untriaged
---

# Design competition arena creation awaits network uploads

> **Loop says** (P2): Laying out a design competition arena fetches fighter assets and sequentially awaits multiple remote HTTP uploads. The UI dispatches canvas operations created by arena plan after all blob uploads finish. Synchronous network operations block local arena creation and cause interface delays.

- `packages/modules/design-competition/src/web.tsx#L174-L215`

## Our read

Not yet checked against the code.

---
title: "Remote calls bypass local canvas replicas"
loop: 57e209c1-720c-4570-8370-e3b1b3da40aa
loop_rank: P2
loop_state: ACTIVE
loop_goal: "Fast everywhere, local-first"
decision: accepted
rank: later
project: multiuser
since: 2026-09-29
note: "Partly true: the canvas list and homes lookup need the network, though colours and names already fall back to derived values. Small polish that serves the local-first priority; do it with the next offline pass."
---

# Remote calls bypass local canvas replicas

> **Loop says** (P2): When configured with a remote home, canvas listing and switching bypass local IndexedDB replicas and issue network REST calls. Similarly, startup routines send HTTP requests for actor colors and names directly to the remote origin. These remote calls fail or stall when the remote home is slow or offline.

- `packages/web/src/pages/CanvasListPage.tsx#L126-L150`
- `packages/web/src/lib/homes.ts#L75-L93`
- `packages/web/src/lib/colors.ts#L46-L52`
- `packages/web/src/lib/names.ts#L60-L66`
- `packages/web/src/main.tsx#L35-L36`

## Our read

main.tsx:35-36 fires loadActorColors and loadActorNames void and both catch, falling back to derived colors and stamped names (colors.ts:46-52, names.ts:60-66), so a slow home stalls nothing. useCanvasHome (homes.ts:75-93) fails open to state here. CanvasListPage refresh uses Promise.all with listCanvases and turns failure into a listError with an empty list; there is no cached list, so offline the list page is empty. Only that last part is real.

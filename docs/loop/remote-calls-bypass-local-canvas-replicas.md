---
title: "Remote calls bypass local canvas replicas"
loop: 57e209c1-720c-4570-8370-e3b1b3da40aa
loop_rank: P2
loop_state: ACTIVE
loop_goal: "Fast everywhere, local-first"
decision: done
rank: next
project: multiuser
since: 2026-09-30
note: "done 2026-09-29: CanvasListPage.refresh falls back to recentCanvases(readRecents()) when listCanvases() fails offline instead of wiping the list (canvaslist.test.ts)"
---

# Remote calls bypass local canvas replicas

> **Loop says** (P2): When configured with a remote home, canvas listing and switching bypass local IndexedDB replicas and issue network REST calls. Similarly, startup routines send HTTP requests for actor colors and names directly to the remote origin. These remote calls fail or stall when the remote home is slow or offline.

- `packages/web/src/pages/CanvasListPage.tsx#L126-L150`
- `packages/web/src/lib/homes.ts#L75-L93`
- `packages/web/src/lib/colors.ts#L46-L52`
- `packages/web/src/lib/names.ts#L60-L66`
- `packages/web/src/main.tsx#L35-L36`

## Our read

**Verified and fixed against the code (2026-09-29):**

- `packages/web/src/pages/CanvasListPage.tsx` (`refresh`) now falls back to `recentCanvases()` (`packages/web/src/lib/recents.ts`, shared with `CommandPalette.tsx`) when `api.listCanvases()` fails offline instead of wiping the list with `setCanvases([])` (`packages/web/test/canvaslist.test.ts`).
- `CommandPalette.tsx` and `CanvasPage.tsx` (`bootFromReplica`) already fell back to `readRecents()` and the IndexedDB replica (`packages/web/src/lib/replica.ts`).

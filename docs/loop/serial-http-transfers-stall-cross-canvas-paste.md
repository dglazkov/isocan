---
title: "Serial HTTP transfers stall cross canvas paste"
loop: 7b9be7e9-aad9-4b63-a547-a1df2b51fd86
loop_rank: P2
loop_state: DISMISSED
loop_goal: "Fast everywhere, local-first"
decision: declined
rank: never
project: new
since: 2026-09-30
note: "True: cross-canvas paste awaits readBlob, uploadBlob and the item op one item at a time (clipboard.ts:79-83, 106-160). Same shape and same answer as the declined serial-http-uploads finding: a small optimisation on a rare gesture. Reopen with a measured stall on a many-item cross-canvas paste."
---

# Serial HTTP transfers stall cross canvas paste

> **Loop says** (P2): Cross-canvas paste in pasteInto processes items sequentially within for-of loops. For each item, the function awaits individual readBlob, uploadBlob, and sendCreatedItem HTTP requests before proceeding to the next item. Multi-item cross-canvas paste operations stall on network round-trips proportional to the item count, delaying canvas updates and user feedback.

- `packages/web/src/lib/clipboard.ts#L79-L84`
- `packages/web/src/lib/clipboard.ts#L106-L161`

## Our read

Both branches of pasteInto (packages/web/src/lib/clipboard.ts) are serial. In a groups canvas, :79-83 awaits transfer() (readBlob then uploadBlob, :71-76) per item and per visual face before one group.change at :85; the wait-for-all is deliberate (:77-78, a missing child must not leave a partial group), but the transfers themselves could run concurrently, with the dedupe map holding promises instead of hashes. In a legacy canvas, :106-160 awaits readBlob, uploadBlob and sendCreatedItem (packages/web/src/lib/groupplacement.ts:24-37) per item, so items land one by one in placement order. Only cross-canvas paste pays the blob cost; a same-canvas paste reuses blob hashes (:109-110) and costs one op per item. This is the same pattern as docs/loop/serial-http-uploads-stall-multi-file-drop-processing.md, which was declined 29 Sep as a small optimisation to reopen on a measured stall; cross-canvas paste is a rarer gesture than a multi-file drop, so the same ruling applies. The fix, if a stall is measured: Promise.all the byte transfers with a small concurrency cap, then send the ops in placement order (legacy) or the one group.change (groups), keeping skip-and-count at :125-128 and :162-166.

---
title: "Serial HTTP uploads stall multi-file drop processing"
loop: f6d2b4c2-1e5c-4171-be94-b8323780b77e
loop_rank: P2
loop_state: DISMISSED
loop_goal: "Fast everywhere, local-first"
decision: declined
rank: never
project: new
since: 2026-09-29
note: "By design: files upload one at a time before their item is created (upload.ts:145-175) so rows place in order. Parallel upload is a small optimisation. Reopen with a measured stall on a large multi-file drop."
---

# Serial HTTP uploads stall multi-file drop processing

> **Loop says** (P2): The file drop handler processes multiple dropped files sequentially in a loop, awaiting individual HTTP upload responses before creating canvas items. Dropping multiple files or media assets blocks canvas item instantiation until all network requests complete sequentially.

- `packages/web/src/lib/upload.ts#L145-L160`
- `packages/web/src/components/CanvasViewport.tsx#L1104`

## Our read

packages/web/src/lib/upload.ts:145-175 loops files, awaits uploadBlob then measure then sendCreatedItem per file, so item 2 appears only after item 1 uploaded. Ordering keeps offsetX row placement deterministic (comment above at ~L130-145). Items are created per file, not after all uploads, so blocking is per-file, not all-at-once as Loop says. Uploads could be started with Promise.all and items created in order; not done. Real but small; I did not measure large drops.

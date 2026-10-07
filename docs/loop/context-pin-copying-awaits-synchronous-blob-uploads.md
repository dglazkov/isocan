---
title: Context pin copying awaits synchronous blob uploads
loop:
  - 606aa4d9-4fa4-4a6b-94b8-173e234fffe8
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: proposed
rank: never
since: 2026-10-07
note: "By design: cross-canvas context pinning in packages/api/src/context-pin.ts:149-179 must verify live source admission, transfer blobs via packages/web/src/lib/context-pin.ts:28-33 (packages/web/src/lib/api.ts:769-796), and re-verify the inheritance link (line 175) before committing group.change so the destination never references un-uploaded bytes."
---

# Context pin copying awaits synchronous blob uploads

> **Loop says** (P2): Copying pinned context sources across canvases needs synchronous HTTP blob uploads before submitting group change operations. When the network is slow or offline, blob upload requests throw errors and fail the context pin operation. This prevents local-first copying and blocks context pin creation on network round-trips.

- `packages/web/src/lib/context-pin.ts#L28-L42`
- `packages/api/src/context-pin.ts#L171`
- `packages/web/src/lib/api.ts#L769-L796`

## Our read

Checked packages/web/src/lib/context-pin.ts:24-43, packages/api/src/context-pin.ts:144-180, and packages/web/src/lib/api.ts:769-796. pinFromSource (packages/api/src/context-pin.ts:144-180) copies a pinned piece across canvases from an inherited source canvas, which inherently requires live network access to classify the source, read its snapshot (line 152), download source blobs and upload them to the destination (line 171 via packages/web/src/lib/context-pin.ts:28-33), and re-verify the memory link (line 175) before submitting group.change (line 178) so the destination canvas never commits item versions pointing at missing blob hashes.

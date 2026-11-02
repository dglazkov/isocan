---
title: Serial blob uploads stall copy variant generation
loop:
  - 78c25c4e-a2fe-4939-b38f-50980cce5e34
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: declined
rank: never
project: copy-edit
since: 2026-10-07
note: "True mechanism, small optimisation: varycopy.ts:95-119 and main.ts:8459-8480 upload variant blobs sequentially after one batched LLM call, for N=3 by default. Same shape as declined serial-http-uploads; reopen if copy variant generation stalls on blob upload."
---

# Serial blob uploads stall copy variant generation

> **Loop says** (P2): The vary copy handler iterates through generated variants sequentially. It awaits synchronous HTTP blob uploads for each variant before creating canvas operations. For N requested variants with visual faces, this executes up to 2N serial network roundtrips before dispatching operations. This sequential network bottleneck causes input latency proportional to variant count, violating local-first responsiveness goals.

- `packages/web/src/lib/varycopy.ts#L95-L121`
- `packages/cli/src/main.ts#L8459-L8480`

## Our read

Verified in packages/web/src/lib/varycopy.ts:95-119 (varyCopy) and packages/cli/src/main.ts:8459-8480 (isocan copy vary): after a single LLM call generates all N variants (default 3, max 6), the loop sequentially awaits host.putBlob / ctx.client.uploadBlob for each variant's HTML (and visual face when distinct at varycopy.ts:108) before sending the batch via host.send(ops, newGroupId()) at varycopy.ts:121 or sequential sendOp calls at main.ts:8480. Because N is small (typically 3) and dominated by the LLM generation call at varycopy.ts:85, parallelizing the 3-6 small HTML text uploads is a minor optimisation on an infrequent gesture, matching the declined serial-http-uploads-stall-multi-file-drop-processing and serial-http-transfers-stall-cross-canvas-paste precedents.

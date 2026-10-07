---
title: Serial Google Doc sync stalls canvas updates
loop:
  - 7def013d-973c-419e-abcb-0753ed1b9665
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: proposed
rank: never
project: new
since: 2026-10-07
note: "True mechanism, small optimisation: gdoc sync iterates docs sequentially (main.ts:7166-7201) with a Drive modifiedTime pre-check that skips unchanged docs before downloading or uploading. Reopen if a canvas with many simultaneously edited Google Docs shows a measured CLI stall."
---

# Serial Google Doc sync stalls canvas updates

> **Loop says** (P2): The Google Doc CLI synchronization handler processes canvas documents sequentially in a single loop. Each document executes serial network calls for Drive metadata check, document content retrieval, blob storage upload, and operation dispatch. Network latency accumulates linearly with document count, causing CLI execution stalls when synchronizing canvases with multiple Google Docs.

- `packages/cli/src/main.ts#L7166-L7200`

## Our read

Verified in packages/cli/src/main.ts:7166-7201 (isocan gdoc sync): the for-of loop iterates over Google Doc items on the canvas sequentially. However, main.ts:7172-7176 first calls driveModifiedTime(id, token) and skips any document whose Drive modifiedTime is not newer than docSyncedAt(item) without fetching content or uploading a blob, and main.ts:7180-7183 skips sendOp when upload.blobHash matches current.blobHash. Full fetchGoogleDoc, uploadBlob, and sendOp roundtrips only run for docs that actually changed since the last sync. Parallelizing across docs is an unmeasured CLI optimisation; reopen if canvases with many concurrently modified Google Docs exhibit slow sync times.

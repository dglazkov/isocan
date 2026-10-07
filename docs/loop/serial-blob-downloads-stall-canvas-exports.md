---
title: Serial blob downloads stall canvas exports
loop:
  - 04adac2d-a1d8-49a7-b941-eeda8fa6859f
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: proposed
rank: never
since: 2026-10-07
note: "True mechanism, unmeasured: exportCanvases (export.ts:167-190) and exportItem (export.ts:246-259) await fetchBlob sequentially, though exportCanvases skips blobs already on disk by hash (export.ts:176-180); same ruling as serial-http-transfers-stall-cross-canvas-paste — reopen if a remote export shows a measured stall."
---

# Serial blob downloads stall canvas exports

> **Loop says** (P2): Canvas export operations sequentially download binary blobs over HTTP within loop constructs in the export API module. Exporting canvas archives fetches each version blob iteratively rather than concurrently, causing total download times to scale linearly with blob count. Similarly, item exports retrieve primary content blobs and visual faces in a serial loop, introducing cumulative network latency stalls during export workflows.

- `packages/api/src/export.ts#L182-L188`
- `packages/api/src/export.ts#L246-L258`

## Our read

In packages/api/src/export.ts:167-190, exportCanvases loops over named blobs sequentially: it first checks present(path.join(out, rel), meta.size) at :176-180 (skipping any content-addressed blob already on disk from a prior backup) and otherwise awaits fetchBlob(client, canvas.id, hash) at :182 and writeInto at :187 one blob at a time. In exportItem (packages/api/src/export.ts:246-259), the loop over item.versions awaits fetchBlob for version.blobHash at :247 and, when visual.blobHash differs (:254), awaits fetchBlob for visual.blobHash at :255. While bounded-concurrency fetching is possible, CLI export is an infrequent backup operation that commonly runs against the local loopback daemon and skips already-downloaded hashes; following the house precedent in docs/loop/serial-http-transfers-stall-cross-canvas-paste.md and docs/loop/serial-http-uploads-stall-multi-file-drop-processing.md, decline until a remote export stall is measured.

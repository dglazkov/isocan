---
title: Serial blob downloads stall canvas exports
loop:
  - 04adac2d-a1d8-49a7-b941-eeda8fa6859f
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: untriaged
---

# Serial blob downloads stall canvas exports

> **Loop says** (P2): Canvas export operations sequentially download binary blobs over HTTP within loop constructs in the export API module. Exporting canvas archives fetches each version blob iteratively rather than concurrently, causing total download times to scale linearly with blob count. Similarly, item exports retrieve primary content blobs and visual faces in a serial loop, introducing cumulative network latency stalls during export workflows.

- `packages/api/src/export.ts#L182-L188`
- `packages/api/src/export.ts#L246-L258`

## Our read

Not yet checked against the code.

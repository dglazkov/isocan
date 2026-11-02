---
title: Area creation awaits network blob upload
loop:
  - ea2b0f51-b6c8-4f0c-851d-11544ff656bb
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: declined
rank: never
since: 2026-10-07
note: "By design: packages/web/src/lib/api.ts:750-768 refuses general offline blob queueing with a clear OfflineError, and on group-mode canvases packages/web/src/lib/upload.ts:259-262 routes through changeCanvasGroup (packages/web/src/lib/canvasgroups.ts:30-35) which requires the authoritative home."
---

# Area creation awaits network blob upload

> **Loop says** (P2): Area creation executes a synchronous network upload before dispatching optimistic item creation operations. High network latency delays area sheet rendering until the HTTP upload request completes. Under offline network conditions, area creation fails immediately rather than staging the item locally.

- `packages/web/src/lib/upload.ts#L247-L274`
- `packages/web/src/lib/api.ts#L769-L801`

## Our read

Checked packages/web/src/lib/upload.ts:247-274, packages/web/src/lib/api.ts:750-801, and packages/web/src/lib/canvasgroups.ts:30-35. upload.ts:257 calls uploadBlob for the 1-byte newline area.md blob, and api.ts:750-768 explicitly documents why general blobs are not queued offline (throwing a specific OfflineError at api.ts:792-795 while only quick text notes and pen drawings stage locally via uploadOrStageTextBlob at upload.ts:440-457). Moreover, on group-mode canvases (upload.ts:255-262), addAreaItem delegates to changeCanvasGroup (canvasgroups.ts:30-35), which requires authoritative home confirmation.

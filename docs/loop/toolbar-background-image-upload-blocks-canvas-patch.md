---
title: Toolbar background image upload blocks canvas patch
loop:
  - 8c5cf4b7-71b7-439d-adf4-407dbd7b7d07
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: proposed
rank: never
project: multiuser
since: 2026-10-07
note: "By design: binary file uploads are explicitly not queued offline (api.ts:750-768), and Toolbar.tsx:245-273 uploads the chosen background image before sending project.update with its content hash."
---

# Toolbar background image upload blocks canvas patch

> **Loop says** (P2): Setting a canvas background image via the toolbar file input awaits synchronous HTTP blob uploads before dispatching project update operations. High network latency delays updating the canvas ground state until the file upload request completes. If the upload request fails, local state updates do not execute.

- `packages/web/src/components/Toolbar.tsx#L245-L273`

## Our read

Verified in packages/web/src/components/Toolbar.tsx:245-273 and packages/web/src/lib/api.ts:750-801: when a user picks a background image file (up to GROUND_MAX_BYTES = 5MB), Toolbar.tsx:261 awaits uploadBlob(canvas.id, file, file.name) and then dispatches sendEchoed(canvas.id, actor, { type: 'project.update', patch: groundPatch(up.blobHash) }) at lines 262-265. As documented in packages/web/src/lib/api.ts:750-768 ('Blobs are NOT queued offline, and the refusal is loud'), arbitrary binary files are not staged in IndexedDB to avoid quota/eviction failure modes and dangling blobHashes, and changing a canvas background image is a rare setup action.

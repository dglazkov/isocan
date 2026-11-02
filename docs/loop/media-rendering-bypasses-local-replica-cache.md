---
title: Media rendering bypasses local replica cache
loop:
  - b58408f2-f60e-4a13-ac00-3c23ad9599c1
loop_rank: P2
loop_state: DISMISSED
loop_goal: Fast everywhere, local-first
decision: declined
rank: never
project: multiuser
since: 2026-09-29
note: "By design: blob routes are credentialed and Cache-Control private, so the service worker never caches them. Offline media needs a per-badge cache and its own design first. Reopen with that design."
---

# Media rendering bypasses local replica cache

> **Loop says** (P2): Canvas components construct direct HTTP endpoints to fetch media assets from the remote daemon. The service worker explicitly bypasses all API routes to prevent credential leakage across browser tabs. The local IndexedDB replica persists canvas metadata and write queues but excludes blob binary data. Consequently, offline navigation or network loss leaves canvas images, drawings, and attachments unrendered despite available local item metadata.

- `packages/web/src/lib/api.ts#L1289-L1291`
- `packages/web/public/sw.js#L115`
- `packages/web/src/lib/replica.ts#L41-L52`
- `packages/web/src/components/ItemView.tsx#L1603-L1605`

## Our read

public/sw.js header comments (lines 40-60) state /api/* is never cached first thing per request because a per-origin cache is shared across tabs and personas and would reopen the phase 9 back gate; the blob bytes are also the quota risk. replica.ts StoredReplica holds project, canvas contents, seq and queue only, no blobs. Offline images would work only via a per-actor IndexedDB blob store, which is unscheduled; the loss is real but the omission is deliberate.

---
title: Model key management lacks optimistic UI updates
loop:
  - 7fdf1dbb-8a02-471e-9d77-dc852d9fee10
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: proposed
rank: never
project: keys
since: 2026-10-07
note: "By design: KeysDialog.tsx:68-113 awaits the daemon's authoritative KeysListing before showing a key as stored or spend-sharing as enabled, because credentials and spend consent must reflect what keys.json actually persisted."
---

# Model key management lacks optimistic UI updates

> **Loop says** (P2): Updating provider keys or toggling key sharing settings in the model keys dialog blocks on synchronous network roundtrips before updating interface state. The component sets loading flags and awaits full server requests and listing refetches without applying optimistic client state changes. Any network delay causes checkbox toggles and action buttons to feel sluggish and unresponsive.

- `packages/web/src/components/KeysDialog.tsx#L101-L113`
- `packages/web/src/components/KeysDialog.tsx#L68-L79`

## Our read

In packages/web/src/components/KeysDialog.tsx:68-79, act(provider, run) sets busy to provider, awaits the PUT or DELETE request to KEYS_ROUTE, and awaits load() (:50-62) to read back the authoritative KeysListing. Similarly, toggleShare (packages/web/src/components/KeysDialog.tsx:101-113) sets sharing to true, awaits request<KeysListing>('PUT', route, body), and updates share and agents from the server's response, as the comment at :100 notes ('the answer is the listing, so both read back from the file'). Because model keys and sharing toggles govern credential storage and real model spend on the home daemon (typically loopback HTTP, or refused via KEYS_NOT_HERE at :59 and res.refused at :55), waiting for the server's confirmation and masked last-four preview before flipping the UI is intentional.

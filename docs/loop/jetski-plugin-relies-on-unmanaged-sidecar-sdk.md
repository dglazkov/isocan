---
title: Jetski plugin relies on unmanaged sidecar SDK
loop:
  - ef4c72d0-5395-470a-b9e6-e2aeaf335d5f
loop_rank: P2
loop_state: ACTIVE
loop_goal: Dependencies healthy
decision: untriaged
---

# Jetski plugin relies on unmanaged sidecar SDK

> **Loop says** (P2): The Jetski plugin imports an external sidecar_sdk package without declaring it in its package manifest or workspace configuration. The release system explicitly bypasses validation for this missing dependency, expecting host runtime injection. Also, the plugin relies on shell-dependent lifecycle hooks that fail silently if host environment requirements are missing.

- `plugins/jetski/sidecars/canvas/main.mjs#L552-L556`
- `plugins/jetski/plugin.json#L1-L13`
- `scripts/release.mjs#L888-L891`
- `plugins/jetski/hooks.json#L2-L9`

## Our read

Not yet checked against the code.

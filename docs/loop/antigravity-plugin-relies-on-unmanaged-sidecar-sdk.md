---
title: Antigravity plugin relies on unmanaged sidecar SDK
loop:
  - ef4c72d0-5395-470a-b9e6-e2aeaf335d5f
loop_rank: P2
loop_state: ACTIVE
loop_goal: Dependencies healthy
decision: declined
rank: never
project: antigravity
since: 2026-10-07
note: "By design: sidecar_sdk is injected by the Antigravity host via NODE_PATH only when ANTIGRAVITY_LS_ADDRESS and ANTIGRAVITY_SIDECAR_WEB_PORT are set (plugins/antigravity/sidecars/canvas/main.mjs:552-556, scripts/release.mjs:892-895), and hooks.json:6 guards on node so non-Node environments never error."
---

# Antigravity plugin relies on unmanaged sidecar SDK

> **Loop says** (P2): The Antigravity plugin imports an external sidecar_sdk package without declaring it in its package manifest or workspace configuration. The release system explicitly bypasses validation for this missing dependency, expecting host runtime injection. Also, the plugin relies on shell-dependent lifecycle hooks that fail silently if host environment requirements are missing.

- `plugins/antigravity/sidecars/canvas/main.mjs#L552-L556`
- `plugins/antigravity/plugin.json#L1-L13`
- `scripts/release.mjs#L888-L891`
- `plugins/antigravity/hooks.json#L2-L9`

## Our read

Verified in plugins/antigravity/sidecars/canvas/main.mjs:552-556, scripts/release.mjs:892-895, plugins/antigravity/plugin.json:1-13, and plugins/antigravity/hooks.json:2-9 (plus docs/projects/antigravity/design.md:127-175): (1) sidecar_sdk is the internal Antigravity/Antigravity host SDK provided on NODE_PATH at runtime when the host spawns an AuxPane, not a public npm registry package; main.mjs:552-556 dynamically imports it only when ANTIGRAVITY_LS_ADDRESS and ANTIGRAVITY_SIDECAR_WEB_PORT are set, and otherwise falls back to its built-in standalone loopback HTTP server (main.mjs:557-565). scripts/release.mjs:892-895 documents and exempts this host-injected specifier. (2) hooks.json:6 uses 'if command -v node >/dev/null 2>&1; then exec node ./scripts/session-start.mjs; fi' intentionally (design.md:138-140) so a machine without node on Antigravity's PATH gets silence rather than failing every conversation.

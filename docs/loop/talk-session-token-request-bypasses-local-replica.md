---
title: Talk session token request bypasses local replica
loop:
  - 5bf98155-ca32-4b86-94a7-ee2224a73162
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: proposed
rank: never
project: voice-agent
since: 2026-10-07
note: "By design: Gemini Live voice sessions stream audio to Google's cloud WebSocket and require a live network connection, and POST /api/voice/token (packages/modules/talk/src/web.tsx:59, 722-733) intentionally keeps the Gemini API key on the home server out of browser storage."
---

# Talk session token request bypasses local replica

> **Loop says** (P2): Talk live session initialization makes a direct HTTP POST request to `/api/voice/token. When operating offline or through local daemons, the request fails without falling back to local replica credentials or offline modes.

- `packages/modules/talk/src/web.tsx`

## Our read

Verified in packages/modules/talk/src/web.tsx:47-60 and :710-733 (forgetBrowserKey, requestLiveToken) and :868-923 (start): a Talk session opens a real-time bidirectional WebSocket to Gemini Live (liveTokenUrl(token) at line 922), which cannot operate offline because the model itself is a remote cloud service, as noted in docs/projects/multiuser/phases.md:113-114 ('an agent cannot work with no network, because it cannot reach a model'). Furthermore, keys phase 4 explicitly removed browser-stored Gemini keys (forgetBrowserKey at lines 710-714, OLD_KEY_SHELF = 'isocan:voice:key' at line 52) so the browser never holds long-lived credentials and instead requests a one-use token from the canvas's home via LIVE_TOKEN_ROUTE ('/api/voice/token').

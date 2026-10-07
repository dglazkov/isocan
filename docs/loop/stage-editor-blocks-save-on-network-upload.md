---
title: Stage editor blocks save on network upload
loop:
  - cbeee0ba-c45b-4dec-9224-f77b96d3e705
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: proposed
rank: later
project: multiuser
since: 2026-10-07
note: "Partly true: StageEditor.save (StageEditor.tsx:236-280) keeps typing open in CodeMirror and persists drafts in localStorage, but calls uploadBlob instead of uploadOrStageTextBlob so offline ⌘S fails before reaching sendEchoedResult's queued path."
---

# Stage editor blocks save on network upload

> **Loop says** (P2): Saving document edits in StageEditor awaits a network HTTP upload before creating the new item version. The component sets an internal writing lock that blocks further draft saves until the network upload finishes. High network latency or connection failure stalls version creation and breaks local-first responsiveness.

- `packages/web/src/components/StageEditor.tsx#L247-L265`
- `packages/web/src/components/StageEditor.tsx#L240-L242`

## Our read

Verified in packages/web/src/components/StageEditor.tsx:236-280: writing.current (lines 240-241) only guards against concurrent save() invocations while the user can continue typing in the CodeMirror view (lines 286-288 preserve any newer typing as a dirty draft in localStorage). However, line 247 calls uploadBlob(canvasId, new Blob([doc], { type: source.mimeType }), source.filename) directly before calling sendEchoedResult at line 264. Although lines 265-266 handle receipt.status === 'queued', uploadBlob throws OfflineError when offline (packages/web/src/lib/api.ts:792), so offline saves fail in the catch block instead of staging the text blob via uploadOrStageTextBlob (packages/web/src/lib/upload.ts:440-457) like reviseTextNode does in packages/web/src/lib/text.ts:116-145.

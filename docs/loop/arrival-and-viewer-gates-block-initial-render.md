---
title: Arrival and viewer gates block initial render
loop:
  - e42ed041-a7d9-466d-b15c-743c706dcf46
loop_rank: P2
loop_state: DISMISSED
loop_goal: Fast everywhere, local-first
decision: declined
rank: never
project: first-minute
since: 2026-09-29
note: "By design: App.tsx shows Letting you in for one REST call so a name prompt never flashes, and the comment says so. Reopen if first-visit latency is measured and the gate is a meaningful share of it."
---

# Arrival and viewer gates block initial render

> **Loop says** (P2): Initial visits via pass share links or unauthenticated canvas URLs halt application rendering during startup. The application renders a plain text state while awaiting synchronous network REST calls to redeem passes or check canvas capabilities. First-time visitors experience noticeable render delay before seeing the canvas UI shell.

- `packages/web/src/App.tsx#L139`
- `packages/web/src/App.tsx#L314`
- `packages/web/src/lib/arrival.ts#L70-L75`
- `packages/web/src/lib/api.ts#L659`

## Our read

App.tsx:139 returns a page-note sentence while redeeming, and App.tsx:314 does the same while getSnapshot resolves, so the sentence covers the wait for one request. Comments there state the intent: avoid flashing the name prompt before a presentation. Routes and Navigation are lazy-loaded (App.tsx:46-65). No measurement of the delay is in the finding; an optimistic shell would need a rule for capability-dependent chrome.

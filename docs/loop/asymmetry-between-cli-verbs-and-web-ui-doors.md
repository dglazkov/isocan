---
title: "Asymmetry between CLI verbs and Web UI doors"
loop: 9f135820-b34a-40fa-b3b1-8df028bc5b1a
loop_rank: P2
loop_state: DISMISSED
loop_goal: "Always isomorphic"
decision: stale
rank: never
project: design-partner
since: 2026-09-29
note: "Stale: the cited recovery has a CLI counterpart through retry:true on design write files, and admin-only daemon verbs like serve and gc are plumbing by design. Reopen if a specific web-only act is named."
---

# Asymmetry between CLI verbs and Web UI doors

> **Loop says** (P2): The web application and CLI exhibit capability gaps where interactive features like draft recovery exist only in the web interface, while administrative daemon controls exist solely in the CLI. This asymmetry prevents users and agents from achieving parity across client interfaces.

- `packages/web/src/components/DesignComparisonRecovery.tsx`
- `packages/cli/src/main.ts`

## Our read

DesignComparisonRecovery.tsx replays a browser localStorage journal, which is browser state that an agent has no equivalent of by nature. The CLI side, design-system.ts:35 help text, tells agents to retain opId and versionId and set retry:true to recover the original receipt. surface.test.ts PLUMBING lists serve, stop, gc etc. as deliberately not agent verbs. Finding names no other concrete gap.

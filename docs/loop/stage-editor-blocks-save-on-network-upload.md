---
title: Stage editor blocks save on network upload
loop:
  - cbeee0ba-c45b-4dec-9224-f77b96d3e705
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: untriaged
---

# Stage editor blocks save on network upload

> **Loop says** (P2): Saving document edits in StageEditor awaits a network HTTP upload before creating the new item version. The component sets an internal writing lock that blocks further draft saves until the network upload finishes. High network latency or connection failure stalls version creation and breaks local-first responsiveness.

- `packages/web/src/components/StageEditor.tsx#L247-L265`
- `packages/web/src/components/StageEditor.tsx#L240-L242`

## Our read

Not yet checked against the code.

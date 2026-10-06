---
title: Web UI lacks design sprint facilitation controls
loop:
  - d07aea36-1262-4014-b0e7-4856d0002054
loop_rank: P2
loop_state: ACTIVE
loop_goal: Always isomorphic
decision: untriaged
---

# Web UI lacks design sprint facilitation controls

> **Loop says** (P2): The CLI provides complete commands for facilitators to manage design sprints. In contrast, the Web UI only provides clock rendering and participant actions. The Web UI lacks controls to start phases, lay sprint boards, mint sketcher desks, or end sprints. This creates a capability gap between the Web app and CLI clients.

- `packages/cli/src/main.ts#L10023-L10370`
- `packages/web/src/components/SprintChip.tsx#L1-L223`
- `packages/web/src/lib/sprint.ts#L113-L203`
- `README.md#L3-L6`

## Our read

Not yet checked against the code.

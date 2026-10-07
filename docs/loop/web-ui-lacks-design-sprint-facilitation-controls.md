---
title: Web UI lacks design sprint facilitation controls
loop:
  - d07aea36-1262-4014-b0e7-4856d0002054
loop_rank: P2
loop_state: ACTIVE
loop_goal: Always isomorphic
decision: proposed
rank: never
project: sprint
since: 2026-10-07
note: "By design and gated on Phase 6 human verification: web users start and advance sprints via /sprint in Chat while the enrolled facilitator agent lays the board and SprintChip shows the active phase's participant action."
---

# Web UI lacks design sprint facilitation controls

> **Loop says** (P2): The CLI provides complete commands for facilitators to manage design sprints. In contrast, the Web UI only provides clock rendering and participant actions. The Web UI lacks controls to start phases, lay sprint boards, mint sketcher desks, or end sprints. This creates a capability gap between the Web app and CLI clients.

- `packages/cli/src/main.ts#L10023-L10370`
- `packages/web/src/components/SprintChip.tsx#L1-L223`
- `packages/web/src/lib/sprint.ts#L113-L203`
- `README.md#L3-L6`

## Our read

packages/cli/src/main.ts:10023-10365 defines the CLI sprint subcommands, while packages/web/src/components/SprintChip.tsx:49-222 and packages/web/src/lib/sprint.ts:113-203 render the active phase banner, timer, and single participant button. As designed in docs/projects/sprint/journey.md:38-65 and packages/cli/src/main.ts:10151-10153, sprint state is derived from '/sprint <phase> [duration]' messages in the Chat thread and facilitated by an enrolled agent, and docs/projects/sprint/phases.md:63-64 blocks new sprint surface until the first human sprint walk.

---
title: CLI presentation mode lacks live stepping control
loop:
  - 624713f2-0ad7-43c0-98b7-1c301fcada2a
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# CLI presentation mode lacks live stepping control

> **Loop says** (P2): The Web UI provides interactive presentation controls, slide position counters, and speaker note views for live presentations. In contrast, the CLI provides static deck configuration, speaker note extraction, and file export via isocan slides and isocan present. The CLI lacks live presentation session controls to interactively step through slides or broadcast presentation state across clients.

- `packages/web/src/components/PhonePresenting.tsx#L29-L73`
- `packages/web/src/components/FullScreen.tsx#L116-L160`
- `packages/cli/src/main.ts#L9803-L10053`

## Our read

Not yet checked against the code.

---
title: CLI lacks prototype click delivery command
loop:
  - 27a4a5ca-3cc0-467b-bec0-dcb95a086f37
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: proposed
rank: never
project: wireframes
since: 2026-10-07
note: "By design: prototype clicks represent a human pressing a dead-end control in a rendered browser iframe (prototype-click.ts:9-19) to summon the publishing agent, and /api/ops refuses agent-originated clicks."
---

# CLI lacks prototype click delivery command

> **Loop says** (P2): The daemon supports prototype click operations to transmit user presses on HTML prototype elements to publishing agents. The Web UI delivers prototype clicks when users interact with rendered prototype controls. In contrast, the CLI provides no command or verb to send prototype click events to the daemon. This creates a capability divergence between web and CLI clients.

- `packages/core/src/prototype-click.ts#L9-L80`
- `packages/core/src/ops.ts#L70-L71`
- `packages/web/src/components/ItemView.tsx#L1780`
- `packages/cli/src/main.ts#L1-L100`

## Our read

Verified in packages/core/src/prototype-click.ts:9-19, packages/web/src/lib/prototypeclick.ts:5-14, and packages/web/src/components/ItemView.tsx:1779-1800: a prototype click is posted by a sandboxed browser iframe (`isocan:click`) when a human presses a dead-end control so the publishing agent is summoned on the item thread; the home explicitly refuses agent-originated prototype clicks, and agents read `comment.click` via `isocan wait` (packages/cli/src/agent-guide.md:79-82).

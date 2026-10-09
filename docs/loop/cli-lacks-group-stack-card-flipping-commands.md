---
title: CLI lacks group stack card flipping commands
loop:
  - 0753d03b-7b56-4a14-8857-e419e45fecdc
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# CLI lacks group stack card flipping commands

> **Loop says** (P2): The Web UI allows users to select a stacked group and flip through member cards using arrow keys or stack flip events. In contrast, the command-line client only offers a stack command with a spread option. The CLI provides no commands or flags to flip through stacked items or inspect member stack order.

- `packages/web/src/components/GroupStack.tsx#L40-L75`
- `packages/web/src/components/ItemView.tsx#L1-L100`
- `packages/cli/src/canvas-groups.ts#L153-L156`

## Our read

Not yet checked against the code.

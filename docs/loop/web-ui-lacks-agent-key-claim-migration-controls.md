---
title: Web UI lacks agent key claim migration controls
loop:
  - e08174b5-8cfd-49d0-a59d-a45a8a2042ba
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# Web UI lacks agent key claim migration controls

> **Loop says** (P2): The CLI provides mechanisms to migrate agent actor claims and derive machine-specific session keys. In contrast, the Web UI identity menu and dialog components contain no controls or actions for agent key rotation or claim migration. This obligates web users who manage autonomous agents to rely on terminal commands, violating client parity between Web UI and CLI.

- `packages/cli/src/agent-key.ts#L143-L171`
- `packages/cli/src/main.ts#L14055-L14059`
- `packages/web/src/components/IdentityMenu.tsx#L394-L458`
- `packages/web/src/components/IdentityDialog.tsx#L98-L150`

## Our read

Not yet checked against the code.

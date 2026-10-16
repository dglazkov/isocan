---
title: Web UI lacks git backup and remote sync controls
loop:
  - 2f8a5b4b-a401-4d01-9cdd-253e1b94f267
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# Web UI lacks git backup and remote sync controls

> **Loop says** (P2): The CLI provides the isocan export --commit and --git options to stage exported assets, create git commits, and push backups to remote repositories. In contrast, the Web UI export components provide file downloads but lack controls to execute git backup commits or configure remote synchronization. Web users cannot perform automated git backups or remote sync directly from the web interface.

- `packages/cli/src/backup-git.ts#L1-L120`
- `packages/web/src/components/DeckPrint.tsx`

## Our read

Not yet checked against the code.

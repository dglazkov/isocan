---
title: CLI group migration preview lacks dedicated command
loop:
  - e6393ba9-3853-4361-9835-18cb58a285fb
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# CLI group migration preview lacks dedicated command

> **Loop says** (P2): The web client provides group migration preview controls by querying the backend migration endpoint. In contrast, the CLI queries the migration preview report only when users pass `--dry-run` to the migration command. The CLI lacks a dedicated preview subcommand for inspecting migration readiness before applying schema conversions.

- `packages/web/src/lib/api.ts#L61-L66`
- `packages/web/src/components/GroupMigration.tsx#L50-L72`
- `packages/cli/src/canvas-groups.ts#L58-L73`
- `packages/cli/src/main.ts#L4997`

## Our read

Not yet checked against the code.

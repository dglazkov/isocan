---
title: Web UI lacks design recipe inspection interface
loop:
  - 6d59be27-a527-4d72-94fd-5c4b3d57bcf1
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# Web UI lacks design recipe inspection interface

> **Loop says** (P2): The command-line client provides commands to list runnable reference kits and inspect or export design system reference files. The Web UI contains no dialog, panel, or menu interface to browse design system recipes or export task templates. When CLI users can inspect design recipes while web users cannot browse or load reference kits, web clients lack parity with terminal controls.

- `packages/cli/src/design-system.ts#L84-L100`
- `packages/api/src/design-recipes/field-guide.ts#L1-L32`
- `packages/web/src/components/DesignSystemMenu.tsx#L1-L50`

## Our read

Not yet checked against the code.

---
title: Agent operations directly mutate active canvas state
loop:
  - afa49f92-4d47-43e7-a9b9-c8c1a6991c60
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: untriaged
---

# Agent operations directly mutate active canvas state

> **Loop says** (P2): Agent mutations apply directly to active canvas state without a pre-commit proposal buffer or trust tier gating review. Direct operations update the version stack immediately, leaving users unable to inspect or approve proposed changes before committing them. This gap degrades user trust and creates friction during human-agent co-design workflows.

- `packages/core/src/reducer.ts`
- `packages/core/src/ops.ts`
- `packages/api/src/design-workflow.ts`
- `packages/web/src/components/Workbench.tsx`
- `docs/loop/lack-of-agent-proposal-staging-overlays.md`

## Our read

Not yet checked against the code.

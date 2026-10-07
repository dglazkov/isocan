---
title: Agent operations directly mutate active canvas state
loop:
  - afa49f92-4d47-43e7-a9b9-c8c1a6991c60
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: declined
rank: never
since: 2026-10-07
note: "Duplicate of accepted finding docs/loop/lack-of-agent-proposal-staging-overlays.md:1-29: packages/core/src/reducer.ts:34-66 applies agent operations as version-stack entries with per-item undo and VersionCompare diffing, and pre-commit trust-tier gating is already tracked under that accepted finding."
---

# Agent operations directly mutate active canvas state

> **Loop says** (P2): Agent mutations apply directly to active canvas state without a pre-commit proposal buffer or trust tier gating review. Direct operations update the version stack immediately, leaving users unable to inspect or approve proposed changes before committing them. This gap degrades user trust and creates friction during human-agent co-design workflows.

- `packages/core/src/reducer.ts`
- `packages/core/src/ops.ts`
- `packages/api/src/design-workflow.ts`
- `packages/web/src/components/Workbench.tsx`
- `docs/loop/lack-of-agent-proposal-staging-overlays.md`

## Our read

Checked packages/core/src/reducer.ts:34-66, packages/core/src/ops.ts:234-342, packages/api/src/design-workflow.ts:45-70, packages/web/src/components/Workbench.tsx:208-238, and docs/loop/lack-of-agent-proposal-staging-overlays.md:1-29. As Loop's own citation of docs/loop/lack-of-agent-proposal-staging-overlays.md:19 shows, this is a duplicate of that already-accepted finding (rank: later, project: new): agent mutations apply through applyOperation in reducer.ts:34-66 onto the item version stack with one-step undo and retroactive VersionCompare diffing, and a trust tier that asks before writing is already tracked there.

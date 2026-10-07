---
title: Lack of spatial canvas voting consensus nodes
loop:
  - 58fdb202-b81e-4120-bc06-0a12288f4c1e
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: stale
rank: never
project: sprint
since: 2026-10-07
note: "Stale: spatial dot-voting on sketches with placed item.react coordinates, vote curtains, and tallies are already built in sprint.ts:30-35 and @isocan/design-competition."
---

# Lack of spatial canvas voting consensus nodes

> **Loop says** (P2): While the platform supports individual item emoji reactions and comment thread design decisions, it lacks dedicated spatial canvas voting session nodes and vote tally primitives. Human collaborators and AI agents cannot conduct structured dot-voting sessions or rank design options directly on the spatial canvas. Consequently, co-designers must rely on unstructured comment threads or generic emoji reactions without dedicated voting quotas or consensus visualization.

- `packages/core/src/ops.ts`
- `packages/core/src/model.ts`
- `packages/web/src/components/Reactions.tsx`

## Our read

Verified in packages/core/src/sprint.ts:30-35 and packages/cli/src/agent-guide.md:176: dot-voting is already built on `item.react` carrying spatial `{ x, y }` coordinates on sketches, hidden by the vote curtain during voting phases and tallied by `isocan sprint tally`, alongside exhibition voting in `@isocan/design-competition` and structured option decisions in packages/core/src/design-decision.ts:13-69.

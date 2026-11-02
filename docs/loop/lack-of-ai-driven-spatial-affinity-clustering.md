---
title: Lack of AI-driven spatial affinity clustering
loop:
  - 7d15680b-6934-4a03-ba45-9a1e314c14cb
loop_rank: P2
loop_state: DISMISSED
loop_goal: What canvas tools teach us
decision: declined
rank: never
project: canvas-groups
since: 2026-09-29
note: "A feature idea, not a defect, with no roadmap entry: nothing clusters by position or meaning today. Reopen as an agent-driven op once canvas-groups is settled and someone asks."
---

# Lack of AI-driven spatial affinity clustering

> **Loop says** (P2): Canvas spatial management depends entirely on manual rectangular bounding boxes and explicit coordinate checks. System context operations extract linear text lists without evaluating spatial positions or semantic text similarities. Consequently, design briefs and canvas group UI components cannot synthesize unstructured spatial notes into clustered thematic sections.

- `packages/core/src/canvas-groups.ts`
- `packages/core/src/design-brief.ts`
- `packages/api/src/context-summary.ts`
- `packages/web/src/components/CanvasGroupPanel.tsx`

## Our read

Verified in packages/core/src/canvas-groups.ts and packages/web/src/components/CanvasGroupPanel.tsx: groups model explicit spatial containment and grid cells, with no built-in semantic clustering algorithm. Agents already cluster notes on demand by reading the canvas via isocan context and placing or moving items into groups via the CLI, and the /affinity canvas skill encodes that workflow without adding a special-purpose clustering subsystem to core.

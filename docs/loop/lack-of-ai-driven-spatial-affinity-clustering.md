---
title: "Lack of AI-driven spatial affinity clustering"
loop: 7d15680b-6934-4a03-ba45-9a1e314c14cb
loop_rank: P2
loop_state: DISMISSED
loop_goal: "What canvas tools teach us"
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

canvas-groups.ts and CanvasGroupPanel.tsx deal with explicit group membership; no spatial or semantic clustering code exists, and grep of ROADMAP.md and projects README found no such plan. The claim that design briefs cannot synthesize notes is an observation about absence, not a bug. An agent can already do this by reading the canvas and creating groups through the CLI, which I did not exercise.

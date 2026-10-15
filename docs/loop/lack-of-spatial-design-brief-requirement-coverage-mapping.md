---
title: Lack of spatial design brief requirement coverage mapping
loop:
  - b293f165-cf28-4afb-a82b-bb36bad27000
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: untriaged
---

# Lack of spatial design brief requirement coverage mapping

> **Loop says** (P2): isocan ingests design briefs and generates wireframe screens but does not persist spatial coverage mappings between brief requirements and canvas items. Canvas state models omit requirement ID linkage fields, and stage viewports render items without visual brief requirement coverage indicators. As a result, human reviewers and AI agents cannot verify requirement fulfillment directly on the canvas.

- `packages/core/src/design-brief.ts`
- `packages/api/src/design-workflow.ts`
- `packages/core/src/model.ts`
- `packages/web/src/components/CanvasViewport.tsx`

## Our read

Not yet checked against the code.

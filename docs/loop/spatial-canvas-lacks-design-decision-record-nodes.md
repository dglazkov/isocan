---
title: Spatial canvas lacks design decision record nodes
loop:
  - 3a31e77a-2506-45aa-befd-8f94e946b687
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: untriaged
---

# Spatial canvas lacks design decision record nodes

> **Loop says** (P2): Spatial canvas design workflows store comparison evaluations and decision rationale inside comment threads rather than dedicated canvas nodes. The model schema restricts design record markers to briefs and receipts on item versions, offering no first-class spatial node schema for formal design decisions. The operation vocabulary lacks a dedicated spatial decision record mutation to anchor trade-off choices alongside wireframes on the canvas. As human-agent teams generate layout alternatives, burying rationale in comment threads degrades spatial visibility into why collaborators accept or reject specific directions.

- `packages/api/src/design-workflow.ts#L45-L70`
- `packages/core/src/ops.ts#L235-L240`
- `packages/core/src/model.ts#L113-L130`
- `packages/core/src/design-record.ts#L10-L11`
- `packages/core/src/model.ts#L239-L285`

## Our read

Not yet checked against the code.

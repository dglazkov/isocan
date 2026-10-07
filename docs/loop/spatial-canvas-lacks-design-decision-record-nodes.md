---
title: Spatial canvas lacks design decision record nodes
loop:
  - 3a31e77a-2506-45aa-befd-8f94e946b687
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: proposed
rank: never
project: design-partner
since: 2026-10-07
note: "By design: comparisons, responses, and adoption decisions live on canonical writer-minted comment records (model.ts:245, design-decision.ts:66-69) surfaced in DesignTaskPanel and the inspector rather than as separate spatial cards."
---

# Spatial canvas lacks design decision record nodes

> **Loop says** (P2): Spatial canvas design workflows store comparison evaluations and decision rationale inside comment threads rather than dedicated canvas nodes. The model schema restricts design record markers to briefs and receipts on item versions, offering no first-class spatial node schema for formal design decisions. The operation vocabulary lacks a dedicated spatial decision record mutation to anchor trade-off choices alongside wireframes on the canvas. As human-agent teams generate layout alternatives, burying rationale in comment threads degrades spatial visibility into why collaborators accept or reject specific directions.

- `packages/api/src/design-workflow.ts#L45-L70`
- `packages/core/src/ops.ts#L235-L240`
- `packages/core/src/model.ts#L113-L130`
- `packages/core/src/design-record.ts#L10-L11`
- `packages/core/src/model.ts#L239-L285`

## Our read

Verified in packages/core/src/model.ts:113-130 (ItemVersion.designRecord), packages/core/src/design-record.ts:10-13 (DesignRecordMarker with kind 'brief' | 'receipt'), packages/core/src/ops.ts:235-240 (design.compare, design.respond, design.decide, design.restore, design.request, design.receipt), packages/core/src/model.ts:240-249 (Comment.designDecision), and packages/api/src/design-workflow.ts:45-70: briefs and receipts are stored as item versions with DesignRecordMarker, while comparisons and adoption decisions are stored as writer-minted DesignDecisionComment records on comments and projected via readDesignDecisions (/api/projects/:id/design/decisions in packages/core/src/design-decision.ts:94-104) into DesignTaskPanel.tsx:14-47 (which renders in chat, inspector, and disclosure presentations). Keeping decision records attached to the conversation thread and target item inspector rather than spawning extra spatial canvas cards for every comparison is an intentional design choice.

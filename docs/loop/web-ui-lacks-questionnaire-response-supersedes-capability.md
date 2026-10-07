---
title: Web UI lacks questionnaire response supersedes capability
loop:
  - 00a2a9b7-2765-4e5f-84f8-38ca7a9279b9
loop_rank: P2
loop_state: ACTIVE
loop_goal: Always isomorphic
decision: proposed
rank: never
project: design-partner
since: 2026-10-07
note: "By design and gated on Phase 7 evaluation: the browser re-opens an answered questionnaire via one-click Undo (with draft preservation) or draft transfer on a superseded question batch, whereas --supersedes is for stateless CLI callers."
---

# Web UI lacks questionnaire response supersedes capability

> **Loop says** (P2): The CLI allows users and agents to supersede prior questionnaire responses using the supersedes flag. In contrast, the Web UI questionnaire dock hardcodes supersedesResponseId to null on all submitted answers. Web users cannot revise or supersede previous questionnaire answers directly.

- `packages/cli/src/questionnaire.ts#L93-L111`
- `packages/web/src/components/QuestionnaireDock.tsx#L98`

## Our read

packages/cli/src/questionnaire.ts:93-111 exposes 'question answer --supersedes <response-id>' to emit a replacement DesignResponse with supersedesResponseId (packages/core/src/questionnaire.ts:55), while packages/web/src/components/QuestionnairePanel.tsx:21-22 mounts QuestionnaireDock.tsx:44 only when status === 'open'. In the browser, revising a just-submitted answer uses one-operation Undo to reopen the dock with its draft intact (docs/projects/design-partner/verification/phase-1.md:60-65) or copies compatible answers when a question is superseded (packages/web/src/components/QuestionnaireDock.tsx:31), and docs/projects/design-partner/phases.md:8-12 gates new UI on Phase 7.

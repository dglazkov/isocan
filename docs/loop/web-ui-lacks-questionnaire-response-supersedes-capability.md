---
title: "Web UI lacks questionnaire response supersedes capability"
loop: 00a2a9b7-2765-4e5f-84f8-38ca7a9279b9
loop_rank: P2
loop_state: ACTIVE
loop_goal: "Always isomorphic"
decision: untriaged
---

# Web UI lacks questionnaire response supersedes capability

> **Loop says** (P2): The CLI allows users and agents to supersede prior questionnaire responses using the supersedes flag. In contrast, the Web UI questionnaire dock hardcodes supersedesResponseId to null on all submitted answers. Web users cannot revise or supersede previous questionnaire answers directly.

- `packages/cli/src/questionnaire.ts#L93-L111`
- `packages/web/src/components/QuestionnaireDock.tsx#L98`

## Our read

Not yet checked against the code.

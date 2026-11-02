---
title: Serial blob reads stall design brief loading
loop:
  - 10294c3c-cebc-406a-927b-29e44283450b
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: untriaged
---

# Serial blob reads stall design brief loading

> **Loop says** (P2): The design brief loading function reads canvas items sequentially within an asynchronous loop over item versions. Each item needs a network request to read blob text, forcing serial network roundtrips for every item on the canvas. When a user opens the questionnaire publish dialog, this sequential loading stalls the component and delays displaying available briefs.

- `packages/web/src/lib/questionnaire.ts#L40-L54`
- `packages/web/src/components/QuestionnairePublish.tsx#L50-L56`

## Our read

Not yet checked against the code.

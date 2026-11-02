---
title: Personal canvas linking mutations bypass daemon reducer
loop:
  - ed062a43-5cb9-42a0-b0b1-9acda1032734
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# Personal canvas linking mutations bypass daemon reducer

> **Loop says** (P2): Personal canvas linking and agent delegation mutations in the web client call REST endpoints directly. The core operation vocabulary contains no operation schemas for personal canvas linking or agent delegation. This causes personal consent and delegation state mutations to bypass the daemon reducer and side-channel into desk storage.

- `packages/web/src/components/PersonalContext.tsx`
- `packages/web/src/lib/personal.ts`
- `packages/core/src/ops.ts`
- `packages/server/src/personal.ts`

## Our read

Not yet checked against the code.

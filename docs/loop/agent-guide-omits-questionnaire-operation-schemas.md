---
title: Agent guide omits questionnaire operation schemas
loop:
  - 1bdea39b-5a7c-4d51-b987-29aa23afda45
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# Agent guide omits questionnaire operation schemas

> **Loop says** (P2): The agent guide documentation omits JSON operation schemas and parameter definitions for questionnaire operations. Core defines questionnaire.ask and questionnaire.answer to create and answer design question sets. Autonomous agents cannot discover or formulate questionnaire operations directly from agent-guide.md.

- `packages/cli/src/agent-guide.md`
- `packages/core/src/ops.ts#L360-L370`

## Our read

Not yet checked against the code.

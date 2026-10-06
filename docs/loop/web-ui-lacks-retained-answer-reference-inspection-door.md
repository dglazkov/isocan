---
title: Web UI lacks retained answer reference inspection door
loop:
  - 69a435b3-3e6c-44d0-ab54-bca52c7fa77d
loop_rank: P2
loop_state: ACTIVE
loop_goal: Always isomorphic
decision: untriaged
---

# Web UI lacks retained answer reference inspection door

> **Loop says** (P2): The CLI provides the command isocan design reference to inspect retained answer references after canvas items change or are removed. The API exports readDesignReference for client inspection. In contrast, the Web UI lacks a door or view component calling readDesignReference to display retained reference content.

- `packages/cli/src/questionnaire.ts#L116-L120`
- `packages/api/src/connect.ts#L491`

## Our read

Not yet checked against the code.

---
title: Web UI lacks item word analysis door
loop:
  - a75d081d-e45a-42df-af23-674fbba92037
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# Web UI lacks item word analysis door

> **Loop says** (P2): The command-line client provides the words command to inspect item word counts, vocabulary density, and readability metrics. The Web UI contains no component or door to inspect these word analysis statistics for canvas text items. This creates an imbalance between CLI and web client capabilities.

- `packages/cli/src/main.ts#L3650`
- `packages/core/src/text.ts#L1-L100`

## Our read

Not yet checked against the code.

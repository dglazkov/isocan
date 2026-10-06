---
title: Web UI lacks design evaluation metrics interface
loop:
  - 0ca6bdca-0c81-4076-9835-8555889a9e77
loop_rank: P2
loop_state: ACTIVE
loop_goal: Always isomorphic
decision: untriaged
---

# Web UI lacks design evaluation metrics interface

> **Loop says** (P2): The CLI provides the evals command suite to inspect agent request corpus distributions, converge acceptance rates, and retained version pairs. However, the Web UI contains no interface or view component to display these evaluation metrics. This creates an imbalance between CLI and web client capabilities.

- `packages/cli/src/main.ts#L14906-L15060`
- `packages/core/src/evals.ts#L268-L563`
- `packages/web/src/lib/runtimeModules.ts#L33-L34`

## Our read

Not yet checked against the code.

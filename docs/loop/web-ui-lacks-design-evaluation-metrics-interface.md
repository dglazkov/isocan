---
title: Web UI lacks design evaluation metrics interface
loop:
  - 0ca6bdca-0c81-4076-9835-8555889a9e77
loop_rank: P2
loop_state: ACTIVE
loop_goal: Always isomorphic
decision: declined
rank: never
project: evals
since: 2026-10-07
note: "By design: isocan evals is the offline corpus and grader calibration CLI for the evals programme, and evals.ts is deliberately excluded from the web bundle so canvas visitors do not pay its download cost."
---

# Web UI lacks design evaluation metrics interface

> **Loop says** (P2): The CLI provides the evals command suite to inspect agent request corpus distributions, converge acceptance rates, and retained version pairs. However, the Web UI contains no interface or view component to display these evaluation metrics. This creates an imbalance between CLI and web client capabilities.

- `packages/cli/src/main.ts#L14906-L15060`
- `packages/core/src/evals.ts#L268-L563`
- `packages/web/src/lib/runtimeModules.ts#L33-L34`

## Our read

The claim holds by design: packages/cli/src/main.ts:14901-15061 exposes 'isocan evals' (corpus, converge, pairs) over packages/core/src/evals.ts:268-566 for offline oplog measurement (docs/projects/evals/plan.md:144-166). In packages/web/src/lib/runtimeModules.ts:30-34, the web app explicitly documents that evals.ts was split out of the web entry chunk because nothing in the browser calls it and it exists for the CLI.

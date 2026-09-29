---
title: "Duplication of domain computations across clients"
loop: 08f51c0f-d98f-4206-a460-b3824a3b7dbc
loop_rank: P2
loop_state: RESOLVED
loop_goal: "Always isomorphic"
decision: stale
rank: never
project: canvas-groups
since: 2026-09-29
note: "Stale: the two files are not duplicates. The CLI parses flags into a placement and the web reads its stores, while shared geometry already lives in core. Reopen if a real shared computation is found."
---

# Duplication of domain computations across clients

> **Loop says** (P2): Domain logic such as canvas group placement, canonical JSON serialization, and questionnaire evaluation is implemented separately in web and CLI codebases. Duplicating business logic across clients increases drift risk and violates core isolation.

- `packages/cli/src/group-placement.ts`
- `packages/web/src/lib/groupplacement.ts`

## Our read

packages/cli/src/group-placement.ts parses --cell and --in flags and calls groupContentBox from @isocan/core and resolveCanvasGroupRef from @isocan/api. packages/web/src/lib/groupplacement.ts reads useUiStore and useCanvasStore to build the creation destination and select created items. Different inputs, no shared body; the geometry is imported from core by the CLI. I did not check the canonical-JSON or questionnaire claims separately.

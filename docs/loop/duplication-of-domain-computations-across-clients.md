---
title: Duplication of domain computations across clients
loop:
  - 08f51c0f-d98f-4206-a460-b3824a3b7dbc
loop_rank: P2
loop_state: RESOLVED
loop_goal: Always isomorphic
decision: done
rank: next
project: cleanup
since: 2026-09-29
note: "Fixed in cleanup Phase 5 (DU-6, 26 Sep 2026): the seven copies of canonical JSON serialization across @isocan/core and @isocan/api were consolidated into canonicalJson in @isocan/core and guarded by test/copies.test.ts; questionnaire helpers live in @isocan/core/questionnaire and @isocan/api/questionnaire."
---

# Duplication of domain computations across clients

> **Loop says** (P2): Domain logic such as canvas group placement, canonical JSON serialization, and questionnaire evaluation is implemented separately in web and CLI codebases. Duplicating business logic across clients increases drift risk and violates core isolation.

- `packages/cli/src/group-placement.ts`
- `packages/web/src/lib/groupplacement.ts`

## Our read

packages/cli/src/group-placement.ts and packages/web/src/lib/groupplacement.ts are surface-specific adapters (CLI --cell/--in flag parsing vs Zustand store selection) over groupContentBox in @isocan/core and resolveCanvasGroupRef in @isocan/api. The canonical-JSON duplication Loop flagged across design-request, design-partner, and design-decision modules was real and was fixed in docs/projects/cleanup/phases.md Phase 5 (DU-6, 26 Sep 2026): seven copies were replaced by canonicalJson in @isocan/core, guarded by test/copies.test.ts. Questionnaire state and failure status are shared in @isocan/core/questionnaire and @isocan/api/questionnaire-reader.

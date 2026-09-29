---
title: "Canonical opwords mapping omits actor domain operations"
loop: a565bcff-a787-4707-935e-b133cfd61bc0
loop_rank: P3
loop_state: RESOLVED
loop_goal: "Always isomorphic"
decision: stale
rank: never
project: iso-api
since: 2026-09-29
note: "Stale: actor.claim, setColor, setMark and join are home-scoped and never enter a canvas oplog, so no canvas feed shows them. Already resolved in Loop. Reopen if an actor op reaches canvas history."
---

# Canonical opwords mapping omits actor domain operations

> **Loop says** (P3): The central opwords mapping file in core omits all four actor domain operations defined in core type definitions. Missing opwords entries result in incomplete human-readable labels in activity feeds.

- `packages/core/src/ops.ts`
- `packages/core/src/opwords.ts`

## Our read

ops.ts:104-208 defines the four actor ops with comments calling them home-scoped and not undoable; opwords.ts OP_WORDS covers canvas-history ops including agent.enroll/invite/withdraw, which do live in canvas state (ops.ts:445-509). I did not trace whether actor ops can ever be appended to a canvas oplog, so that is the residual uncertainty.

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

packages/core/src/ops.ts:104-208 defines the four actor.* ops (actor.claim, actor.setMark, actor.join, actor.setColor) as home-scoped and not undoable; packages/core/src/opwords.ts OP_WORDS covers canvas-history operations including agent.enroll, agent.invite, and agent.withdraw, which do live in canvas state (ops.ts:445-509). Verified in packages/server/src/http.ts:1776-1825: the POST /ops handler intercepts all four actor.* operations and appends them to the home-level actors.jsonl log (paths.ts:55), returning early before engine.applyOp can ever write them to a canvas oplog.

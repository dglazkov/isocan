---
title: Web UI design reconciliation drafts bypass daemon reducer
loop:
  - 1244b1d7-71c8-4a8d-b79a-3570198835f1
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# Web UI design reconciliation drafts bypass daemon reducer

> **Loop says** (P2): Web UI design task reconciliation and comparison recovery components write local draft state directly to browser local storage. Storing draft state outside daemon operations leaves reconciliation progress unrecorded in the operation log and unsynchronized across client devices.

- `packages/web/src/components/DesignTaskReconcile.tsx#L30-L75`
- `packages/web/src/components/DesignComparisonRecovery.tsx#L25-L60`

## Our read

Not yet checked against the code.

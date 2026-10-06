---
title: Lack of structured design decision rationale documentation
loop:
  - b68db583-9b29-4647-a625-e252534d45f5
loop_rank: P2
loop_state: RESOLVED
loop_goal: What canvas tools teach us
decision: untriaged
---

# Lack of structured design decision rationale documentation

> **Loop says** (P2): When human-agent design teams select or merge design alternatives, decisions update item versions without attaching structured design decision records. Decision handling routines in the API and core reducer record transient authority strings but omit durable canvas rationale notes. As a result, team members lose context on architectural trade-offs during iterative co-design tasks.

- `packages/api/src/design-decision.ts#L7-L15`
- `packages/core/src/ops.ts#L234-L238`
- `packages/core/src/design-decision.ts#L48-L64`
- `packages/web/src/components/DesignTaskPanel.tsx#L14-L47`

## Our read

Not yet checked against the code.

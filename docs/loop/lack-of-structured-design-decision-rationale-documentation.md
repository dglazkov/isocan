---
title: Lack of structured design decision rationale documentation
loop:
  - b68db583-9b29-4647-a625-e252534d45f5
loop_rank: P2
loop_state: RESOLVED
loop_goal: What canvas tools teach us
decision: proposed
rank: never
project: design-partner
since: 2026-10-07
note: "Stale (and resolved in Loop): design.compare and design.decide persist immutable DesignComparison and DesignDecisionRecord payloads with hypotheses, tradeoffs, authority, and rationale (design-decision.ts:13-69, ops.ts:235-238), rendered in DesignTaskCard.tsx:66."
---

# Lack of structured design decision rationale documentation

> **Loop says** (P2): When human-agent design teams select or merge design alternatives, decisions update item versions without attaching structured design decision records. Decision handling routines in the API and core reducer record transient authority strings but omit durable canvas rationale notes. As a result, team members lose context on architectural trade-offs during iterative co-design tasks.

- `packages/api/src/design-decision.ts#L7-L15`
- `packages/core/src/ops.ts#L234-L238`
- `packages/core/src/design-decision.ts#L48-L64`
- `packages/web/src/components/DesignTaskPanel.tsx#L14-L47`

## Our read

This claim is stale (and Loop's own state is RESOLVED). packages/core/src/ops.ts:235-238 defines design.compare, design.respond, and design.decide operations backed by packages/core/src/design-decision.ts:13-69: DesignComparison (:13-27) records structured alternatives with hypothesis and tradeoff plus recommendedAlternativeId and recommendation; DesignDecisionInput (:48-58) captures authority with explicit reason or rationale across human-choice, canvas-delegation, external-report, and agent-judgment branches; and DesignDecisionRecord (:60-69) stores the immutable adoption decision on the canonical comment via designDecisionPort (packages/api/src/design-decision.ts:7-15). DesignTaskPanel (packages/web/src/components/DesignTaskPanel.tsx:14-47) and DesignTaskCard (packages/web/src/components/DesignTaskCard.tsx:66) render these effectiveDecisions with their chosen alternative, author, and rationale.

---
title: "Lack of agent proposal staging overlays"
loop: 1d1014ca-9ec4-403c-a723-f898b969f765
loop_rank: P2
loop_state: ACTIVE
loop_goal: "What canvas tools teach us"
decision: accepted
rank: later
project: new
since: 2026-09-29
note: "Partly true: an agent edit is one version and one undo, but nothing holds it back for approval first. That is the trust-battery idea in the vision, so keep it as work, and design it as a trust tier that asks before writing rather than an overlay."
---

# Lack of agent proposal staging overlays

> **Loop says** (P2): isocan applies AI agent design modifications directly to active canvas state without a pre-commit staging buffer or proposal sandboxing layer. The workbench stage renders items directly from active document state, offering no toggleable proposal or review overlay layer. Existing version diffing tools operate retroactively on historical versions rather than uncommitted agent proposals. CLI agent workflows execute live operations that immediately mutate active cards, removing human pre-approval during collaborative design sessions.

- `packages/core/src/reducer.ts`
- `packages/core/src/ops.ts`
- `packages/web/src/components/Workbench.tsx`
- `packages/web/src/components/VersionCompare.tsx`
- `packages/core/src/diff.ts`
- `packages/cli/src/agent-guide.md`

## Our read

Agent edits are Operations applied by one reducer (packages/core/src/reducer.ts); an item edit is item.addVersion, which the version stack keeps and per-item undo removes, and VersionCompare.tsx compares versions after the fact. There is no pre-commit buffer, so the claim holds for approval-before-write. Whether it should is a design question (the trust-battery idea in the vision) and not a defect: the README states agents work visibly and reversibly. Not run: a session with an agent writing to see the moment a person can object.

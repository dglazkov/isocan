---
title: Absence of spatial canvas history diffing
loop:
  - b2553ad0-8567-44df-885b-31b801af713d
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: untriaged
---

# Absence of spatial canvas history diffing

> **Loop says** (P2): The core engine records operations in an operation log and supports time travel by replaying state up to a sequence number. Existing diff functionality compares two versions of an individual item, such as text or code changes. However, the system lacks data models and interfaces to calculate spatial state diffs or display visual diff overlays across canvas sequence numbers. Collaborators cannot inspect spatial movement, additions, or deletions across historical canvas states.

- `packages/core/src/ops.ts#L565-L599`
- `packages/core/src/timeline.ts#L342-L358`
- `packages/core/src/diff.ts#L204-L226`
- `packages/core/src/ops.ts#L94-L527`
- `packages/web/src/components/Scrubber.tsx#L100-L107`

## Our read

Not yet checked against the code.

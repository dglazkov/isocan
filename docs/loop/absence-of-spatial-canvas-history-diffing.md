---
title: Absence of spatial canvas history diffing
loop:
  - b2553ad0-8567-44df-885b-31b801af713d
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: declined
rank: never
since: 2026-10-07
note: "Unrequested: packages/core/src/timeline.ts:342-358 and packages/web/src/components/Scrubber.tsx:100-107 already provide interactive oplog scrubbing across sequence numbers, and packages/core/src/diff.ts:204-226 diffs item versions; a whole-canvas spatial diff overlay across two sequence numbers has no measured demand."
---

# Absence of spatial canvas history diffing

> **Loop says** (P2): The core engine records operations in an operation log and supports time travel by replaying state up to a sequence number. Existing diff functionality compares two versions of an individual item, such as text or code changes. However, the system lacks data models and interfaces to calculate spatial state diffs or display visual diff overlays across canvas sequence numbers. Collaborators cannot inspect spatial movement, additions, or deletions across historical canvas states.

- `packages/core/src/ops.ts#L565-L599`
- `packages/core/src/timeline.ts#L342-L358`
- `packages/core/src/diff.ts#L204-L226`
- `packages/core/src/ops.ts#L94-L527`
- `packages/web/src/components/Scrubber.tsx#L100-L107`

## Our read

Checked packages/core/src/ops.ts:94-599, packages/core/src/timeline.ts:342-358, packages/core/src/diff.ts:204-226, and packages/web/src/components/Scrubber.tsx:100-107. timeline.ts:342-358 (past) folds LogEntry records (ops.ts:565-599) up to any sequence number so Scrubber.tsx:100-107 and isocan at replay historical canvas states directly on the stage, while diffVersions (diff.ts:204-226) compares two versions of an item in VersionCompare.tsx. Computing a separate spatial bounding-box diff overlay between two arbitrary sequence numbers is an unrequested feature beyond scrubbing and item version diffing.

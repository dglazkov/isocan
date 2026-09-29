---
title: "Spatial diffing missing for agent design edits"
loop: ba981125-0632-4320-91c1-70d02ac7d6d3
loop_rank: P2
loop_state: RESOLVED
loop_goal: "What canvas tools teach us"
decision: accepted
rank: later
project: wireframes
since: 2026-09-29
note: "Partly answered since triage: isocan diff (dce876ed) prints what changed between two versions, or a variation and its source, and VersionCompare shows it in the app. What is still missing is a ghost overlay on the canvas itself. Loop reports it resolved. Keep as later work only if that overlay is wanted."
---

# Spatial diffing missing for agent design edits

> **Loop says** (P2): isocan presents item version histories as vertical ply stacks without spatial visual diffing or ghost overlays. When an agent updates a wireframe screen or canvas item, human co-designers must manually cycle through discrete version cards to inspect changes. The canvas lacks speculative ghosting or visual diff highlights to show modified elements, added slots, or deleted layout nodes side-by-side.

- `packages/web/src/components/VersionFanOut.tsx`
- `packages/web/src/components/CanvasCard.tsx`
- `packages/core/src/ops.ts`

## Our read

grep of packages/web/src/components/VersionFanOut.tsx finds no diff or ghost logic; versions are shown as cards. docs/research/feature-readiness.md:54 names visual diffs as a next step for design taste, so the idea is known but unscheduled. No roadmap project owns it; nearest homes are wireframes or design-lint. Loop state is already RESOLVED. Worth a design decision before any build.

---
title: Spatial diffing missing for agent design edits
loop:
  - ba981125-0632-4320-91c1-70d02ac7d6d3
loop_rank: P2
loop_state: RESOLVED
loop_goal: What canvas tools teach us
decision: done
rank: next
project: version-diff
since: 2026-09-29
note: "Shipped in dce876ed (docs/projects/version-diff/design.md): VersionFanOut.tsx:187-200 renders a Compare button on every fan card opening VersionCompare.tsx, with structural wireframe and HTML diffs injected via markSource in @isocan/core/diff."
---

# Spatial diffing missing for agent design edits

> **Loop says** (P2): isocan presents item version histories as vertical ply stacks without spatial visual diffing or ghost overlays. When an agent updates a wireframe screen or canvas item, human co-designers must manually cycle through discrete version cards to inspect changes. The canvas lacks speculative ghosting or visual diff highlights to show modified elements, added slots, or deleted layout nodes side-by-side.

- `packages/web/src/components/VersionFanOut.tsx`
- `packages/web/src/components/CanvasCard.tsx`
- `packages/core/src/ops.ts`

## Our read

This Loop insight (ba981125-0632-4320-91c1-70d02ac7d6d3) was the genesis of docs/projects/version-diff/design.md (shipped 26 Sep 2026 in dce876ed). packages/web/src/components/VersionFanOut.tsx:187-200 renders a Compare button on every card in the fan-out strip that opens packages/web/src/components/VersionCompare.tsx. As documented in docs/projects/version-diff/design.md:68-106, diff highlights are injected into the HTML and wireframe source (markSource in packages/core/src/diff.ts) rather than drawn as an outer canvas ghost overlay because HTML items render inside sandboxed allow-scripts iframes whose internal scroll and viewport dimensions differ from the outer card box.

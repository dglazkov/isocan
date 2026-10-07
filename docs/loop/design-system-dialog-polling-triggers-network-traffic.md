---
title: Design system dialog polling triggers network traffic
loop:
  - bccddcf9-9816-47a8-84e5-7c380f4624b5
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPMwQ
decision: proposed
rank: never
project: design-partner
since: 2026-10-07
note: "By design: DesignSystemsDialog.tsx:50-51 polls every 10s while visible via everyWhileVisible because governing design resolution includes inherited cross-canvas sources (design-system-reader.ts:61-69) that do not advance the local canvasStore.lastSeq."
---

# Design system dialog polling triggers network traffic

> **Loop says** (P2): Opening the design systems dialog registers a ten-second polling timer. This timer repeatedly requests design system documents over the network. Because the component already subscribes to canvas store sequence changes, fixed polling creates redundant API calls and state re-renders while canvas state is unchanged.

- `packages/web/src/components/DesignSystemsDialog.tsx#L50-L51`

## Our read

Verified in packages/web/src/components/DesignSystemsDialog.tsx:39-51: SystemScope subscribes to local canvasStore.lastSeq (line 39) and also registers everyWhileVisible(refresh, 10_000) (line 50, implemented in packages/web/src/lib/whilevisible.ts:29-60 to pause whenever document.visibilityState === 'hidden'). As packages/api/src/design-system-reader.ts:61-69 shows, readDesignSystem calls readInheritedCanvases (line 64) and readGoverningDesign (line 66), which can resolve an inherited DESIGN.md from a linked source canvas on another oplog whose edits never increment the open canvas's lastSeq. Furthermore, DesignSystemsDialog.tsx:78-80 notes that re-reads over an existing reading in hand do not set settling or disable controls (fixed in RH-5, 27 Sep 2026), and the timer only runs while the modal is open and the tab is visible.

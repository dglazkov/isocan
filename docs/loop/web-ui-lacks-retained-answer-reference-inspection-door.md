---
title: Web UI lacks retained answer reference inspection door
loop:
  - 69a435b3-3e6c-44d0-ab54-bca52c7fa77d
loop_rank: P2
loop_state: ACTIVE
loop_goal: Always isomorphic
decision: stale
rank: never
project: design-partner
since: 2026-10-07
note: "Stale: DesignComment.tsx and DesignComparisonDialog.tsx already render retained references through LocalExactReferenceCard using the immutable content-addressed blobHash that survives item pruning and GC."
---

# Web UI lacks retained answer reference inspection door

> **Loop says** (P2): The CLI provides the command isocan design reference to inspect retained answer references after canvas items change or are removed. The API exports readDesignReference for client inspection. In contrast, the Web UI lacks a door or view component calling readDesignReference to display retained reference content.

- `packages/cli/src/questionnaire.ts#L116-L120`
- `packages/api/src/connect.ts#L491`

## Our read

The claim is false. In packages/web/src/components/DesignComment.tsx:16-24 and 33, both question previews and answer reference resolutions resolve comment.designReferences and render LocalExactReferenceCard (packages/web/src/components/ExactReferenceCard.tsx:12-30), which is also used in packages/web/src/components/DesignComparisonDialog.tsx:91-92. LocalExactReferenceCard links directly to blobUrl(artifact.canvasId, artifact.blobHash) and version.visual.blobHash, serving the exact retained bytes preserved across item deletion and GC (packages/core/src/questionnaire.ts:62, docs/projects/design-partner/verification/phase-1.md:29-42).

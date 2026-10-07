---
title: Missing cross canvas component library sync
loop:
  - b9cc02d1-1b3a-4b0b-8c51-cfc57f6f7969
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: declined
rank: never
since: 2026-10-07
note: "Covered by lack-of-reusable-component-symbol-library-instantiation (accepted for later) and otherwise by design: canvases are independent documents (cloud-store.ts:100-112, designsystem.ts:52-57), while cross-canvas design references already resolve by exact DesignArtifactRef (design-request-reader.ts:93-120)."
---

# Missing cross canvas component library sync

> **Loop says** (P2): Canvas documents and item stores isolate items within single canvas boundaries without a cross-canvas symbol registry or asset update sync protocol. Address resolution covers canvas and item routes but lacks URI schemes for workspace-shared library symbols. Design systems and copy operations resolve only local canvas entities and drop external cross-canvas references. Updating component patterns forces manual duplication across project canvases and causes design drift.

- `packages/cloudstore/src/cloud-store.ts`
- `packages/core/src/address.ts`
- `packages/core/src/designsystem.ts`
- `packages/api/src/canvas-context.ts`

## Our read

Each canvas is an isolated state boundary (SnapshotObject in packages/cloudstore/src/cloud-store.ts:100-112; routes /p/:canvasId and /p/:canvasId/i/:itemId in packages/core/src/address.ts:29-69), and withoutDesignRole (packages/core/src/designsystem.ts:52-57) deliberately strips role=design-system when copying a design note from another canvas so a copied reference never silently replaces the target canvas's governing system. Cross-canvas design references and governing systems are already resolved by exact DesignArtifactRef (home, canvasId, itemId, versionId, blobHash) in readDesignRequests (packages/api/src/design-request-reader.ts:93-120), while saved comment context is read per canvas in readContextItem (packages/api/src/canvas-context.ts:42-85). User-defined component symbols within a single canvas are already tracked under docs/loop/lack-of-reusable-component-symbol-library-instantiation.md (accepted for later); cross-canvas symbol sync is premature before single-canvas symbols exist.

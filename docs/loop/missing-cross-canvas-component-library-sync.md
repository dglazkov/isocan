---
title: Missing cross canvas component library sync
loop:
  - b9cc02d1-1b3a-4b0b-8c51-cfc57f6f7969
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: untriaged
---

# Missing cross canvas component library sync

> **Loop says** (P2): Canvas documents and item stores isolate items within single canvas boundaries without a cross-canvas symbol registry or asset update sync protocol. Address resolution covers canvas and item routes but lacks URI schemes for workspace-shared library symbols. Design systems and copy operations resolve only local canvas entities and drop external cross-canvas references. Updating component patterns forces manual duplication across project canvases and causes design drift.

- `packages/cloudstore/src/cloud-store.ts`
- `packages/core/src/address.ts`
- `packages/core/src/designsystem.ts`
- `packages/api/src/canvas-context.ts`

## Our read

Not yet checked against the code.

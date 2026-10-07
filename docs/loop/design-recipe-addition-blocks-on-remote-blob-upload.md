---
title: Design recipe addition blocks on remote blob upload
loop:
  - ba9ebfe4-cd8e-4d8d-8e84-66eff1a7abc6
loop_rank: P2
loop_state: ACTIVE
loop_goal: Fast everywhere, local-first
decision: proposed
rank: never
project: design-partner
since: 2026-10-07
note: "By design: DesignRecipeLibrary.tsx:32-58 persists a PendingDesignReference intent in localStorage and verifies the canonical receipt via submitDesignReference (design-reference-submit.ts:57-80) so scoped reference and DESIGN.md additions are idempotent and retryable."
---

# Design recipe addition blocks on remote blob upload

> **Loop says** (P2): Adding a design reference or system recipe to a canvas blocks on a synchronous remote blob upload over HTTP before posting canvas operations. This creates UI latency and prevents immediate local rendering.

- `packages/web/src/components/DesignRecipeLibrary.tsx#L32-L58`

## Our read

Verified in packages/web/src/components/DesignRecipeLibrary.tsx:32-58 and packages/web/src/lib/design-reference-submit.ts:19-80: adding a design recipe or scoped DESIGN.md first hashes the text and saves a durable PendingDesignReference intent in localStorage (DesignRecipeLibrary.tsx:27-30, 39-40; design-reference-submit.ts:25-27). submitDesignReference then uploads the blob, verifies the hash and size match the saved intent (design-reference-submit.ts:64-65), posts the operation with the stable opId, and checks acknowledges() against the server's canonical group.change insert receipt (lines 38-54, 71). If offline or interrupted, the pending intent stays in localStorage and renders a 'Retry exact reference add' button (DesignRecipeLibrary.tsx:66), fulfilling the phase-3 systems-and-defaults contract without creating unconfirmed governing design systems.

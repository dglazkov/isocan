---
title: Web UI lacks persona docket review interface
loop:
  - 2d2c57cd-6b98-4073-8b3a-49951eaf231e
loop_rank: P2
loop_state: ACTIVE
loop_goal: Always isomorphic
decision: declined
rank: never
project: personas
since: 2026-10-07
note: "By design: the board canvas itself is the web docket interface where each open finding is a card answered with checkmark or cross reactions, and isocan docket was built as its CLI counterpart."
---

# Web UI lacks persona docket review interface

> **Loop says** (P2): The command-line client provides commands to list open persona findings and record verdict decisions with reason threads. The web user interface lacks a dedicated docket review panel or inspection interface for persona findings. Users in the web interface can only view generic reaction chips on individual canvas cards if they find them manually.

- `packages/cli/src/main.ts#L9076-L9154`
- `packages/core/src/docket.ts#L22-L71`
- `packages/web/src/components/Reactions.tsx#L116-L194`
- `docs/research/2026-09-07-the-docket.md#L239-L252`

## Our read

As documented in packages/core/src/docket.ts:9-20, packages/cli/src/main.ts:9026-9037, and docs/research/2026-09-07-the-docket.md:249-302, scripts/docket.mjs places one item per open persona finding on the board canvas wearing docket=<slug> metadata. In the Web UI, a person answers findings directly on the canvas by clicking the checkmark or cross chips in packages/web/src/components/Reactions.tsx:116-160 or replying in the thread, and packages/cli/src/main.ts:9058-9154 provides the CLI twin for terminal triage.

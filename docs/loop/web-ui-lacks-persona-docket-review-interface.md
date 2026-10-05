---
title: "Web UI lacks persona docket review interface"
loop: 2d2c57cd-6b98-4073-8b3a-49951eaf231e
loop_rank: P2
loop_state: ACTIVE
loop_goal: "Always isomorphic"
decision: untriaged
---

# Web UI lacks persona docket review interface

> **Loop says** (P2): The command-line client provides commands to list open persona findings and record verdict decisions with reason threads. The web user interface lacks a dedicated docket review panel or inspection interface for persona findings. Users in the web interface can only view generic reaction chips on individual canvas cards if they find them manually.

- `packages/cli/src/main.ts#L9076-L9154`
- `packages/core/src/docket.ts#L22-L71`
- `packages/web/src/components/Reactions.tsx#L116-L194`
- `docs/research/2026-09-07-the-docket.md#L239-L252`

## Our read

Not yet checked against the code.

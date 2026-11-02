---
title: Design system tokens lack reactive variable updates
loop:
  - a29dc7c5-341b-4827-bf23-65e014456313
loop_rank: P2
loop_state: DISMISSED
loop_goal: What canvas tools teach us
decision: declined
rank: never
project: design-lint
since: 2026-09-29
note: "By design: DESIGN.md declares intended tokens and injects no CSS, and restyle is an explicit typed mapping. Live token binding would be a new feature. Reopen if someone asks for it."
---

# Design system tokens lack reactive variable updates

> **Loop says** (P2): isocan parses design system tokens in DESIGN.md as static specifications during initial generation rather than reactive variables. Modifying a token value in DESIGN.md does not automatically re-evaluate or update style variables across linked wireframes and HTML components. Consequently, human designers and agents must execute manual batch re-styling commands across the canvas whenever design system rules change.

- `packages/core/src/designsystem.ts`
- `packages/core/src/design-contract.ts`
- `packages/core/src/design-contract-rules.ts`
- `packages/modules/wireframe/src/theme.ts`

## Our read

docs/projects/design-lint/phases.md line 44 records the deliberate architectural boundary: DESIGN.md is read and compared by the audit engine, never injected as live CSS into an artifact. For wireframes, packages/modules/wireframe/src/theme.ts:174-180 maps a design system's tokens onto var(--w-*) roles through an explicit, versioned theme choice so existing screens never silently shift appearance underneath a review thread.

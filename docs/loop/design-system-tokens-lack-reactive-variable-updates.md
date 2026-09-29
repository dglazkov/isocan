---
title: "Design system tokens lack reactive variable updates"
loop: a29dc7c5-341b-4827-bf23-65e014456313
loop_rank: P2
loop_state: DISMISSED
loop_goal: "What canvas tools teach us"
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

design-lint/phases.md line 44 records that DESIGN.md injects no CSS into an artifact. The wireframe theme (packages/modules/wireframe/src/theme.ts) draws only var(--w-*) roles and maps a system tokens onto them through a typed choice, resolved at that mapping (theme.ts:174-180). Re-mapping after a token edit is a deliberate act, not a missed reactivity. I did not find a doc asking for live propagation.

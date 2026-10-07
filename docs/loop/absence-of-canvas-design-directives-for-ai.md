---
title: Absence of canvas design directives for AI
loop:
  - 27274b8e-71cd-43f9-9910-d42f5de25fc5
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: stale
rank: never
since: 2026-10-07
note: "Stale: packages/core/src/designsystem.ts:79-130 resolves canvas-wide and scoped DESIGN.md items (enforced by designStanding at packages/core/src/designsystem.ts:237-249), packages/modules/wireframe/src/theme.ts:69-92 maps DESIGN.md tokens onto WireSpec.style (packages/modules/wireframe/src/spec.ts:89), and packages/api/src/design-workflow.ts:13-17 mandates reading the governing design system."
---

# Absence of canvas design directives for AI

> **Loop says** (P2): AI wireframe generation executes ad-hoc prompt strings without validating against a persistent canvas-wide design directive or brand policy file. Prompt compilation parses raw text requests directly into wireframe specs without enforcing canvas layout boundaries or visual design constraints. Consequently, AI agents generate wireframes that deviate from project design rules and brand guidelines.

- `packages/modules/wireframe/src/prompt.ts#L15-L50`
- `packages/core/src/designsystem.ts#L40-L95`
- `packages/modules/wireframe/src/spec.ts#L120-L165`

## Our read

Checked packages/core/src/designsystem.ts:40-249, packages/modules/wireframe/src/spec.ts:84-165, packages/modules/wireframe/src/theme.ts:69-92, and packages/api/src/design-workflow.ts:13-17 (packages/modules/wireframe/src/prompt.ts does not exist). Canvases already have first-class DESIGN.md items with role=design-system resolved per scope or canvas-wide via selectDesignSystem (designsystem.ts:114-130) and enforced after DESIGN_SYSTEM_AFTER=2 and DESIGN_SYSTEM_LIMIT=6 screens (designsystem.ts:157-249). Wireframes bind DESIGN.md tokens onto WireSpec.style roles (theme.ts:69-92, spec.ts:89) and polish tokens (spec.ts:151-173), and designWorkflowProcedure (design-workflow.ts:13-17) requires agents to read and check the governing DESIGN.md.

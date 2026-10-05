---
title: "Absence of canvas design directives for AI"
loop: 27274b8e-71cd-43f9-9910-d42f5de25fc5
loop_rank: P2
loop_state: ACTIVE
loop_goal: "What canvas tools teach us"
decision: untriaged
---

# Absence of canvas design directives for AI

> **Loop says** (P2): AI wireframe generation executes ad-hoc prompt strings without validating against a persistent canvas-wide design directive or brand policy file. Prompt compilation parses raw text requests directly into wireframe specs without enforcing canvas layout boundaries or visual design constraints. Consequently, AI agents generate wireframes that deviate from project design rules and brand guidelines.

- `packages/modules/wireframe/src/prompt.ts#L15-L50`
- `packages/core/src/designsystem.ts#L40-L95`
- `packages/modules/wireframe/src/spec.ts#L120-L165`

## Our read

Not yet checked against the code.

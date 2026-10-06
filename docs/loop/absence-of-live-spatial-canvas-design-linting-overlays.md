---
title: Absence of live spatial canvas design linting overlays
loop:
  - 3ae90f47-6896-4251-8ed4-77019f98ea89
loop_rank: P2
loop_state: DISMISSED
loop_goal: What canvas tools teach us
decision: declined
rank: never
project: design-lint
since: 2026-09-29
note: "Real gap, unmeasured: audit results live in DesignLintPanel and the CLI, not as badges on cards, and design-lint phases 1-5 chose the panel. Reopen if people ask to lint without leaving the canvas."
---

# Absence of live spatial canvas design linting overlays

> **Loop says** (P2): isocan contains a static screen auditor and repair machine, but restricts diagnostic feedback to manual CLI commands and sidebar modal panels. The audit engine parses item HTML/CSS against DESIGN.md tokens for four specific property types (colour, type size, radius, spacing). However, diagnostics generate AuditDiagnostic records that are not rendered as live visual badges or overlay highlights on non-compliant canvas elements. Consequently, designers and agents must leave the spatial canvas viewport to review and repair design contract violations.

- `packages/core/src/designaudit.ts`
- `packages/web/src/components/DesignLintPanel.tsx`
- `packages/core/src/design-repair.ts`

## Our read

designaudit.ts produces parsed diagnostics with ranges and coverage (research 2026-09-14-design-lint.md). DesignLintPanel.tsx and design-lint.css render them in a panel; no card-level badge appears in CanvasCard.tsx grep for audit or diagnostic. The design-lint project journey lists no overlay stage, so this would be new scope.

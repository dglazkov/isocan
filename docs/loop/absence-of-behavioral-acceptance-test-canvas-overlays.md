---
title: "Absence of behavioral acceptance test canvas overlays"
loop: 197738b3-fc9d-4c85-954c-b320737c1f91
loop_rank: P2
loop_state: DISMISSED
loop_goal: "What canvas tools teach us"
decision: declined
rank: never
project: design-lint
since: 2026-09-29
note: "Premature: no GIVEN/WHEN/THEN runner exists, and design-lint has not met its benefit threshold with human ratings still pending. Reopen if those ratings favour repair."
---

# Absence of behavioral acceptance test canvas overlays

> **Loop says** (P2): isocan evaluates static design tokens and design contract rules, but lacks a behavioral test runner for user interaction acceptance criteria. Current design review contracts and static audit rules evaluate declarative string tokens without parsing GIVEN/WHEN/THEN behavioral scenarios or UI state transitions. Furthermore, design review components render verification observations as plain text list items inside sidebar drawers rather than displaying spatial PASS/FAIL status badges and assertion pin overlays directly on canvas cards. Consequently, designers and agents cannot visually verify functional user interaction requirements on the spatial canvas.

- `packages/core/src/design-contract.ts`
- `packages/core/src/designaudit.ts`
- `packages/api/src/design-review.ts`
- `packages/web/src/components/DesignReviewPanel.tsx`
- `packages/web/src/components/DesignTaskCard.tsx`

## Our read

design-contract.ts (141 lines) and designaudit.ts audit only tokens; grep for behavioural scenarios in design-contract*.ts and api/design-review.ts finds none. DesignReviewPanel.tsx:54 shows observations as a details list inside the panel, not on cards. docs ROADMAP shows design-lint phase 5 met no objective benefit threshold, so a new behavioural instrument has no measured demand yet.

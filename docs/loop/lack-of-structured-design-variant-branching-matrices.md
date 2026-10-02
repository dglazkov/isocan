---
title: "Lack of structured design variant branching matrices"
loop: 93b3cfe5-ef3c-41f0-b86e-31c46e5153a8
loop_rank: P2
loop_state: DISMISSED
loop_goal: "What canvas tools teach us"
decision: declined
rank: never
project: version-diff
since: 2026-09-30
note: "Stale: diverge and converge are built. Variations carry parent lineage (core/lineage.ts), wires vary one decision at a time with variantOf (wireframe/vary.ts, spec.ts:35), prefer records A/B taste (core/preference.ts), diff --source compares a variation with its screen, and choose folds the winner back as one undo (core/converge.ts)."
---

# Lack of structured design variant branching matrices

> **Loop says** (P2): The system processes design directions and competition bout entries as single sequential iterations or independent cards. Core canvas groupings support manual spatial grids but omit variant branching metadata and parent-child tracking. Consequently, users and agents cannot systematically evaluate parallel design options or merge selected variants into primary canvas wireframes.

- `packages/core/src/design-direction.ts`
- `packages/core/src/loop.ts`
- `packages/modules/design-competition/src/bout.ts`
- `packages/core/src/canvas-groups.ts`

## Our read

Each sub-claim has a shipped answer. Parent-child tracking: packages/core/src/lineage.ts:18-36 (parent=<itemId> on the child, parentOf, childrenOf), set by duplicate (packages/core/src/duplicate.ts:102-105) and asked of every agent by the guide ('Say what a thing came from', packages/cli/src/agent-guide.md:818-822). Systematic parallel options: packages/modules/wireframe/src/vary.ts:8-24 makes variations from the answerer's own distribution, one flipped decision each (WireSpec.variantOf and flip, packages/modules/wireframe/src/spec.ts:35-37), and a design-competition bout is by construction parallel rival designs, one lane per fighter (packages/modules/design-competition/src/bout.ts:21-28). Evaluating them: isocan diff <variation> --source and the Compare view (agent-guide.md:1722-1746, docs/projects/version-diff/design.md), and isocan prefer for the left-vs-right eye test (packages/core/src/preference.ts:4-24). Merging the selected variant into the primary: isocan choose / 'Choose this variation', packages/core/src/converge.ts:5-27 and :65-116, the winner becomes a new version of the source and the siblings go to the trash in one undo group. A 'matrix' layout is available too: a canvas group's named row and column grid (GroupLayout rows/columns, drawn at packages/web/src/components/ItemView.tsx:2014-2037). What is not there is a stored dimension-by-option matrix object, and converge.ts:21-27 records why a new op type was not added for this family: the existing ops already say it. Reopen with a case lineage + prefer + choose cannot express.

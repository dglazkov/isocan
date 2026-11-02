---
title: CLI lacks interactive questionnaire authoring commands
loop:
  - 55c3f502-e58f-416f-8023-c43b420f5fb4
loop_rank: P2
loop_state: ACTIVE
loop_goal: Always isomorphic
decision: declined
rank: never
since: 2026-10-07
note: "By design: packages/cli/src/questionnaire.ts:59-80 takes a DesignQuestionSet JSON file so non-interactive agent harnesses can publish multi-question batches and retry idempotently with stable payload-derived IDs (line 78), while human respondents already have flag-based authoring on isocan design answer at packages/cli/src/questionnaire.ts:82-94."
---

# CLI lacks interactive questionnaire authoring commands

> **Loop says** (P2): The Web UI provides interactive forms to construct, configure, and publish question sets directly. In contrast, the CLI requires passing a pre-built JSON file to isocan design ask. The CLI lacks interactive prompt flags or subcommands to compose question sets from the terminal.

- `packages/web/src/components/QuestionnairePublish.tsx#L10-L77`
- `packages/cli/src/questionnaire.ts#L59-L80`

## Our read

Checked packages/web/src/components/QuestionnairePublish.tsx:10-90 and packages/cli/src/questionnaire.ts:26-100. In questionnaire.ts:59-80, isocan design ask <file> accepts a saved DesignQuestionSet JSON record by design so non-interactive CLI agent harnesses can author structured multi-question sets and retry idempotently using stable payload-derived commentId and opId values (questionnaire.ts:62, 78). Meanwhile, human respondents answering from the terminal already have full flag-based authoring (--id, --question, --option, --text, --skip, --dismiss, --delegate) on isocan design answer (questionnaire.ts:82-94).

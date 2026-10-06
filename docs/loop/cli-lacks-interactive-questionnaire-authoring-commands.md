---
title: CLI lacks interactive questionnaire authoring commands
loop:
  - 55c3f502-e58f-416f-8023-c43b420f5fb4
loop_rank: P2
loop_state: ACTIVE
loop_goal: Always isomorphic
decision: untriaged
---

# CLI lacks interactive questionnaire authoring commands

> **Loop says** (P2): The Web UI provides interactive forms to construct, configure, and publish question sets directly. In contrast, the CLI requires passing a pre-built JSON file to isocan design ask. The CLI lacks interactive prompt flags or subcommands to compose question sets from the terminal.

- `packages/web/src/components/QuestionnairePublish.tsx#L10-L77`
- `packages/cli/src/questionnaire.ts#L59-L80`

## Our read

Not yet checked against the code.

---
title: Web UI lacks item word analysis door
loop:
  - a75d081d-e45a-42df-af23-674fbba92037
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: proposed
rank: never
project: copy-edit
since: 2026-10-07
note: "Stale: isocan words (main.ts:8310-8520) is the copy-edit deck/vary/mix/lint CLI, whose Web UI doors are Vary the copy, Compare the copy (CopyCompare.tsx), and Choose a voice; neither computes readability metrics."
---

# Web UI lacks item word analysis door

> **Loop says** (P2): The command-line client provides the words command to inspect item word counts, vocabulary density, and readability metrics. The Web UI contains no component or door to inspect these word analysis statistics for canvas text items. This creates an imbalance between CLI and web client capabilities.

- `packages/cli/src/main.ts#L3650`
- `packages/core/src/text.ts#L1-L100`

## Our read

Verified in packages/cli/src/main.ts:8310-8520 and packages/core/src/text.ts:1-69: `isocan words` does not compute vocabulary density or readability metrics (and packages/core/src/text.ts defines `POST /api/text` constants, while main.ts:3640-3652 is `linkLine`). `isocan words` extracts and edits screen copy decks via `@isocan/core/copy-deck`, paired in the Web UI with *Vary the copy…*, *Compare the copy…* (packages/web/src/components/CopyCompare.tsx:1-50), and *Choose a voice…* (docs/projects/copy-edit/phases.md:91-198).

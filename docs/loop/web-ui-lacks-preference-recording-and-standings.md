---
title: Web UI lacks preference recording and standings
loop:
  - cdfb5645-acde-40de-ad0c-91c6cffaaf50
loop_rank: P2
loop_state: ACTIVE
loop_goal: Always isomorphic
decision: proposed
rank: never
project: design-partner
since: 2026-10-07
note: "Superseded by DesignComparisonDialog: web users compare alternatives and record decisions with standing history through DesignComparisonDialog.tsx, while the raw prefer/standings metadata helper remains a CLI/evals primitive."
---

# Web UI lacks preference recording and standings

> **Loop says** (P2): The CLI provides the isocan prefer verb to record item preferences and calculate comparison standings across canvas items. In contrast, the Web UI lacks components to record user preferences using preferPatch or unpreferPatch. The Web UI also provides no view to display preference standings computed by core. This creates a feature divergence between CLI and Web UI clients.

- `packages/cli/src/main.ts#L8679-L8709`
- `packages/core/src/preference.ts#L56-L126`
- `packages/web/src/`

## Our read

packages/cli/src/main.ts:8852-8900 and packages/core/src/preference.ts:5-126 implement 'isocan prefer' and 'isocan standings' over item metadata (prefer=<actor> / prefer-vs=<id>). In packages/web, side-by-side option trying, choice recording, and standing history are instead provided by packages/web/src/components/DesignComparisonDialog.tsx:71-115 and packages/web/src/components/DesignComparisonButton.tsx:10-22, so a second web eye-test picker for raw prefer metadata is unnecessary.

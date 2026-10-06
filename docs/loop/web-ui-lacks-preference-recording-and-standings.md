---
title: Web UI lacks preference recording and standings
loop:
  - cdfb5645-acde-40de-ad0c-91c6cffaaf50
loop_rank: P2
loop_state: ACTIVE
loop_goal: Always isomorphic
decision: untriaged
---

# Web UI lacks preference recording and standings

> **Loop says** (P2): The CLI provides the isocan prefer verb to record item preferences and calculate comparison standings across canvas items. In contrast, the Web UI lacks components to record user preferences using preferPatch or unpreferPatch. The Web UI also provides no view to display preference standings computed by core. This creates a feature divergence between CLI and Web UI clients.

- `packages/cli/src/main.ts#L8679-L8709`
- `packages/core/src/preference.ts#L56-L126`
- `packages/web/src/`

## Our read

Not yet checked against the code.

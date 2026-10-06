---
title: Eager canvas imports bloat entry bundle
loop:
  - 9291f52b-7826-4552-8481-1ebc999a449e
loop_rank: P2
loop_state: DISMISSED
loop_goal: Fast everywhere, local-first
decision: stale
rank: never
project: ui-refresh
since: 2026-09-29
note: "Stale: the entry has a budget with CEILING 727,800 and GOAL 640,000 in scripts/bundle-ceiling.mjs and a gate that holds it, and most pages and modules are already lazy. Reopen if the gate is bypassed."
---

# Eager canvas imports bloat entry bundle

> **Loop says** (P2): The main web application bundle imports the full canvas workspace and core modules statically at startup. As a result, the primary Javascript bundle reaches 701 kB uncompressed, exceeding Vite build limits. Every first visit downloads the entire canvas rendering engine and built-in modules before rendering the landing page or doorway.

- `packages/web/src/App.tsx#L15`
- `packages/web/src/modules.ts#L23-L29`
- `packages/web/src/main.tsx#L17`

## Our read

App.tsx lazy-loads Navigation, LensPage, CanvasListPage, PublicPage and others (lines 46-66) and Markdown; modules.ts uses deferredModule with dynamic imports for stickers, talk, anatomy, competition and wireframe. CanvasPage and FrontPage remain static imports. test/bundle-budget.test.ts and scripts/bundle-ceiling.mjs already own the first-visit size question. The 701 kB figure is under the current ceiling. Could not re-measure a build here.

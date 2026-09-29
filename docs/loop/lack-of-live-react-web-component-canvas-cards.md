---
title: "Lack of live React web component canvas cards"
loop: 07856fbb-83d4-409d-89b9-11580be332dc
loop_rank: P1
loop_state: DISMISSED
loop_goal: "What canvas tools teach us"
decision: declined
rank: never
project: extensions
since: 2026-09-29
note: "Possible today without a new feature: an HTML item runs inline scripts and the CSP allows jsdelivr, so one file can load React and render JSX. The recipe is in the agent guide, topic items (49539211). A first-class hot-reload card is a product bet. Reopen if people ask for hot reload."
---

# Lack of live React web component canvas cards

> **Loop says** (P1): isocan relies on external web URLs or containerized CLI program logs to display web applications rather than rendering live code components directly on spatial canvas cards. Browser items require external HTTP servers and face iframe header restrictions, while wireframe screens produce static HTML string blobs. Consequently, humans and AI agents cannot write, inspect, and hot-reload live React or Tailwind UI components directly on the canvas without launching external local processes.

- `packages/core/src/browseritem.ts`
- `packages/modules/sandbox/src/core.ts`
- `packages/modules/wireframe/src/render.ts`

## Our read

browseritem.ts turns a typed address into what an iframe loads; wireframe render.ts emits static HTML strings; sandbox module runs a program through rc --sandbox (docs/decisions.md D1, opt-in). Canvas HTML items already run inline scripts under CSP (only tailwind and jsdelivr load per memory). No design doc proposes live component cards; docs/research/2026-08-28-component-libraries.md is about importing libraries, not this. Unverified: whether extensions project already covers it.

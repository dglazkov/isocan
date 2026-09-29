---
title: "Workspace package imports deviate from manifest declarations"
loop: 2d4b6d0c-af7c-4cc2-9e1c-c85783821d7f
loop_rank: P2
loop_state: ACTIVE
loop_goal: "Dependencies healthy"
decision: accepted
rank: later
project: modules
since: 2026-09-29
note: "Partly true: packages/web/src/modules.ts imports @isocan/mindmap and other modules that packages/web/package.json does not list; it works through root workspaces and the loader. Declare them, or say in modules why not."
---

# Workspace package imports deviate from manifest declarations

> **Loop says** (P2): Multiple workspace packages import internal modules and external dependencies without listing them in package manifests. Also, package manifests declare unused external dependencies and peer dependencies that runtime code never imports. These mismatches create hidden dependency chains across workspace packages.

- `packages/web/src/modules.ts`
- `packages/web/package.json`
- `packages/cli/src/modules.ts`
- `packages/cli/package.json`
- `packages/modules/documents/src/cli.ts`
- `packages/server/src/daemon.ts`
- `packages/voice-agent/package.json`
- `packages/modules/talk/package.json`

## Our read

packages/web/src/modules.ts:23-28 imports @isocan/mindmap, mermaid, documents, sandbox, design-competition and wireframe, and packages/web/package.json dependencies lists only @isocan/core among internal packages, so the claim holds for web. docs/projects/modules/phases.md:34 and package.json:47 say workspaces are resolved by path through bin/workspace-loader.mjs and deliberately not declared as dependencies, so much of this is intended for release installs. It resolves only because npm hoists workspaces at the root. I did not check cli, server, voice-agent or talk manifests or the unused-dependency claim.

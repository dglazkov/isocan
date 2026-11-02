---
title: Lack of design-to-code JSX Tailwind export pipeline
loop:
  - 205dcad2-68cc-46f6-8e42-231b524b5c16
loop_rank: P2
loop_state: DISMISSED
loop_goal: What canvas tools teach us
decision: declined
rank: never
project: design-partner
since: 2026-09-30
note: "True that no JSX/Tailwind emitter exists, but it cuts against how isocan hands off: screens are already HTML, wires carry a typed spec, and design craft --out packs the brief and DESIGN.md for the coding agent that knows the repo's stack. Reopen if code-building agents are seen re-deriving wires by hand."
---

# Lack of design-to-code JSX Tailwind export pipeline

> **Loop says** (P2): isocan converts wireframes into static HTML strings, presentation slides, or canvas project backups, but lacks a compilation pipeline to emit frontend code. Wireframe AST specifications and port boundaries validate layout slots and serialize operations without generating React JSX components or Tailwind CSS utility styling. As a result, developers and automated agents must manually implement wireframe designs into React components.

- `packages/modules/wireframe/src/spec.ts`
- `packages/core/src/export.ts`
- `packages/core/src/deckexport.ts`
- `packages/modules/wireframe/src/port.ts`

## Our read

The fact is right. packages/core/src/export.ts:6-21 is a backup (log, bytes, manifest), packages/core/src/deckexport.ts is the slide deck as a document, isocan export <file> is JSON Canvas (packages/cli/src/agent-guide.md:3144-3150), and packages/modules/wireframe/src/port.ts:3-14 is the seam that lets both surfaces run one composer, not an emitter; nothing writes .jsx or Tailwind classes. The premise that developers must re-implement from pictures is not: an HTML item is already the code (a designed screen is a self-contained HTML file, and the guide's items topic shows a live React component as an item, agent-guide.md:1319-1360); a wire carries its machine-readable WireSpec (packages/modules/wireframe/src/spec.ts:22-37, 172-186: archetype, slots, component ids, typed props, intents) that any agent reads back with no DOM; and isocan design craft <request> --out <dir> (agent-guide.md:2000-2010) exports PRODUCT.md, DESIGN.md, its projection and a surface brief for an external coding agent. A fixed JSX+Tailwind compiler would choose one stack for every repository, where the recorded direction is to meet a project on its own tooling: docs/projects/design-lint/design.md:225-235 (detection recommends, never rewrites a project's established configuration) and docs/research/2026-08-28-component-libraries.md (a shipped component library is a house style). The build step in isocan is the agent in the repo, reading the spec and the design system. This matches the ruling on docs/loop/missing-spatial-developer-redlining-spec-overlays.md. If the hand-off proves lossy, the isocan-shaped fix is a wire spec-to-brief section in the craft packet, not a compiler.

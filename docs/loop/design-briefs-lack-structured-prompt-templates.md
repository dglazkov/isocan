---
title: Design briefs lack structured prompt templates
loop:
  - 1d6d1671-8ef4-4ee2-8f72-cc7a4636aaf9
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: declined
rank: never
project: design-partner
since: 2026-10-07
note: "By design: DesignBrief separates typed workflow fields from open-ended audience/task/constraint strings (design-brief.ts:6-18, design-request-reader.ts:204-205), while wireframe archetypes live in WireSpec (wireframe/src/catalog/index.ts:1-25) for wireframe-specific composition. Reopen if brief-to-wireframe handoff shows a measured failure."
---

# Design briefs lack structured prompt templates

> **Loop says** (P2): Design briefs parse freehand text strings without structured prompt templates or parameter validation schemas. The design request reader evaluates brief completeness using simple string null-checks rather than validated schema parameters. Consequently, design briefs remain decoupled from wireframe layout archetypes and component specifications, leading to unpredictable AI generation on canvas.

- `packages/core/src/design-brief.ts#L6-L18`
- `packages/api/src/design-request-reader.ts#L204-L215`
- `packages/modules/wireframe/src/catalog/index.ts#L1-L25`

## Our read

Verified in packages/core/src/design-brief.ts:6-18: parseDesignBrief validates a strict schema with typed enums for progress, intent ('create'|'extend'|'refine'), fidelity, delivery ('html-node'|'connected-app'|'wireframe'|'exploration'), typed facts with origins/sources, validated ContextManifest (line 13), and typed references. In packages/api/src/design-request-reader.ts:204-205, missingFactIds checks !state.brief.audience and !state.brief.primaryTask to decide whether initialDiscovery (zero-to-three material questions, docs/projects/design-partner/design.md:83) is needed before building. Wireframe catalog archetypes and component slots in packages/modules/wireframe/src/catalog/index.ts:1-25 and packages/modules/wireframe/src/spec.ts:22-37 are intentionally specific to the wireframe module's Jev composer rather than coupled into every general design-partner brief.

---
title: Lack of spatial design system theme variants
loop:
  - ecbd643b-a432-4c7e-987f-5d3e48f27f9c
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPNa4
decision: declined
rank: never
project: design-lint
since: 2026-10-07
note: "Partly false and unrequested: spatial scopes (groups and areas) already resolve their own governing DESIGN.md via selectDesignSystem (designsystem.ts:114-130), while multi-mode token variants inside one DESIGN.md (tokens.ts:379-406, theme.ts:69-92) are an unrequested feature."
---

# Lack of spatial design system theme variants

> **Loop says** (P2): The wireframe engine resolves global CSS custom properties at render time without support for theme variants. Existing canvas governance constructs resolve one design system per scope without operations to attach mode variants to individual frames. Therefore, users cannot switch or preview spatial theme variants across canvas regions during UI exploration.

- `packages/modules/wireframe/src/theme.ts#L69-L92`
- `packages/core/src/tokens.ts#L379-L406`
- `packages/core/src/designsystem.ts#L79-L130`

## Our read

Spatial scoping of different design systems across canvas regions is already built: selectDesignSystem and scopedDesignSystems (packages/core/src/designsystem.ts:79-141) resolve a governing DESIGN.md by direct group membership, ancestor group, or geometric area before falling back to the canvas root, and wire style --preset <name> (packages/modules/wireframe/src/cli.ts:101-111) places and binds a DESIGN.md for a flow's group. What is true is that a single DESIGN.md and WireStyle (packages/modules/wireframe/src/theme.ts:69-92) map one flat set of token values onto roles, and toCss (packages/core/src/tokens.ts:379-406) emits a single :root block without light/dark or multi-mode token axes. Multi-mode theme variants inside a single DESIGN.md would be a new feature with no user ask; today two theme variants on one canvas are represented by placing two scoped DESIGN.md items in adjacent groups.

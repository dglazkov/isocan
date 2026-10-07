---
title: Wireframe slots lack design token palette bindings
loop:
  - 93812b83-9d4c-4244-ba6c-f9028e6d047f
loop_rank: P2
loop_state: ACTIVE
loop_goal: What canvas tools teach us
decision: declined
rank: never
project: wireframes
since: 2026-10-07
note: "By design: wireframes deliberately separate structural slot props (choice, flag, count, index) from visual token theming so one spec renders cleanly in default IDEO greys or any governing design system via --w-* CSS variables."
---

# Wireframe slots lack design token palette bindings

> **Loop says** (P2): Wireframe specifications map design system tokens onto eleven global screen roles rather than binding individual slots to design token palettes. The component catalog limits slot property definitions to choice, flag, count, and index types without supporting token palette bindings. As a result, wireframe slots cannot express slot-level palette overrides or consume extended brand design system colors.

- `packages/modules/wireframe/src/spec.ts#L249-L268`
- `packages/modules/wireframe/src/theme.ts#L23-L47`
- `packages/modules/wireframe/src/catalog/types.ts#L23-L30`
- `packages/core/src/tokens.ts#L379-L406`
- `packages/core/src/designsystem.ts#L79-L130`

## Our read

The separation is explicit by design in packages/modules/wireframe/src/theme.ts:5-47, packages/modules/wireframe/src/catalog/types.ts:4-28, and docs/projects/wireframes/design.md:238-272. WireSlot (packages/modules/wireframe/src/spec.ts:249-268) restricts slot props to structural Jev-askable primitives (choice, flag, count, index), while themeCss (packages/modules/wireframe/src/theme.ts:23-28) maps a governing design system's tokens onto 11 --w-* CSS variables at the document level so blocks never carry per-slot color overrides.

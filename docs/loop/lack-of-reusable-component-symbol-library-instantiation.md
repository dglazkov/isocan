---
title: "Lack of reusable component symbol library instantiation"
loop: 3a860a15-2233-4032-aeb1-31a26c857bb1
loop_rank: P2
loop_state: ACTIVE
loop_goal: "What canvas tools teach us"
decision: accepted
rank: later
project: new
since: 2026-09-30
note: "Dion 30 Sep: accepted for later — a person-defined symbol that updates every screen using it is a design question first."
---

# Lack of reusable component symbol library instantiation

> **Loop says** (P2): The core design system model and canvas item schema lack support for component symbol primitives and instance property overrides. Wireframe catalog recipes rely on hardcoded component blocks without a symbol library or instantiation engine. Changing a component pattern forces manual updates across every canvas wireframe card.

- `packages/core/src/designsystem.ts`
- `packages/core/src/canvasitem.ts`
- `packages/modules/wireframe/src/catalog/index.ts`
- `packages/modules/wireframe/src/spec.ts`

## Our read

For wireframes the claim is false. A screen stores a spec, not baked markup: each WireSlot names a catalog component by id with typed props (packages/modules/wireframe/src/spec.ts:172-186, catalog in packages/modules/wireframe/src/catalog/index.ts), and packages/modules/wireframe/src/rerender.ts:8-21 (isocan wire render --all, packages/modules/wireframe/src/cli.ts:86-105) draws every wire again from its spec in one undo group, so a component change reaches every screen without hand edits; a wire style likewise restyles every screen. For the design system, DESIGN.md has a components section of token contracts (packages/core/src/designmd.ts:46, :95) checked against screens by packages/core/src/designcheck.ts:100-106. What is true: the wire catalog is fixed in the module, so a person cannot author a symbol, and designed HTML items (the output of the design workflow) are self-contained files with no instance link, so a header changed on one screen is re-edited on each. docs/research/2026-08-28-component-libraries.md found that component code has nowhere to live in an HTML item and that a shipped library becomes a house style; a user-defined symbol avoids both, since it would be this canvas's own. In isocan's terms the feature would be an item kind (a symbol item whose content is an HTML fragment plus declared props), a convention like lineage (properties: instanceOf=<symbol item id>, overrides as props), and an op-level re-render in the shape of wire render --all that writes new versions of every instance in one group, with the CLI verb and the app's gesture sending the same ops. Real, sizeable, and not yet asked for by a person, hence later.

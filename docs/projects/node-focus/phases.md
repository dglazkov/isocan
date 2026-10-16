# Node Focus — the walk

[`journey.md`](journey.md) is the ideal; [`design.md`](design.md) is the
mechanism.

**Where we are, 15 Oct 2026:** every phase (1–6) CLOSED.

Rules for every phase, on top of `AGENTS.md`:

- **No new op type.** Every studio edit stacks an ordinary `item.addVersion` or
  `item.update`; every Node-Anchored Chat prompt is an ordinary `thread.create`
  or `thread.reply` with `anchorItemId = item.id`.
- **Capabilities decide chrome.** No component checks raw MIME strings to decide
  whether View, Edit, Enter, or File Workbench chrome appears; every surface
  reads `nodeCapabilitiesFor(item, version)`.
- **Removability holds.** Module-contributed `ModuleFocus` facets live inside
  their module packages; unloading a module falls back to the built-in facet.

---

## Phase 1 — `NodeCapabilities` & the top-left node action strip

**Status: CLOSED.**

**Outcome:** `nodeCapabilitiesFor(item, version)` in `@isocan/core` computes
`{ view, edit, enter, file }` for every built-in kind and loaded `ModuleFocus`
override. Selecting a node on the canvas (`ItemView.tsx`) renders a
counter-scaled top-left icon strip with **`⤢ View`** (`Enter` →
`/p/:canvas/i/:item`), **`✎ Edit`** (`E` → `/p/:canvas/w/:item`, when
`caps.edit && canEdit`), and **`↘ Enter` / `↖ Leave`** (only when `caps.enter`
is true), retiring the ad-hoc Markdown `"Read / select text"` button and
under-row `"Full screen"` button. `isocan open <item> --edit` (and its guide
entry) opens `/p/:canvas/w/:item`.

**Proof:** unit tests in `packages/core/test/capabilities.test.ts` covering
screens, wireframes, static images, SVGs, design systems, documents, videos,
browser frames, and text nodes; component/journey tests verifying the top-left
strip renders `↘ Enter` on an HTML screen and omits it on a PNG image; CLI
surface test passing with `open --edit`; `npm test` and `npm run typecheck`.

**Record:** `packages/core/src/capabilities.ts`, `packages/core/src/modules.ts`,
`packages/web/src/components/ItemView.tsx`, `packages/web/src/pages/CanvasPage.tsx`,
`packages/cli/src/main.ts`, `packages/cli/src/agent-guide.md`, and
`packages/core/test/capabilities.test.ts` (10/10) + `packages/web/test/itemread.test.ts`
(4/4) + `packages/cli/test/surface.test.ts`.

---

## Phase 2 — Unified View (`/i/:itemId`) & Edit (`/w/:itemId`) header, `ModuleFocus` slot, and Node-Anchored Chat (`⌘J`)

**Status: CLOSED.**

**Outcome:** `FullScreen.tsx` (`/i/:itemId`) and `Workbench.tsx` (`/w/:itemId`)
share one Focus Header with the **`[ View | Edit ]`** switch, editable title,
version pill (`S` fan-out), and **`💬 Chat (⌘J)`** toggle. `WebModule` in
`packages/core/src/modules.ts` gains `focus?: readonly ModuleFocus[]`. When
`/w/:itemId` opens on a node, the stage mounts the matching `ModuleFocus.edit`
studio (with the `[ Studio | Code | Split ]` Workbench file tools when
`caps.file` is true, and no CodeMirror chrome when `caps.file` is false) beside
the **Node-Anchored Chat Drawer** bound to `anchorItemId = item.id` with
`FocusSubtarget` pills.

**Proof:** tests verifying `[ View | Edit ]` round-trips between `/i/:itemId`
and `/w/:itemId`, that non-file nodes (`image/png`) mount Edit Focus without
CodeMirror, and that sending a message in the Edit Focus Chat drawer creates or
replies to a thread with `anchorItemId === item.id` carrying any active
`FocusSubtarget`; `npm test` and `npm run typecheck`.

**Record:** `packages/web/src/components/FocusHeader.tsx`,
`packages/web/src/components/NodeFocusChat.tsx`, `packages/web/src/lib/nodechat.ts`,
`packages/web/src/lib/focusRegistry.ts`, `packages/web/src/stores/focusStore.ts`,
`packages/web/src/modules.ts`, `packages/web/src/components/FullScreen.tsx`,
`packages/web/src/components/Workbench.tsx`, `packages/web/src/components/ArtifactStage.tsx`,
and `packages/web/test/nodefocus.test.ts` (10/10) + `packages/web/test/workbench.test.ts` (33/33).

---

## Phase 3 — Image View (Metadata Inspector) & Image Edit Studio

**Status: CLOSED.**

**Outcome:** Built-in Image `ModuleFocus`: View Focus (`/i/:itemId`) renders a
pan/zoom lightbox (`Fit`, `1:1`, alpha checkerboard) with a Metadata Inspector
(dimensions, aspect ratio, MIME, byte size, SHA-256 hash, author/time, EXIF /
PNG `tEXt` metadata, version diff slider, and canvas **Where Used** backlinks).
Edit Focus (`/w/:itemId`) renders the non-destructive Image Studio (crop &
aspect presets, rotate/flip, markup pen, alt-text & properties editor, SVG
source split when `caps.file` is true, and image-agent prompt starter chips in
Node-Anchored Chat).

**Proof:** unit tests for PNG/EXIF metadata extraction and canvas image
backlink resolution; browser/component test verifying cropping an image stacks
a new `ItemVersion` (`item.addVersion`) and `isocan undo` restores the prior
version; `npm test` and `npm run typecheck`.

**Record:** `packages/core/src/image-metadata.ts`,
`packages/web/src/components/ImageFocus.tsx`,
`packages/web/src/lib/focusRegistry.ts`,
`packages/web/src/components/focus.css`, and
`packages/web/test/image-focus.test.ts` (8/8).

---

## Phase 4 — Rich Design System Focus (`DESIGN.md`)

**Status: CLOSED.**

**Outcome:** Built-in Design System `ModuleFocus`: View Focus upgrades
`DesignSystemView` with a **Governed Screens Matrix** showing live `design
check` status across canvas screens. Edit Focus embeds the structured Token &
Direction Studio (color swatch pickers with live AA contrast guardrails,
typography scale controls, spacing/radius/component token cards, and Direction
& Voice fields) alongside the live specimen preview and the `[ Studio | Code |
Split ]` raw Markdown editor backed by `reconcileDesignProjection`.

**Proof:** tests verifying token swatch edits update `{colors.*}` component
references live, preserve conditional projection identity on save, and surface
contrast warnings; `npm test` and `npm run typecheck`.

**Record:** `packages/web/src/components/DesignSystemFocus.tsx`,
`packages/web/src/lib/focusRegistry.ts`,
`packages/web/src/components/focus.css`, and
`packages/web/test/design-system-focus.test.ts` (5/5).

---

## Phase 5 — Wireframe Focus (`@isocan/wireframe` `ModuleFocus`)

**Status: CLOSED.**

**Outcome:** `wireframeWeb.focus` contributes Wireframe View Focus (interactive
stage with `WireLayersBar` fidelity pill, clickable prototype hotspots, and
toggleable `wire why` entropy/decision overlay) and Wireframe Edit Focus (the
Wireframe Composer Studio: archetype/template/density header, click-to-swap
`[data-wf]` slot inspector over the 53-component catalog, bar emphasis &
pattern toggles, inline copy/intent deck, Variations tray, and `FocusSubtarget`
slot pills in Node-Anchored Chat).

**Proof:** module tests verifying clicking a `[data-wf]` slot swaps its catalog
block and re-renders a new `ItemVersion` without raw HTML corruption, sets
`FocusSubtarget` for Node-Anchored Chat, and unloading `@isocan/wireframe`
falls back cleanly to HTML Screen focus; `npm test` and `npm run typecheck`.

**Record:** `packages/modules/wireframe/src/focus.tsx`,
`packages/modules/wireframe/src/web.tsx`,
`packages/modules/wireframe/src/activation.ts`,
`packages/modules/wireframe/assets/styles.css`,
`packages/modules/wireframe/test/focus.test.ts` (3/3), and
`packages/web/test/wireframe-focus.test.ts` (1/1).

---

## Phase 6 — Screen Studio (`text/html`) & module facets (`documents`, `mermaid`)

**Status: CLOSED.**

**Outcome:** Built-in HTML Screen `ModuleFocus` unifies responsive viewport
framing (`390` / `768` / `1440` / `Fit`), state toggles, `TextEditFrame` + copy
deck roles, DOM element `FocusSubtarget` selection, and `[ Studio | Code |
Split ]` (`StageEditor` + `DesignLintPanel`). `@isocan/documents` and
`@isocan/mermaid` register their `ModuleFocus` facets.

**Proof:** tests verifying Screen Studio viewport framing, DOM subtarget
selection into Node-Anchored Chat, and module removability guards for
`documents` and `mermaid`; `npm test` and `npm run typecheck`.

**Record:** `packages/web/src/components/ScreenFocus.tsx`,
`packages/web/src/lib/focusRegistry.ts`,
`packages/web/src/components/focus.css`,
`packages/modules/documents/src/web.tsx`,
`packages/modules/mermaid/src/web.tsx`,
`packages/modules/documents/test/web.test.ts`,
`packages/modules/mermaid/test/web.test.ts`, and
`packages/web/test/screen-focus.test.ts` (2/2).

# Node Focus — Capability-Driven `View`, `Edit` & `Enter` with Node-Anchored Chat

**14 October 2026.** Specified from [`journey.md`](journey.md); the execution
plan is [`phases.md`](phases.md).

## 1. The debt it discharges

Stepping closer to a node on an isocan canvas today is split across four ad-hoc
mechanisms that leave a gap between *interacting with a card in place*,
*presenting an artifact*, and *editing it as what it actually is*:

1. **Fragmented doors on the card:**
   - Double-clicking sets `enteredItemId` (pointer pass-through inside the
     card), even on static images where "entering" does nothing.
   - Markdown files render a bespoke `"Read / select text"` button
     (`ItemView.tsx`); the under-row carries a `"Full screen"` button; and
     Edit/Workbench (`W`) has no affordance on the node at all.
2. **View (`/i/:itemId`) is just a zoomed-up card:**
   - `FullScreen.tsx` renders the bare `VersionContent` (`<img>`, `<iframe>`,
     `<DesignSystemView>`) with zero rich metadata (an image shows no
     dimensions, EXIF, provenance, or canvas backlinks; a wireframe shows no
     fidelity pill or decision rationale).
3. **Workbench (`/w/:itemId`) equates Edit with raw CodeMirror:**
   - `ArtifactStage.tsx` only offers `StageEditor.tsx` when
     `editableText(mimeType)` is true.
   - **Images (`image/*`)** get no Edit mode at all.
   - **Design systems (`DESIGN.md`)** open as raw Markdown in CodeMirror while
     the structured token editor sits in a separate modal
     (`DesignSystemsDialog.tsx`).
   - **Wireframes (`wireSpec`)** open as raw generated HTML in CodeMirror
     (which gets overwritten on `wire rerender`) instead of editing the
     wireframe's catalog spec, slots, and copy deck.
4. **Chat in `/w/:itemId` is canvas-wide (`MainThreadBody`), not anchored to
   the focused node.**

---

## 2. Declarative Node Capabilities & Top-Left Action Strip

### 2.1 Node Capability Metadata (`NodeCapabilities`)

Every item resolves a pure capability descriptor in `@isocan/core` (derived
from built-in item rules plus any loaded `CoreModule` / `ModuleFocus`),
declaring what interactions the node supports:

```ts
// packages/core/src/capabilities.ts

export interface NodeCapabilities {
  /** Can open in View Focus (/p/:canvasId/i/:itemId) — presentation + rich metadata/inspection. */
  view: boolean;
  /** Can open in Edit Focus (/p/:canvasId/w/:itemId) — has a rich Edit Studio and/or editable file source. */
  edit: boolean;
  /** Can be Entered inline on the canvas (enteredItemId) — ONLY true for nodes with live interactive/scrollable card interiors (HTML screens/prototypes, live docs, browser frames, videos, long-form Markdown). False for static images, design systems, and groups. */
  enter: boolean;
  /** Node is a file itself (HTML, Markdown, DESIGN.md, SVG, JSON/code) — unlocks Workbench file tools (CodeMirror source pane, Save-to-disk backing, file tree, lint) inside Edit Focus. */
  file: boolean;
}
```

| Node Kind | `view` | `edit` | `enter` (inline on canvas) | `file` (Workbench file tools in Edit) |
| :--- | :---: | :---: | :---: | :---: |
| **HTML Screen / Prototype** (`text/html`) | yes | yes *(Screen Studio + Code)* | yes *(click links/controls in place)* | yes |
| **Wireframe Screen** (`wireSpec` HTML) | yes | yes *(Wireframe Composer + Code)* | yes *(click prototype links in place)* | yes |
| **Image** (`image/png`, `jpeg`, `webp`) | yes | yes *(Image Studio + Agent Edit)* | no *(static card)* | no |
| **SVG Vector** (`image/svg+xml`) | yes | yes *(Image Studio + XML Source)* | no | yes |
| **Design System** (`DESIGN.md`) | yes | yes *(Token Studio + Markdown)* | no *(specimen card)* | yes |
| **Document** (`text/markdown`, `.md`) | yes | yes *(Doc Studio + Markdown)* | yes *(scroll / select text)* | yes |
| **Video** (`video/*`) | yes | yes *(Trim/meta + Agent)* | yes *(inline playback controls)* | no |
| **Placed Canvas / Browser** (`BROWSER_MIME`) | yes | no | yes *(interact with framed page)* | no |
| **Text Node** (sticky / canvas text) | no | no *(edits in place on double-click)* | no | no |

### 2.2 Top-Left Selection Action Strip on the Canvas

When a single node is selected on the canvas (`soleSelection` or `entered`), a
compact, counter-scaled **top-left action strip** (`transformOrigin: "left
bottom"`) mounts along the top-left edge of the node, rendering **only the
icons enabled by `nodeCapabilitiesFor(item, version)`**:

- **`⤢` View** (`Enter` key) — enters **View Focus** (`/p/:canvasId/i/:itemId`).
- **`✎` Edit** (`E` key) — enters **Edit Focus** (`/p/:canvasId/w/:itemId`,
  shown when `caps.edit && canEdit`).
- **`↘` Enter** / **`↖` Leave** — toggles inline pointer pass-through
  (`enteredItemId`) right on the canvas, **rendered only when `caps.enter ===
  true`**.

This single capability-driven strip along the top-left retires both the ad-hoc
`"Read / select text"` button on Markdown items and the `"Full screen"` button
in the under-row, leaving the under-row dedicated to reactions/marks and
`width × height` dimensions.

---

## 3. Unified Routes: `View Focus` (`/i/:itemId`) & `Edit Focus` (`/w/:itemId`)

Rather than inventing a third cover route, **Edit Focus unifies directly with
Workbench (`/p/:canvasId/w/:itemId`)**:

- **Whole-canvas Workbench (`/p/:canvasId/w`, no `itemId`):** Still opens the
  canvas-wide room (Agents roster + Files tree + Main Thread).
- **Node Edit Focus (`/p/:canvasId/w/:itemId`):**
  1. **Shared Focus Header:** Both `/i/:itemId` (View) and `/w/:itemId` (Edit)
     render the same top header bar (`← Canvas`, editable item title, version
     pill `vN` with `S` fan-out, the **`[ View | Edit ]`** switch, **`💬 Node
     Chat (⌘J)`**, and live presence avatars).
  2. **Kind-Aware Edit Studio Center Stage:** The stage opens the node's rich
     **Edit Facet** (Screen Studio, Wireframe Composer, Design System Token
     Studio, Image Studio).
  3. **Workbench File Tools for File-Backed Nodes (`caps.file === true`):**
     When `caps.file` is true, the Edit Studio header includes a **`[ Studio |
     Code | Split ]`** toggle that mounts the Workbench's `StageEditor`
     (CodeMirror), `SaveToDisk` (local file backing sync), `DesignLintPanel`,
     and an expandable `Files` rail (`WbFiles`). When `caps.file` is false
     (e.g. a PNG image), CodeMirror and file-on-disk chrome stay out of the
     way.
- **CLI Parity:**
  - `isocan open <item>` → opens View Focus (`/p/:canvasId/i/:itemId`).
  - `isocan open <item> --edit` (alias of `--workbench`) → opens Edit Focus
    (`/p/:canvasId/w/:itemId`).
- **Zero new `Operation` types:** Every rich editor commits a new `ItemVersion`
  (`item.addVersion`) or updates `item.properties` (`item.update`), so `isocan
  undo`, version fan-out (`S`), and `isocan wait` work unchanged.

---

## 4. What `View` and `Edit` Focus Do Per Node Kind

### 4.1 Screens (`text/html` — `caps: { view, edit, enter, file }`)

- **VIEW Focus (`/i/:itemId`):** Full-bleed live iframe (`entered=true`) with
  responsive viewport pills (`Mobile 390` · `Tablet 768` · `Desktop 1440` ·
  `Fit`), clickable prototype hotspots, and a collapsible Info Rail (`I`)
  showing governing `DESIGN.md` compliance, version timeline (`v1…vN`), speaker
  notes (`N`), and node-anchored comment threads.
- **EDIT Focus (`/w/:itemId`):**
  - *Studio:* Direct in-place copy/text editing (`TextEditFrame` + `isocan
    words` copy-deck roles), element selector loupe, state simulator (`default`
    / `empty` / `loading` / `error`), and responsive width handles.
  - *Code / Split (`caps.file`):* CodeMirror (`StageEditor`) with live draft
    preview, `SaveToDisk`, and inline `DesignLintPanel` diagnostics & repair.

### 4.2 Images (`image/png`, `jpeg`, `webp`, `svg` — `caps: { view, edit, enter: false, file: svgOnly }`)

- **VIEW Focus (`/i/:itemId`):** Pan/zoom lightbox (`Fit`, `1:1` pixel-actual,
  checkerboard alpha backdrop) plus a **Metadata Inspector** showing dimensions
  (`W × H`, aspect ratio), MIME, byte size, SHA-256 hash, author & timestamp,
  version diff slider/onion-skin (`v1 ↔ v2`), embedded EXIF / PNG `tEXt`
  generation parameters, and **Where Used** backlinks across the canvas.
- **EDIT Focus (`/w/:itemId`):** Non-destructive crop & aspect-ratio presets,
  rotate/flip, markup/annotation pen overlay, alt-text & property editor (each
  Save stacks an `ItemVersion`), plus XML source split when `mimeType ===
  "image/svg+xml"`.

### 4.3 Design Systems (`DESIGN.md` — `caps: { view, edit, enter: false, file: true }`)

- **VIEW Focus (`/i/:itemId`):** Expanded `DesignSystemView` with copyable
  token chips, live WCAG AA/AAA contrast matrix across surface/ink pairs,
  real-scale typography waterfall, spacing/radius rulers, interactive component
  states, Voice & Glossary rules, and a **Governed Screens Matrix** showing
  which canvas screens pass/fail `design check`.
- **EDIT Focus (`/w/:itemId`):** Promotes `DesignSystemsDialog`'s
  `DesignSystemDraft` into a full-pane visual editor alongside the live
  specimen preview — color swatch pickers with live AA contrast warnings,
  typography scale controls, spacing/radius/component token cards, and
  Direction & Voice fields — plus `[ Studio | Code | Split ]` for raw
  `DESIGN.md` Markdown backed by conditional `reconcileDesignProjection` and
  `SaveToDisk`.

### 4.4 Wireframes (`@isocan/wireframe` — `caps: { view, edit, enter: true, file: true }`)

- **VIEW Focus (`/i/:itemId`):** Interactive wireframe stage with the top **`◧
  Wire · System · Low-Fi · High-Fi`** pill (`WireLayersBar`), clickable
  `data-wf-intent` prototype hotspots, and a toggleable **"Why this layout?"**
  overlay (`wire why` — surfacing Jev's P(yes) need score, archetype, and top-3
  slot entropy choices).
- **EDIT Focus (`/w/:itemId`):** **Wireframe Composer Studio** (editing the
  embedded spec rather than raw generated HTML):
  - Switch archetype (`18` archetypes), layout template (`7` `@container`
    templates), `density`, and fidelity layer.
  - Click any `[data-wf]` slot to swap its block from the 53-component catalog,
    adjust bar emphasis (`.emp-*`) or pattern fill (`.pat-*`), or reorder
    slots.
  - Inline copy & intent deck (`data-wf-intent` target screen dropdowns) with
    live `renderScreen` preview, plus a Variations tray to compare/promote
    `wire vary` alternatives.

### 4.5 Documents, Diagrams, Mind Maps & Sandbox

- **Documents (`@isocan/documents`):** Reader typography + sticky outline TOC
  in View; Markdown split editor + outline reorder + `SaveToDisk` in Edit.
- **Diagrams (`@isocan/mermaid`):** Pan/zoom SVG stage + node search in View;
  visual node/edge click-to-edit + live Mermaid DSL split in Edit.
- **Mind Maps (`@isocan/mindmap`):** Branch presentation walk in View;
  keyboard-first node outliner (`Tab` child, `Enter` sibling, `tidyMap`) in
  Edit.
- **Code & Sandbox (`@isocan/sandbox`):** Syntax-highlighted reader + latest
  run transcript in View; CodeMirror + `▶ Run fenced` + `SaveToDisk` in Edit.

---

## 5. Pluggable Contract: `ModuleFocus` in `@isocan/core` & `WebModule`

Both built-in kinds and runtime modules (`WebModule`) register their
capabilities and View/Edit surfaces through one contract in
`packages/core/src/modules.ts`:

```ts
export interface FocusSubtarget {
  kind: string;          // "wf-slot" | "dom-element" | "ds-token" | "image-region" | "line-range"
  id: string;            // e.g. "main.pricing-cards" or "colors.primary"
  label: string;         // Human-readable pill shown in the Node-Anchored Chat composer
  metadata?: Readonly<Record<string, unknown>>;
}

export interface FocusFacts {
  canvasId: string;
  canvas: CanvasContents;
  item: Item;
  version: ItemVersion;
  actor: Actor;
  canEdit: boolean;
  capabilities: NodeCapabilities;
  host: WebHost;
  subtarget: FocusSubtarget | null;
  setSubtarget: (subtarget: FocusSubtarget | null) => void;
  askAgent: (seedPrompt?: string) => void;
}

export interface ModuleFocus<V, E> {
  id: string;
  matches: (item: Item, version: ItemVersion) => boolean;
  priority?: number;
  capabilities?: (item: Item, version: ItemVersion) => Partial<NodeCapabilities>;
  view?: V;
  edit?: E;
  agentPrompts?: readonly { label: string; prompt: string }[];
}
```

If a module (`@isocan/wireframe`, `@isocan/mermaid`) is unloaded, its items
remain ordinary HTML or text files and fall back cleanly to the built-in
View/Edit facets.

---

## 6. Node-Anchored Chat in Edit Mode (`anchorItemId = item.id`)

In Edit Focus (`/p/:canvasId/w/:itemId`), bringing up Chat (`💬 Chat` button or
`⌘J`) opens the **Node-Anchored Chat Drawer**, bound directly to
`anchorItemId = item.id`:

1. **Always Anchored to the Node:**
   - Displays threads where `thread.anchorItemId === item.id` (with a switcher
     if the node has multiple threads).
   - If the node has no thread yet, sending the first message dispatches
     `thread.create` with `anchorItemId: item.id`.
   - Because it is an ordinary anchored thread, **the conversation stays
     attached to the node back on the canvas** and wakes any parked agent
     (`isocan wait`).
2. **Subtarget Context Chips (`FocusSubtarget`):**
   - Clicking a wireframe slot (`main.hero-banner`), a design-system token
     (`colors.primary`), a DOM element in a screen preview, or a crop region on
     an image sets a removable pill in the composer (`📍 Slot: Hero Banner`).
   - Sending attaches the subtarget metadata to the comment so the agent edits
     surgically rather than rewriting the whole artifact.
3. **Live Co-Editing & Version Arrival:**
   - While an agent works on `item.id`, the header shows `@AgentName is
     working…`.
   - When `v(N+1)` lands, clean buffers advance to `v(N+1)` with a `v(N+1) from
     @AgentName · Compare (S) · Undo` banner; dirty buffers preserve local
     edits via `StageEditor`'s non-blocking `landedUnder` bar.

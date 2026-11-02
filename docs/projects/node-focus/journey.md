---
status: built
since: 2026-10-14
see: workbench, modules, wireframes, design-partner, copy-edit
note: "All six phases CLOSED 15 Oct 2026. Capability-driven Node Focus: selecting a node shows a top-left icon strip for View, Edit and Enter (where Enter is only offered on nodes whose card interior is interactive); View Focus (/i/:itemId) presents each kind with its rich metadata, and Edit Focus (/w/:itemId) opens a kind-aware Edit Studio (with Workbench file tools when the node is a file) alongside a Chat drawer anchored to the node."
---

# Node Focus — the ideal

This is the **ideal**: what it feels like when every node on an isocan canvas
knows what it can do, shows those doors along its top-left corner when you
select it, and opens into a **View** focus or an **Edit** focus tailored to
what kind of node it actually is — with Chat anchored right to that node.

The mechanism is [`design.md`](design.md); the walk is [`phases.md`](phases.md).
The scenes are synthetic. Acme is a made-up shop.

---

## Scene 1 — Selecting a screen vs. selecting an image

Maya clicks Acme's **Receiving Screen** (`receiving.html`) on the canvas. Along
the top-left of the card, three crisp icons appear:

- `⤢` **View** (`Enter`)
- `✎` **Edit** (`E`)
- `↘` **Enter** (because a screen is interactive in place on the canvas)

Next to it sits `crate-photo.png`. She clicks it. Its top-left strip shows only
two icons — `⤢` **View** and `✎` **Edit** — because a static PNG has nothing to
enter inline on the canvas. The node's own capability metadata decided what
doors exist, and the ad-hoc buttons that used to hang off the bottom row are
gone.

---

## Scene 2 — View Focus and Edit Focus on an image

Maya presses `⤢` **View** (`Enter`) on `crate-photo.png`. The canvas stays
mounted underneath while View Focus (`/p/<canvas>/i/<item>`) opens a clean
lightbox on a matte backdrop with `1:1` pixel-actual zoom, checkerboard alpha
toggle, and a metadata rail showing `1600 × 1200 (4:3) · image/png · 412 KB`,
its SHA-256 hash, who uploaded it, embedded PNG generation parameters, version
comparison (`v1 ↔ v2`), and **Where Used** — two Acme screens that reference it.

She flips the top `[ View | Edit ]` switch to **Edit** (`/p/<canvas>/w/<item>`).
Because a PNG is not a text file (`caps.file = false`), no raw code editor
clutters the screen: the **Image Studio** opens with non-destructive crop,
aspect-ratio presets, markup pen, and alt-text fields. She presses `⌘J` to open
the **Node-Anchored Chat** drawer (`anchorItemId = item.id`), taps the *"Remove
background"* starter chip, and sends it. Her parked image agent wakes on the
node's anchored thread, stacks `v3` onto `crate-photo.png`, and the preview
transitions smoothly to `v3` with a one-click `Compare (S)` pill.

---

## Scene 3 — Editing a Design System (`DESIGN.md`)

Maya selects Acme's `DESIGN.md` and clicks `✎` **Edit**. Because a design
system is both a structured specification and a Markdown file (`caps.file =
true`), Edit Focus opens the **Token & Direction Studio** beside a live
specimen preview — color swatch pickers with live WCAG AA contrast badges,
typography scale sliders, spacing rulers, and component token cards — while the
header's `[ Studio | Code | Split ]` toggle lets her flip into the Workbench's
CodeMirror Markdown editor and `Save to disk` whenever she wants raw text.

---

## Scene 4 — Editing a Wireframe (`@isocan/wireframe`)

Maya selects a wireframe screen from Acme's dogfood flow and opens **Edit
Focus**. Instead of dropping her into generated HTML that would be overwritten
on the next rerender, the **Wireframe Composer** opens: she switches density to
`compact`, clicks the middle `[data-wf]` slot to swap it to `pricing-cards`
from the 53-component catalog, and sees `📍 Slot: main.pricing-cards` appear as
a pill in the Node-Anchored Chat drawer. She types *"Flesh out this tier table
for three warehouse plans"* — the message lands on that wireframe node's
anchored thread, and the agent updates that exact slot.

---

## What the scenes force

1. **Capabilities are declarative data (`NodeCapabilities`):** `view`, `edit`,
   `enter`, and `file` are computed per item in `@isocan/core` (and refined by
   loaded modules) so the canvas card and the stage agree without hardcoding
   MIME checks in view components.
2. **One top-left action strip on selection:** Renders only the capabilities
   the node supports (`⤢ View`, `✎ Edit`, `↘ Enter`), retiring bespoke buttons
   on Markdown cards and under-rows.
3. **Two unified cover routes, zero new ops:** View Focus is `/p/:canvas/i/:item`
   and Edit Focus is `/p/:canvas/w/:item` (`isocan open <item> --edit`). Every
   edit stacks an ordinary `item.addVersion` or `item.update`.
4. **File Workbench inside Edit Focus when `caps.file` is true:** File-backed
   nodes get `[ Studio | Code | Split ]` with `StageEditor`, `SaveToDisk`, and
   `DesignLintPanel`; non-file nodes (like PNGs) get a pure visual studio.
5. **Chat in Edit Focus is anchored to the node (`anchorItemId = item.id`):**
   Every prompt and subtarget selection (`FocusSubtarget`) lives on the node's
   own anchored thread, so the conversation stays attached to the artifact on
   the canvas.

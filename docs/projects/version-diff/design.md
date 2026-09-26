---
status: designed
since: 2026-09-26
see: atlas, wireframes, workbench
note: designed 26 Sep 2026 from a verified Stitch Loop insight that Dion called "exciting". The canvas can diverge (`/variation`, `wire vary`) and, since this week, converge (`choose`, "Choose this variation"), but choosing without seeing what changed is guessing, and nothing showed a person what an agent's edit actually did. One pure diff engine in core, `@isocan/core/diff`, read by `isocan diff` and by a lazy side-by-side inspector in the web. Diffing reads and never writes, so there is no new op.
---

# Version diff: see what changed before you choose

## The debt

A version stack is the medium: an agent answers "change X" by writing a
version, a person flips the fan and picks. `choose` folds a variation back
into its source. Neither surface has ever said **what is different**. The fan
shows two small pictures, and "spot the difference" at 62% scale is where a
changed button label or a swapped block goes unnoticed. That makes choosing a
guess and reviewing an agent's edit an act of faith. The evals plan calls a
version stack a preference pair. A pair nobody can tell apart is a noisy
label.

## One engine, in core, lazy

`packages/core/src/diff.ts`, exported as `@isocan/core/diff` and never from
core's index, so it costs the entry chunk nothing and the CLI loads it only
for `diff`. It is pure and deterministic: two sides in (mime, filename, size,
and the text when the kind is textual), one `VersionDiff` out:

- `kind`: `text` (Markdown, text nodes, any `text/*`), `html`, `wire`,
  `image`, or `binary`.
- `changes`: one list, in reading order, each a numbered step with an op
  (`added`, `removed`, `changed`, `moved`), a readable `what`, and where it
  sits on each side (a node path and a source offset for HTML and wires, a
  line for text).
- `summary`: the sentence both surfaces print. `isocan diff` prints it, and
  the inspector shows the same string, because both call the same function.

**Per kind:**

- **Text and Markdown.** A line diff (LCS after trimming the common head and
  tail), and inside a line that was replaced one-for-one, a word diff. The
  side-by-side rows come with it, so the web draws them and does not compute
  them.
- **HTML.** Both sides are parsed with parse5, which is the HTML spec's
  parser, so it builds the tree a browser builds. Sibling lists are aligned
  by a weighted alignment where only same-tag nodes may pair, scored by how
  much of their text and attributes they share. That way an inserted third
  `<div>` is reported as one added element rather than a cascade of changed
  ones. Paired elements are compared for attributes, class tokens, inline
  `style` properties and text. `<style>` blocks are compared rule by rule
  and property by property. A style change is usually the whole edit, and
  "the stylesheet changed" says nothing.
- **Wireframes.** A screen is an HTML file with its `WireSpec` embedded as
  JSON, and the spec is the meaning: which block fills which slot, its props,
  its intents, its words. So a wire diffs **spec to spec**: slots added,
  removed, reordered, a block swapped, props changed, and intents changed.
  Links in a wireframe are computed from intents and never stored (links.ts),
  so an intent change is the link change and is reported as one ("header
  action 1 now does settings, was filter"). A person's `wireLinks` override
  lives on the item, not the version, so no version diff can see it, and this
  one says nothing about it. Bookkeeping fields (`by`, `round`, `need`,
  `declined`) are not reported. The reading of the embedded spec repeats the
  module's two constants (core cannot import a module), and a wireframe test
  holds the two readers equal on a rendered screen.
- **Images and other files.** Metadata only: type, size, filename, and
  whether the bytes are the same. The summary says so. A pixel diff is a
  different instrument and nothing asked for it yet.

## Highlighting inside a sandboxed frame

An HTML item renders in an `allow-scripts` iframe with an opaque origin. The
app cannot reach into it, which is the point of it (wysiwyg research, "The
physics, measured"). Anything drawn over a card lands on the card, not on the
button inside it. So the highlight is put **into the source** before it is
rendered, not drawn onto the frame:

1. The diff records, for every change, the source offset of the changed
   element's start tag on each side (parse5 source locations).
2. `markSource(html, diff, side)` inserts `data-isocan-change="added|removed|changed"`
   and `data-isocan-step="3"` into those start tags, and appends one
   `<style>` and one tiny `<script>` to the end of the document. For a
   wireframe the element is the slot's own `<section data-slot>`, found the
   same way.
3. The inspector renders each side from that marked text as `srcdoc` under
   the same lone `allow-scripts` every item frame gets. That is the posture
   the stage's draft preview already uses: opaque origin, no cookie, no API.
4. Stepping through changes is a `postMessage` of a step number into both
   frames. The injected script scrolls the element into view and pulses its
   outline. Nothing comes back out, and the frame reaches nothing.

The stylesheet uses outlines drawn inside the element's box and an inset
tint, so it does not move a pixel of layout. Added is green, removed is red,
changed is amber, and the step in focus is thicker. **The live item is never
touched.** The marks exist only in a string handed to a comparison frame. A
page whose own script rebuilds its DOM after load loses its marks. The change
list and the summary still say what changed.

## The two surfaces

- **CLI:** `isocan diff <item> [from] [to]`. A version is its id, an id
  prefix, `vN` or `N`. The default is the version before the current one
  against the current one. It prints the summary and one line per change,
  and `--json` prints the `VersionDiff`. `--source` compares a variation's
  current version with its source's current version, the pair `choose` is
  about to decide.
- **Web:** "Compare versions" in the item menu, and a compare button on each
  card of the version fan. Both open a lazy side-by-side inspector: before
  and after at one shared scale, the same summary, a numbered change list
  with previous and next (and ←/→), and the decision where one applies.
  "Use vN" sends `item.setCurrentVersion`. On a variation compared with its
  source, "Choose this variation" runs the existing `chooseVariation`. The
  inspector mounts its own React root on the click, so the entry chunk pays
  for one menu entry.

**No new op.** Diffing reads, and the only writes are the two existing
decisions a person can make after reading.

## What was left

- **The quick glance** (a "changed" chip on an item right after an agent
  edits it) needs code on every card, which is the entry chunk. See the
  status line for whether it was built.
- **Pixel diffs for images**, and a rendered-Markdown view with highlights.
  The text view shows the Markdown source with word marks, which is exact but
  less pretty.

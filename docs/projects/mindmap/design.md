# Mind maps — riffing that the rest of the work can read

**28 August 2026.** Asked for as: riff with an agent, get mind maps that are
**files on the system** and that become **context and memory for other work on
the canvas**.

The three requirements are not decoration on a diagram feature. They are the
whole design, and taken seriously they rule out the obvious implementation.

## The fact that decides it: this canvas has no edges

There is no connector, no arrow, no link between items as a canvas fact. The
op vocabulary has none, and that is not an oversight — nothing has needed one.
What relationships exist are narrow and specific:

- `#Title` references **inside a comment body**, resolved at authoring time
  against visible items and stored structurally as ids (`itemrefs.ts`).
- `annotates` — ink that is ABOUT an item (`annotation.ts`).
- A thread anchored to an item.

So a mind map has two possible shapes here, and they are not close.

**A. The map is one item.** Its blob is a text outline; a view draws it as a
map, exactly as `DesignSystemView` draws a DESIGN.md as swatches and type
rather than as the text that declares them.

**B. Nodes are canvas items; edges are a new op type.** The canvas itself
becomes the map.

## Why A, and it is the requirements that choose it

B is the version people picture, and it is wrong for all three of the things
that were actually asked for.

- **"Files on the system."** One item is one file — `set --file`, `isocan
  save`, and the item is on disk with the backing states already built. A
  graph of items is not a file, and making it one means inventing an export
  format, which is a file nobody edits and a synchronisation problem forever.
- **"Riff with an agent."** An agent revising an outline is the highest-
  bandwidth thing a language model does. An agent emitting a dozen `item.add`
  and `edge.add` ops to restructure a map is the same thought expressed in the
  clumsiest available form, and it is not reviewable — you cannot read a diff
  of it.
- **"Context and memory for other work."** Something an agent reads before it
  builds is a document. Reading one markdown file is one command;
  reconstructing a graph from the item table and an edge index is a small
  program, on both surfaces, forever.

And B costs a new op type — a permanent addition to the vocabulary both
surfaces must know, which is the one thing this codebase spends most carefully.

A costs nothing: an ordinary `item.add` with a property. Versioning, undo,
replay, GC, replication, the workbench's source-and-preview split, `#Title`
references pointing INTO it — all of it already works.

## The format: a markdown outline, not mermaid

The map is an indented list.

```markdown
# Lake house

- Booking
  - Checkout day is exclusive
  - Timezone is the browser's, and that is a bug
- Identity
  - Anyone can type any name — trust-the-family, or owners edit?
- The four screens are islands
```

Mermaid's `mindmap` is purpose-built and was the other candidate. The outline
wins on the grounds this repo already uses to pick DESIGN.md's format — adopt
what a person would have written anyway:

- It **degrades perfectly**. A client that knows nothing about mind maps
  renders a nested list, which is still the map. Mermaid degrades to a code
  block.
- It **diffs**. A riff is a sequence of revisions somebody has to be able to
  review; indented prose diffs line by line and mermaid does not.
- It is **writable by hand** in the same file, in any editor, with no tool.
- It needs **no renderer dependency**, which matters here specifically: the
  repo has already thrown out one third-party dependency on the critical path
  (the webfont) and has no mermaid today.

Layout stays out of the file at first. If dragging nodes is wanted later,
positions belong in YAML front matter — the same split DESIGN.md already
makes, where the front matter is normative and the body is the content.

## What makes it a mind map and not a note

One property, the way everything else here marks a role:

    properties: { role: "mind-map" }

`role=design-system` already exists and is the proven pattern — an item the
canvas treats as a document ABOUT the work rather than a piece of it, found by
`designSystem(canvas)`, rendered as itself, and named in the agent guide as
something to read first. A mind map is the same kind of thing with a different
subject, and unlike a design system a canvas may have several.

## Riffing, in the machinery that already exists

- **The conversation is the Chat.** Everything posted there wakes every parked
  agent with no @-mention. That is where riffing happens; no new channel.
- **Each revision is a version.** `item.addVersion`, so the version stack IS
  the history of the riff, and the version fan-out already walks it. Undo is
  the op vocabulary's own. Nothing to build.
- **The rendering is a view**, on the same seam `DesignSystemView` uses: the
  workbench shows the outline in the editor pane and the map in the preview
  pane, side by side, with the splitter. The toggle is not a feature to add —
  it is what every editable item already gets.

## Memory: how it reaches other work

This is the requirement that is easy to nod at and hard to honour, and the
answer is the one the design system arrived at the hard way: **a norm in a
guide is a rule somebody has to remember.**

1. `isocan maps` / `isocan map show` prints the outline, so an agent about to
   build reads it in one command.
2. The agent guide says to read it, as it already says for the design system.
3. The canvas NOTICES — the mechanism `needsDesignSystem` just established.
   The interesting trigger is not "no map exists"; a canvas does not owe
   anybody a mind map. It is **staleness**: a map whose last version predates
   a lot of subsequent work is a map that no longer describes the canvas, and
   saying so is more useful than asking for one to exist.

## What this is not

Not a diagramming tool. There are no arbitrary edges, no crossing links, no
boxes-and-lines canvas — an outline is a tree, and a mind map is a tree. The
day somebody genuinely needs a graph, that is shape B, it needs an op type,
and it should be argued for on its own rather than smuggled in as "mind maps
should really have cross-links".

## The walk

1. **The item and the outline** — `role=mind-map`, `isocan map set/show`, and
   the guide entry. Useful immediately: it is a file, it versions, agents can
   read and rewrite it, and it renders as markdown before any map view exists.
2. **The map view** — draw the outline as a tree, on `DesignSystemView`'s
   seam. This is where it stops being a list.
3. **Memory** — the staleness noticing, and `#Title` references from map nodes
   to the items they are about, which is the thing that makes a map part of
   the canvas rather than a document sitting on it.

Stage 1 is worth having on its own, which is the test of whether the walk is
honest.

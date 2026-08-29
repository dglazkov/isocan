# Mind maps — a real graph on the canvas

**28 August 2026.** Asked for as: riff with an agent, get mind maps that are
**files on the system** and that become **context and memory for other work**.
Revised the same day, after a second requirement: **click and move nodes, with
the arrow links updating** — and an agent that can be told "I am researching
opening a bar for Spurs fans" and go build the map.

The first draft of this doc recommended against a real graph. That was wrong,
and the correction is worth recording precisely, because the mistake was in
the sizing rather than in the reasoning.

## What the first draft got wrong

It weighed the graph option as *"nodes are canvas items and edges are a new op
type"* and rejected it as a permanent addition to a vocabulary this codebase
spends carefully. Both halves of that framing were wrong.

**The nodes already exist.** A text node is an item: positioned, titled,
versioned, undoable, draggable by `item.move`, file-backable, and rendered
chromeless. Everything a mind-map node needs, shipped. The delta was never
"build a graph" — it was "add edges".

**And the edges need no new op type either.** `lineage.ts` already carries
`parent=<itemId>` on an item's properties, written by `item.add` and undone by
undo. A mind map's edges are exactly that shape: a child pointing at a parent.
Properties are `Record<string, string>`, so one id per node is a natural fit.

So the real cost of a graph is a property and a renderer, not a vocabulary
change. The first draft argued against something more expensive than what is
actually being asked for.

## What genuinely changed the answer

Direct manipulation. **Drag a node, and the arrows follow.**

That is not a rendering nicety over an outline — it is structural. For a
dragged node to stay where it was dropped, the position must be a canvas fact,
which means the node must be an item. No amount of effort on an outline view
gets there: an outline has no coordinates to write back to, and inventing them
inside the file makes the file a layout format that a person editing it in an
editor will corrupt without noticing.

That requirement was not in the first ask, and it is decisive.

## The shape

- **A node is a text item.** `kind=text`, which already renders chromeless and
  already carries a size ladder and a face. A map node is a text node that
  points at a parent.
- **An edge is a property on the child**, distinct from `parent`. NOT `parent`
  itself: `lineage` means *made from* — three variations of a screen, a spec
  written from a sketch — and a topic hierarchy is a different relationship.
  Overloading it would make `isocan lineage` report map structure as
  provenance, which is a lie that would be believed.
- **A map is a set.** A forty-node map is forty items, and they appear in
  Files, in `ls`, in counts, and placement runs on each. So a node also
  carries the map it belongs to, and the canvas can then treat one map as one
  thing — show it, hide it, move it, delete it.
- **The arrows are drawn, not stored.** An edge holds two ids; the line is
  derived from wherever the two items are right now. That is what makes the
  links update as you drag, and it means there is no edge geometry to keep in
  sync with anything.

Zero new op types. `item.add` with properties, `item.move`, `item.update`.

## A tree, and cross-links argued separately

A property holds one id, so this is a tree — which is what a mind map is.

Genuine many-to-many links with their own labels want an edge that has its own
identity, so it can be deleted and undone on its own. That is a real thing to
want and it is a different feature: argue it when a tree has demonstrably not
been enough, with the cases that proved it, rather than building the general
version first because it sounds more capable.

## The file, which comes back as a projection

The first draft's best point was that a mind map should be a file. It then
made a mistake in the other direction: it proposed *storing* an outline.

With the map on the canvas, the outline is **derived on demand** — walk the
tree, print it. `isocan map show` renders it; `isocan map save` writes it
where a file is wanted. Because it is a projection rather than a copy, it
cannot drift, which a stored outline would have done the moment somebody
dragged a node.

Worth one refinement over plain indentation: in a terminal, box-drawing
characters make a tree readable at a glance where whitespace does not —

```
Lake house
├── Booking
│   ├── Checkout day is exclusive
│   └── Timezone is the browser's, and that is a bug
└── The four screens are islands
```

— and the terminal is where agents read. It is tens of lines, not a
dependency: the ASCII component libraries that do this (`mdx-graphs`, looked
at 28 Aug) ship React for a shadcn project and render nothing interactive,
which is the wrong half of this feature twice over.

So the requirement is met, and met better, by the option the first draft
rejected.

## What this costs, said plainly

- **Forty items where there was one.** Files, `ls`, counts and trash all see
  them. The `map` property is what keeps that manageable, and it is the real
  new work here.
- ~~**Undo is per-op.**~~ **Paid, 28 Aug 2026.** This said the honest fix was
  grouping in the oplog, worth its own argument rather than something to
  invent inside this feature — and that argument was had and won the same day
  (`LogEntry.group`, and `docs/research/2026-08-28-op-grouping.md`). An agent
  building a map from one sentence is already one `⌘Z`. The cost stands
  recorded because the reasoning is what made the case for grouping, and a
  cost that was paid rather than avoided is worth being able to see.
- **Layout.** An agent producing thirty nodes must place them somewhere
  legible. `fit.ts` already grows items and settles them without collisions,
  and `spotInView` already picks a spot you can see; a radial or layered tree
  layout is new, and it is the piece most likely to look bad first.

## The acceptance test

> "I am researching opening a bar for Spurs fans."

The agent creates a root and a few branches — location, licensing, the
supporter's club, match-day logistics — and children under them. On the
canvas: real nodes, arrows, draggable, rearrangeable by hand. Later, another
agent asked about the licensing question reads the map as context. And
`isocan map show` prints the outline for anything that wants text.

Every step of that is items, properties and moves.

## The walk

1. **Nodes and edges** — the map and edge properties, `isocan map add/link`,
   and lines drawn between items. Draggable from the first day, because
   dragging is `item.move` and already works.
2. **A map is one thing** — the set: show, hide, move, delete as a unit.
3. **Layout** — an agent-built map that lands legible rather than in a pile.
4. **The projection** — `map show` / `map save`, and the map as context for
   other work, which is where this meets `docs/projects/context/`.

Stage 1 is a graph you can drag, which is the thing that was asked for.

## Built, 29 Aug 2026 — stages 1, 2 and 4

`core/mindmap.ts` holds the whole model: `map` and `mapParent` properties,
`mapsOn`, `mapEdges`, `mapRoots`, `mapOutline`, and `edgeAnchors`. The CLI has
`map new | add | link | show | ls`; the canvas draws the lines. **Zero new op
types**, as designed — `item.add` with properties and `item.update`.

Stage 2 came free with the `map` property: `map ls` treats a map as one thing
because the set is a query, not a structure to maintain. Stage 4's projection
is `map show`, derived every time, which is why it cannot drift.

**Stage 3 (layout) is deliberately partial.** A child lands to the right of
its parent and stacks under its siblings — enough that an agent building
thirty nodes produces something legible rather than a pile, which was the
stated risk. A radial or balanced tree layout is still unbuilt, and the honest
reason to wait is that nobody has yet dragged a real map into a shape that
says what the automatic one should have been.

**Two things the design did not anticipate, both found by running it:**

- **A cycle has no roots.** `mapParent` is a string, so two `item.update`s can
  make A the parent of B and B the parent of A. The walk terminated — that was
  guarded from the start — but printed NOTHING, because the outline starts
  from roots and a pure cycle has none. A map whose nodes all vanish from the
  outline reads as "the map is empty" while it sits on the screen. The oldest
  node is used as a way in now, and the loop is marked where it closes.
- **A zero-sized SVG clips its own painting.** The lines had correct layout
  boxes, correct strokes and correct positions, and did not appear. Proved by
  turning the stroke red and 6px wide and still seeing nothing. `overflow:
  visible` does not save an SVG root; the box is measured from the lines now
  and the `viewBox` carries the world origin.

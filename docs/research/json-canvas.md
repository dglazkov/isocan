---
status: partial
since: 2026-08-30
issue: 154
note: export built; import deliberately not, and the edge question is answered
---
# JSON Canvas: what adopting it would mean

**22 August 2026** · [full write-up](https://claude.ai/code/artifact/e764ed1d-0d76-426f-8667-8aff6b648ef2)

JSON Canvas ([jsoncanvas.org](https://jsoncanvas.org), Obsidian, MIT) is the open
file format for infinite canvases. Its coordinate model is ours almost exactly.
This is what a real conversion costs, and what edges would mean.

## The format, in full

Two arrays. Nodes carry `id`, `type`, `x`, `y`, `width`, `height` and an optional
colour (hex, or one of six preset numbers). Four node types: `text` (inline
markdown), `file` (a path), `link` (a URL), `group` (a titled region). Array
order is z-order — first is furthest back. Edges carry `id`, `fromNode`,
`toNode`, optional `fromSide`/`toSide` (top/right/bottom/left), optional
`fromEnd`/`toEnd` (`none`/`arrow`), colour and label. That is the whole spec.

## How it maps to us

| JSON Canvas | isocan | |
| --- | --- | --- |
| `x, y, width, height` | `item.x/y/width/height` | exact — same units, same origin |
| array order = z | selection/drag raise z | close; export writes current order |
| `file` node | item + blob | maps (theirs is a path, ours a content hash) |
| `link` node | `text/uri-list` item | maps — the projected-site item is exactly this |
| `text` node | — | no home; would become a markdown item |
| `group` node | — | **no grouping primitive at all** |
| node `color` | — | colour here belongs to people, not items |
| `edges` | — | **the whole question** |
| — | versions | not in the format |
| — | comment threads | not in the format |
| — | actors, timestamps | not in the format |
| — | properties (`kind`, `parent`, `annotates`, `region`, `star`, `role`) | not in the format |
| — | the oplog | not in the format |

## What a real conversion costs

I wrote the converter and ran it against a working canvas rather than reasoning
about it:

- **12 nodes** from 12 items — every rectangle, in place
- **0 edges**, because that canvas has no `parent` or `annotates` to project
- **26 versions** dropped; only the current one survives
- **6 threads** carrying **48 comments** dropped
- **5 actors** dropped — the format has no author field
- every property dropped, including the starred item

Proportions: **2,173 bytes** as `.canvas`, **54,328** as our state file,
**94,325** of oplog, **15 MB** of blobs. The file carries the arrangement —
about four per cent of the state and none of the history.

**So: a good export, a bad storage format.** "Just store canvases as `.canvas`
and get interop free" would cost versions, conversation, authorship and undo.

## Edges, which is the real question

Strip the interop away and one thing in that spec is genuinely missing here: a
way to say two things are related, and how. We have two relationships and both
are implicit — `parent=<itemId>` (visible only when `/format` runs) and a
thread's anchor (relates a conversation to a thing, never two things).

**Buys:** diagrams become possible at all; lineage becomes visible instead of
folklore; agents get a vocabulary for structure; and edges are half of JSON
Canvas, so without them an export is a bag of rectangles.

**Costs:** three ops (28 → 31) with inverses; a referential-integrity rule
(edges should travel into the trash with their item and return on restore, which
is what annotations and versions already do); routing, arrowheads and labels
that stay legible while the canvas zooms — an edge label is every counter-scale
problem this codebase has hit, at once; a drawing gesture, which means another
tool and a hit-test surface on four sides of every item; and a vocabulary risk,
since `parent` would become a second way to say a relationship.

**Resolution I would argue for:** `parent` stays, because it is recorded
atomically when the item is created (one op, one undo), and it *projects* to an
edge in the view and on export. One direction of truth: property → edge, never
back.

**The product question underneath:** edges make this, a little, a diagramming
tool — a crowded category with Figma and Miro in it, and not what the vision is
about. So the honest question is not "should we support edges" but "do we want
the relationships we already have to be visible".

## Three ways to adopt

1. **Export only** (~1 day) — every item a `file`/`link` node in place, `parent`
   and `annotates` projected to labelled edges, and the command *prints what it
   dropped*. Buys the property that matters most: a canvas can leave.
2. **Import as well** (2–3 days) — `file` nodes look for the file beside the
   `.canvas`; `link` becomes a projected site; `text` becomes a markdown item;
   `group` has no answer, so drop it with a note rather than inventing a
   primitive to satisfy an import.
3. **Edges as a native primitive** (1–2 weeks) — for their own sake, not because
   a file format has a field for them. If it happens, export gets better free,
   which is the correct order of causation.

## Where this stands, 30 Aug 2026 — export BUILT, and edges answered

`isocan export <file>`, `toJsonCanvas` in core. Geometry crosses unchanged.

**The edge question this note left open has been answered by other work.** It
said edges were "the whole question" because isocan had no relationship
primitive. Mind maps shipped on 29 Aug and settled it without deciding
anything about visibility: an edge is a PROPERTY (`mapParent`), so a canvas
holding a map exports as a real graph. Verified end to end — a map built on a
scratch canvas came back as two `toEnd: "arrow"` edges — and the product
decision this note flagged never had to be taken, because the primitive
arrived from the other direction.

**Import is deliberately not built and is not next.** The format carries no
versions, no threads, no actors, no timestamps, no properties and no oplog, so
reading one in would mint a canvas whose history begins at import. That is a
different feature with a different argument, and the export counts what it
could not carry and prints it: *"the format has no room for 28 older versions,
6 comment threads, 4 properties — this is not a backup."* An export that
quietly drops half a canvas is the worst kind of success, because it looks
like one.

The `json-canvas` skill this note also recommended importing is untouched.

## Recommendation

Ship export this week; import the `json-canvas` skill now (one line, MIT); then
decide whether relationships should be *visible* — that is a product decision,
and everything about edges follows from it while nothing about it follows from
the spec.

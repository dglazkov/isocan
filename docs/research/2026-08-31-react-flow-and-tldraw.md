---
status: noted
since: 2026-08-31
see: mindmap, ui-refresh
note: measured both libraries; React Flow is a real option for the map only, tldraw collides with the oplog
---
# React Flow and tldraw, measured rather than remembered

**31 August 2026.** Asked directly: should the canvas be rebuilt from the
ground up on React Flow or tldraw, and what would it cost?

Everything below was taken from the packages themselves — installed, read,
and bundled — rather than from memory or marketing. The numbers are
reproducible in ten minutes and the method is at the end.

---

## What we are actually running today

Worth stating first, because the question presumes a library and there isn't
one.

**isocan has no canvas library.** `packages/web/package.json` lists React,
react-dom, react-router-dom, zustand, CodeMirror, react-markdown, parse5.
The infinite canvas — pan, zoom, selection, drag, marquee, the minimap, the
offscreen indicators, the ink layer, presence cursors, the comment pins — is
all hand-written. 61 components, ~14,700 lines including `CanvasPage`.

That is the thing a rewrite would replace, and it is also why the mind map
looked plain: nothing was inherited, so nothing was inherited for free.

---

## The measurements

| | React Flow | tldraw |
| --- | --- | --- |
| Package | `@xyflow/react` 12.11.5 | `tldraw` 5.3.2 |
| Licence | **MIT** | **Custom** — "SEE LICENSE IN LICENSE.md" |
| Direct deps | 3 | 16 |
| Installed size | 4.0 MB | 36 MB (`tldraw` + `@tldraw/*`) |
| **Added to our bundle** | **+59 KB gz** | **+533 KB gz** |
| Freehand ink | none | yes, it is the core competence |
| Owns undo/redo | no | **yes** (`HistoryManager`) |
| Owns the document | no | **yes** (`Store`, `StoreSchema`) |

The bundle figures are an esbuild production build of a trivial app against a
React + react-dom baseline of 59 KB gz. React Flow is measured with
`Background`, `Controls` and `MiniMap` mounted — roughly what we would use.

**For scale: the entire isocan app is 484 KB gz today.** React Flow is +12%.
tldraw more than doubles the whole application, before a single isocan feature
is added to it.

### The licence is not a footnote

tldraw does not ship an SPDX licence. It ships `LicenseManager` and
`watermarks.js` inside `@tldraw/editor`, and the license states in the built
code are explicit:

```
no-key-provided   licensed   licensed-with-watermark
expired           evaluation invalid-license-key
```

with `localhost` / `development` / `production` environment detection beside
them. `<Tldraw licenseKey={...} />` is in the public type definitions. In
plain terms: **unlicensed production use is watermarked**, and removing the
watermark is a commercial arrangement. That is a legitimate business model
and it is a decision for a person, not a technical detail to discover later.

---

## Why the shape of the collision matters more than the size of it

isocan's rule is not "React renders a canvas". It is:

> Every shared fact is an Operation either surface can send, applied by one
> reducer. A rule one surface enforces and the other does not know is a habit,
> not a rule.

Three consequences decide this entire question:

1. **Item position is an op.** `item.move` is one of twenty ops, it goes in
   the oplog, it replicates, and `isocan mv` sends the same one the browser
   does.
2. **Undo is the home's**, not the client's. The daemon rebuilds an
   actor-scoped stack from the oplog and applies *stored inverses computed
   against the state each op was applied to*, repairing or skipping the ones
   another actor invalidated (`server/undo.ts`). A tab holds none of that.
3. **The canvas holds things that are not shapes** — screens that are live
   HTML in frames, sites in iframes, markdown documents, uploads, videos,
   comment threads, presence cursors. `ItemKind` is `document | drawing |
   image | other | screen | site | text | video`.

A canvas library that wants to own positions, history, or the document model
is not a rendering choice. It is a second claimant to the thing the whole
project is built on.

---

## React Flow

**What it actually is:** a controlled React component for node-and-edge
graphs. It does not own your data. You pass `nodes` and `edges`, and it hands
back a change list:

```ts
type NodeChange =
  | NodeDimensionChange | NodePositionChange | NodeSelectionChange
  | NodeRemoveChange | NodeAddChange | NodeReplaceChange
```

**That vocabulary is startlingly close to ours.** `NodePositionChange` is
`{ id, position, dragging }`, and the drag handler emits `dragging: false`
exactly once at `onDragStop`. Which is precisely the shape isocan already
has: ride the gesture locally while `dragging` is true, send one `item.move`
when it goes false. The adapter is not a fight; it is a translation between
two vocabularies that were designed for the same reason.

Also verified: `viewport?: Viewport` means the host can keep owning the
camera, and `nodeTypes` maps a type string to **any React component**, so a
screen in an iframe is a legal node.

**Against it:**

- **It is a graph editor, not a canvas.** No freehand ink (`grep` for
  freehand in the bundle returns nothing), no shape tools, no text editing.
  Everything isocan draws that is not a node stays hand-written.
- **It brings a second pan/zoom.** d3-zoom, d3-drag, d3-selection,
  d3-transition all arrive as transitive deps — for capability we already
  have and would have to switch off or reconcile.
- **A second zustand.** It depends on `zustand@^4.4.0`; we are on `^5.0.3`.
  npm resolves that as two copies. Not fatal — its store is internal — but it
  is duplicate weight and a version split to remember.
- **Handles and connectability are its model of the world.** Our edges are
  derived from a `mapParent` property; its edges are first-class objects with
  source/target handles. Bending one into the other is work that buys nothing
  unless we want user-drawn connections.

---

## tldraw

**What it actually is:** a complete whiteboard application with a document
model. `Store`, `StoreSchema`, `HistoryManager` with its own `undo()` and
`redo()`, and its own record types — `TLShape`, `TLPage`, `TLInstance`,
`TLCamera`. Custom shapes are written by extending `abstract class ShapeUtil`
and living inside that store.

**It is genuinely excellent at what isocan does not have:** real freehand ink
with pressure, a shape system, text editing on canvas, snapping, and a
polished feel that would take a long time to reproduce.

**Against it, and the objection is structural rather than aesthetic:**

- **Two owners of truth.** tldraw's store is the document and its
  `HistoryManager` is the undo stack. isocan's oplog is the document and the
  daemon owns undo. There is a sync seam — `store.listen` and
  `mergeRemoteChanges` are the real integration points — but using it means
  running two document models and reconciling them forever, which is the
  distributed-systems cost `personas` step 6 was deliberately deferred to
  avoid paying for less reason.
- **`⌘Z` would have two meanings.** tldraw would undo locally and immediately;
  isocan undoes actor-scoped, on the home, with repaired inverses. Whichever
  one wins, the other surface disagrees — and `isocan undo` in a terminal is
  the case that makes it undeniable.
- **The CLI cannot participate.** A `TLShape` in a tldraw store is not
  reachable by `isocan mv`. Keeping the CLI equal means projecting ops into
  tldraw and tldraw's changes back into ops — the same two-implementations
  problem this repo has spent the week removing in smaller places
  (`isocan history` vs the lens; the Share dialog's fourth roster).
- **The licence**, above.
- **+533 KB gz.**

---

## The recommendation

**Do not rebuild the canvas on either.** Not because either is bad — React
Flow is genuinely well-built and tldraw is better at whiteboarding than
anything we would write — but because the canvas is not the expensive part.
The expensive part is the op vocabulary, the reducer, the oplog, undo,
replication and presence, and **no canvas library provides or replaces any of
it.** A rewrite pays full price for the part we have and inherits a fight over
the part we care about.

The size of the prize is also smaller than it looks. What actually prompted
this was that the mind map looked plain, and the two things wrong with it were
straight lines and no layout. The lines were **twelve lines of bezier** in
`MapEdges.tsx` (shipped, 31 Aug). Layout is mindmap stage 3, already designed
and deliberately deferred. Neither needed a library.

**Where React Flow would be a real, honest option:** if mind maps grow into
something people build graphs in — user-drawn edges between arbitrary nodes,
handles, connection validation, auto-layout — then React Flow *for the map
view only*, as a component rendering a projection of canvas items, with
`onNodesChange` translated into `item.move`. It is controlled, it is MIT, it
is +59 KB, and its change vocabulary already maps onto ours. That is a
contained, reversible experiment; a ground-up rewrite is not.

**What to take from tldraw without taking tldraw:** the feel. Its ink is
better than ours, its snapping is better than ours, and both are worth
studying and stealing at the level of behaviour rather than dependency.

---

## What would change this answer

Recorded so the next person can check whether the ground has moved rather
than re-deriving it:

- **isocan stops being isomorphic.** If the CLI were ever demoted from an
  equal client, tldraw's objection collapses to licence and bundle size.
- **User-drawn edges become a real feature.** That is React Flow's home
  ground and the point where writing it ourselves stops being cheaper.
- **tldraw changes its licence**, or we buy one. The structural objection
  survives that, but it stops being three objections.
- **We need ink to be excellent.** The pen is currently ours and adequate. If
  drawing became the product, the calculus changes.

---

## Method, so this can be checked

```sh
mkdir libprobe && cd libprobe && npm init -y
npm i @xyflow/react tldraw esbuild react react-dom
# a trivial app per library, then:
npx esbuild src/x.jsx --bundle --minify --format=esm \
  --define:process.env.NODE_ENV='"production"' --outfile=out.js
gzip -c out.js | wc -c
```

**One measurement was wrong on the first attempt and is worth recording.** An
early run reported React Flow adding 3 KB, which is absurd on its face. The
baseline imported `react-dom` and the React Flow case did not, so two
different programs were being compared and their totals coincidentally
matched at 189 KB. `esbuild --analyze` showed React Flow's modules present but
react-dom absent, which is what exposed it. A number that flatters a
conclusion deserves the same suspicion as one that contradicts it.

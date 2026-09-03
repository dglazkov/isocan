---
status: partial
since: 2026-09-02
see: on-demand, standing-agents
note: phases 0–3 built 2 Sep, and phase 4's half — the card drawn live one level deep, ↗ and double-click open a tab, `isocan canvas place`, the popup from the rail and ⌘K, `isocan canvas shot --into` as the picture that survives a refused pull, the miniature wherever thumbnails are, and "lives at another home" said on the card; pulling a picture across homes is not built
---
# Canvas Inception

**2 September 2026.** A design, written before anything is built, so the
roadmap can carry it. As asked: *a way to add a canvas to a canvas, so it
opens a tab to it — a bit like a Google Doc, but you screenshot the canvas
and place it as an embed that links to it. The UI to add one should be a
popup that lets you search your canvases or put in a URL to one.*

The short version. **A canvas on a canvas is an item**, the way a site and a
post-it are: an ordinary `item.add` whose blob is the other canvas's address
and whose properties say which canvas it is. The card **shows the other
canvas small** — drawn live from its snapshot, the way the lens and the card
peek already draw items small, so it is never a stale picture — and **opens
it in a tab** on a double-click or its ↗, because a canvas is a place you go,
not a thing you look at through a hole. A **screenshot is the fallback**, not
the mechanism: a real PNG, taken by the browser the graders already run,
stored as a version of the same item, for the reader who is not admitted to
the other canvas or is offline. The popup is one dialog with two doors —
type to search your canvases, or paste an address — and the CLI does the same
with one verb, so an agent can lay out a person's canvases the way it lays
out a sprint. No new op type; one property; one component.

This is the third time the same shape has come up in a week — a Google Doc as
an item that holds a snapshot and a link
([research/2026-09-02-google-docs-on-the-canvas.md](../../research/2026-09-02-google-docs-on-the-canvas.md)),
a desk as a canvas that knows its sprint
([sprint](../sprint/journey.md)), and now a canvas as an item — and the
answer is the same each time: **the canvas holds what it can render, points
at what it cannot, and a ↗ takes you there.** This document leans on the
first of those for the ↗ and the `source` property; if that lands first,
this project inherits it.

## What it is, on the wire

| Thing | How it is spelled | Why not something new |
| --- | --- | --- |
| The item | `item.add` with a `text/uri-list` blob holding the canvas's address (`canvasUrl(origin, id)`), the shape a site item already has | Undo, versions, copy, `--in`, GC all come free; an older build renders the generic file card instead of breaking |
| Which canvas | `properties.kind = "canvas"`, `properties.canvas = <canvas id>`, and `properties.source = <address>` (the ↗) | A property is one fact; `kind` is how `itemKind` already tells a text node from a document |
| Its title | The item's title, set to the canvas's title at placement and refreshed by whoever renders it | A rename on the other canvas should reach the card; the item's own title is what `ls` and `#Title` read |
| The picture | Drawn live in the app from the other canvas's snapshot; **optionally** an `image/png` version added later by a screenshot run, which the card prefers when it cannot fetch | Live is honest and free; the PNG is for the cases live cannot serve |

`core/canvasitem.ts` holds the contract both surfaces read: `CANVAS_KIND`,
`isCanvasItem`, `canvasIdOf`, and `canvasItemBlob(origin, id)` — the same
arrangement `browseritem.ts` gives sites.

## How it looks and behaves

**The card.** A framed item, the size of a screen by default (800×600), with
the other canvas's title on its strip and the canvas drawn small inside: its
items as rectangles at their positions, images and screens as their
thumbnails, text as its words, areas as their sheets — `ItemThumb` for each,
laid out by the same scale-to-fit the minimap uses. It is a picture of a
place, and it reads as one: you can tell a busy canvas from an empty one and
a board from a pile at a glance. Under the strip, one line: *14 items · 2
here*, the last from the presence the home already publishes.

**Opening it.** Double-click, or the ↗ on the strip, opens the canvas in a
new tab — the same gesture a site item's ↗ makes and the Google Docs note
proposes. Never in place: a canvas inside a canvas inside a canvas is a
maze, and a tab is where a place belongs. Enter, with the card selected, does
the same.

**Live, and one level deep.** The card pulls the other canvas's snapshot on
mount and every thirty seconds while it is in view — the desk chip's
bargain: a picture that can be half a minute stale and a title that arrives
within one. A canvas item drawn *inside* a miniature is drawn as a plain
card with its title, never as a further miniature: one level, so a canvas
that contains itself, or two that contain each other, is a card and not a
recursion.

**When it cannot be drawn.** Somebody not admitted to the other canvas gets
its title, the ↗, and the last screenshot if the item has one — and the
door on the other side says the rest. A canvas at another home is the same
case until phase 4. Offline, the screenshot or the title. The card never
draws a blank rectangle with no explanation; that is the site item's first
lesson.

**The popup.** One dialog, reached from the rail's ＋, from ⌘K (*Place a
canvas…*), and from pasting a canvas address onto the canvas. A search field
at the top: type and the list narrows over your canvases — the ones `isocan
canvas list` shows, most recent first, each with its title, its last act and
its own small picture — pick one and it lands where you were pointing. Or
paste an address: the field recognises `/p/<id>` at any origin, resolves it
(your own home answers with the title; another home answers what it will),
and offers the same *Place* button. Two doors, one gesture, one item.

**In the lens and the card peek.** A canvas item's thumbnail is its
miniature, so the home screen's peek shows *Maya placed “Sports schedule”*
with the canvas drawn small — which is what makes a canvas of canvases
readable from the outside.

## The terminal has the same thing

- `isocan canvas place <ref|address> [--at | --in <area>] [--size]` — ref is
  an id or a title prefix among your canvases, or a full address; lands the
  card, prints its id. The web popup calls nothing this does not.
- `isocan canvas shot <ref> [--out]` — a real screenshot of a canvas at a
  stated zoom, through the headless browser `scripts/lib/browser.mjs`
  already keeps for the graders and the journeys; `--into <item>` adds it as
  a version of a canvas item, which is how the fallback picture is made and
  kept fresh by a nightly.
- `isocan ls --kind canvas` lists them, because `itemKind` knows the kind.

## What it is for

A home for a person's canvases, organised on a canvas: sheets as the
shelves, canvas cards on them, an agent that keeps the cards' pictures and
titles current and places new canvases where they belong. Pointing at a card
says what is in it; opening it goes there; coming back is the tab you left.
The same shape holds a team's canvases, a client's, a week's.

## Journey, in four scenes

**1 — Place one.** Maya, on *Season planning*, presses ＋, types *sched*,
sees *Sports Schedule Constraint Solver* with its small picture and *Beckham
replied · 4d*, presses Place. The card lands where she was pointing, drawn
live. She double-clicks it; a tab opens on that canvas. Back on the first tab
the card still shows the second canvas, small.
*Acceptance:* one popup, two keystrokes and a click; the card is a live
miniature; opening is a tab; `isocan ls --kind canvas` lists it.

**2 — Paste one.** Ravi pastes `https://isocan.io/p/prj_…` from a message
onto his canvas. The popup opens on the address, resolves the title, and
Place lands a card. He is admitted, so it draws; his teammate who is not
sees the title and the ↗, and the door on the far side.
*Acceptance:* an address is a door into the same popup; a reader not
admitted gets title and link, never a blank.

**3 — An agent shelves them.** Kit runs `isocan canvas place` for each of
Maya's twelve canvases, `--in` the sheet whose name matches each one's
project, and `isocan canvas shot --into` each card nightly. Maya's *All my
canvases* canvas reads as a wall of small canvases, current each morning,
with a picture even when she is on a plane.
*Acceptance:* both verbs; cards land inside sheets; a PNG version is
preferred when the live pull fails.

**4 — From the outside.** On the home screen, the card peek for *Season
planning* shows *Maya placed “Sports Schedule…”* with the miniature; the
lens shows the same under Maya's name.
*Acceptance:* `ItemThumb` draws a canvas item as its miniature everywhere
thumbnails are drawn.

## Phases, in dependency order

0. **The item and the card.** `core/canvasitem.ts`; the card drawn live from
   the other canvas's snapshot, one level deep, with title, count and ↗;
   double-click opens a tab; `isocan canvas place`. Proof: scene 1 without
   the popup, placed from the terminal.
1. **The popup.** Search over your canvases with their small pictures, or an
   address; from ＋, ⌘K and paste. Proof: scenes 1 and 2.
2. **The picture that survives.** `isocan canvas shot`, `--into` as a version,
   the card preferring it when the pull fails; a nightly the way the graders
   run. Proof: scene 3's second half.
3. **Everywhere thumbnails are.** `ItemThumb` for canvas items; the lens and
   the peek. Proof: scene 4.
4. **Another home.** Resolving an address at a home that is not this one for
   title and, when admitted, the picture — the `homeOf` walk the CLI already
   makes. Proof: scene 2 across homes.

## What was built

**Phase 0, 2 September 2026.** `core/canvasitem.ts` — `kind=canvas`,
`canvas=<id>`, `source=<address>`, and `canvasItemOf(origin, id)` as the one
spelling both surfaces write; `itemKind` answers `canvas` above the mime
tests, the way it answers `text`. The card (`web/components/CanvasCard.tsx`)
pulls the other canvas's snapshot on mount and every thirty seconds while on
screen and draws it as a picture of a place — every item a block at its
position in its kind's colour, images as themselves, sheets as washes, up to
a hundred and twenty of them — under a head with the title, the count and
who is there; one level deep, a canvas inside the picture is a block; a
refused pull says so in words. Double-click and the ↗ on the strip open the
address in a new tab, and the ↗ is general: any item with a `source` wears
one. `isocan canvas place <ref|address>` places one by id, title prefix or
address, refuses the canvas itself, and takes `--in` and `--cell` like
everything else. Proved in `core/test/canvasitem.test.ts`,
`web/test/inception.test.ts`, `cli/test/place.test.ts` over a real daemon,
and by eye: *Lake House · 16 items · 1 here*, its screens and photos where
they are, opened in a tab on a double-click.

**Phase 1, the same day.** The popup (`web/components/PlaceCanvas.tsx`): a
button on the rail beside Add site and *Place a canvas…* in ⌘K open one
popover through one shared state; type and the list narrows over your
canvases, most recent first, each with its last act; paste a `/p/<id>`
address at any origin and it is the one row offered, with the home's title
when it knows one. Placing lands the card where there is room in view,
through `addCanvasItem`, which reads the same contract the terminal does.
The third door the design named — pasting an address straight onto the
canvas — is not built: the app's ⌘V reads its own clipboard, not the
system's, and reaching the system clipboard is a permission question worth
its own decision.

**Phases 2 to 4, the same day, smaller than designed.** `scripts/canvas-shot.mjs`
takes a real PNG of a canvas as the app renders it — through the door as
*Camera*, fitted with ⇧1, captured by the graders' headless browser — and
`isocan canvas shot <ref> --into <item>` lands it as a version of the card;
the card shows it **under the words when its own pull is refused**, and never
instead of a live picture it can draw. `ItemThumb` draws a canvas item as its
miniature, so the lens, the files panel and the card peek show one the way
the card does. A canvas at another home is recognised from its address and
the card says *lives at …* with the ↗ still there, rather than asking a door
this home cannot answer for; pulling its picture across homes, the rest of
phase 4, waits on the same homes walk the CLI makes and is not built.

**Zero new op types**, the target every project here has met so far; the one
place that might want one is none. **Both surfaces**, held by the tests that
already hold every other verb. **The record is never hidden**: a card is an
item and says which canvas it points at in a property anyone can read.

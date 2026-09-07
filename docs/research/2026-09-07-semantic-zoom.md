---
status: designed
since: 2026-09-07
issue: 203
see: ui-refresh, mindmap
note: the canvas already does four kinds of zoom-responsive drawing and every one of them SUBTRACTS — the thing maps actually do is substitute, and that needs a unit to substitute for
---

# Semantic zoom: what a canvas becomes when you stand back

**7 September 2026.** Research. Nothing built.

> "When zooming out can you group items with semantics on top… like when you
> zoom out in google maps and you don't see every road name, but you get a
> different level of information (town, city, state, country). What could this
> look like on a canvas product like this?"

## What maps actually do, stated precisely

The instinct to check first, because it decides everything after it: **a map
zoomed out is not a map with things hidden.** Portland at z12 is a street
network; at z6 it is a dot and the word *Portland*; at z4 it is inside a shape
labelled *Oregon* and the dot is gone. The streets were not faded — they were
**replaced by something that stands for them**, and the replacement is a
different object with a different name.

That is the whole difference between what this app already does and what is
being asked for.

## What isocan already does, and why it is not this

Four behaviours change with zoom today. They were written separately, they use
four different thresholds, and **every one of them subtracts**:

| Where | Rule | What happens |
| --- | --- | --- |
| `core/textnode.ts` | `textIsLegible` — under 5 screen px | a text node's words become a `T` mark |
| `web/lib/chrome.ts` | `hasRoomForChrome` — `MIN_CHROME_WIDTH/HEIGHT` | title and badges disappear |
| `web/lib/chrome.ts` | `underRowSpellsItOut` — `FULL_LABEL_ROOM` | the under-row abbreviates |
| `themes/*.tsx` | `(scale - 0.1) / 0.4` | the ground fades out |

The codebase is already aware they are one idea. `textnode.ts` says so:

> the canvas already keeps a rule of exactly this shape for item chrome —
> `hasRoomForChrome` drops a label and badge when an item is too small on
> screen — so this is that discipline reaching the words themselves.

**So the gap is not zoom-responsiveness. It is aggregation.** Nothing in the
app knows what a *set* of things becomes when the set is too small to read.
Zoom out far enough today and you get forty grey marks where forty screens
were: honest, and no more useful than the smear it replaced.

One more thing already exists and is worth naming, because it is the same
question answered once: **the minimap is a semantic zoom.** It draws the whole
canvas as coloured rectangles by kind family — made here, brought in. It is
what this canvas looks like at its smallest, and it was designed on exactly the
reasoning this note needs: *at two pixels a rect can carry a group and cannot
carry a category.*

## The thing that has to be decided first

**A canvas has no canonical hierarchy, and a map does.**

Portland is in Oregon is in the USA, always, for everybody. A canvas has two
structures and neither is that:

- **Areas** (`core/area.ts`) — sheets. Spatial containers with a title, a card
  and a box. Things are *on* a sheet.
- **Lineage** (`PARENT_PROP`) — a tree, but a tree of *where a thing came
  from*, not where it sits. `isocan tidy` hangs children under parents, which
  makes the canvas "a tree instead of a pile".

They can disagree, and both are optional. Most canvases have neither.

This is the trap the whole feature turns on: **the obvious move is to invent a
third grouping — cluster nearby items at zoom-out and label the cluster — and
it is wrong.** A cluster invented at render time has no box until it is
invented, so its label appears somewhere nobody put anything; it changes as you
pan; and the thing it names has no identity, so you cannot click it, link to
it, or have an agent act on it. It would be an animation, not information.

**Aggregate only over things that already have a box and a name.** That is
areas today, and it means the honest first version helps exactly the canvases
that are already organised — which is also the population it helps most.

## What it could look like

Four rungs, each triggered by **how big the thing is on YOUR screen**, never by
an absolute zoom level. That is already the app's pattern (`worldSize * scale`)
and it is the reason the rules compose: a big sheet and a small one stop
showing their contents at different zooms, correctly.

| Rung | When | An item | A sheet |
| --- | --- | --- | --- |
| **1. Itself** | large | the real thing — screen, drawing, words | its contents, drawn |
| **2. Card** | medium | title, kind mark, chrome | contents, chrome thinning |
| **3. Mark** | small | a glyph in its own box (`T`, a kind icon) | contents as marks |
| **4. Name** | tiny | *nothing of its own* | **the sheet's title, its tint, and a count** |

**Rung 4 is the whole feature and everything above it already exists.** When a
sheet's contents have all become marks, the sheet stops drawing forty dots and
draws what it is: *Lake House · 8 screens*. That is the Portland moment — a
substitution, with a name, in a box somebody actually placed.

A canvas with no sheets gets rungs 1–3, which is what it gets today. That is
the honest floor: this feature rewards structure rather than inventing it.

### What the count should count

*8 screens* is more useful than *8 items*, and the fold for it already exists —
`kindFamily` (made here / brought in) and `itemKind`. A sheet of one kind can
say the kind; a mixed sheet says the total. Nothing new to decide, and the
minimap already made this choice once.

## Decisions

**D1. It is a view state, not a fact on the canvas.** No op, no property, no
stored zoom level. Two people looking at one canvas are at different zooms, and
what each sees is theirs. The op vocabulary stays at 33.

**D2. Rungs are per-thing, from screen size — never a global "zoom level".**
Absolute levels are what a map can have because a map has one scale. Here they
would make a large sheet and a small one behave the same at the same zoom,
which is the opposite of the point.

**D3. Aggregate only over things with their own box and name.** Areas now;
lineage later if a canvas is a tree; **never** an invented cluster (see above).

**D4. A collapsed sheet is still a thing you can act on.** Click it, and the
sensible act is to zoom into it — the same gesture as clicking a country on a
map. It keeps its id, so a link, a mention, and an agent's `--in` all still
mean it.

**D5. The smallest rung must agree with the minimap.** Both answer "what does
this canvas look like when it is tiny", and two different vocabularies for one
question is the drift this codebase keeps writing lessons about. If the
minimap shows kind families in ochre and teal, a rung-4 sheet should not
invent a different colour language.

**D6. Nothing pops.** The thresholds want hysteresis or a fade; a rung that
flips on the exact pixel will flicker when somebody rests at that zoom, and the
existing rules have this bug latent today.

## The phases

**Phase 1 — one rule, four thresholds.** Before adding anything: put the four
existing zoom rules behind one shared vocabulary in core, and give them the
hysteresis of D6. No visible change beyond the flicker. This is the phase that
makes the rest cheap, and it is worth doing even if nothing below it is ever
built.

**Phase 2 — a sheet draws its name.** Rung 4 for areas: title, tint, count.
The whole visible feature, and it lands on the canvases that already use
sheets.

**Phase 3 — the count says what.** Kind-aware counts through `kindFamily`, and
agreement with the minimap's colours per D5.

**Phase 4 — click to descend.** Clicking a named sheet zooms to fit it. Cheap
once phase 2 exists, and it is what makes the thing feel like a map rather than
a legend.

**Phase 5 — lineage, if a canvas is a tree.** Only if phase 2 shows people
want it: aggregate `PARENT_PROP` children under a parent that is itself an
item. Deliberately last, because the tree is about provenance and using it for
display would be a second meaning on one structure — the `archive` mistake.

## What this leaves open

- **Does a sheet ever aggregate on its own, without being small?** A sheet of
  four hundred items is unreadable at any zoom. Possibly rung 4 should trigger
  on CONTENT density as well as screen size — but that is a second trigger and
  it should wait until the first one is real.
- **Text nodes are already rung 3 and have no rung 4.** A wall of sticky notes
  is exactly the case people will try this on, and they are usually not on a
  sheet. This is the strongest argument for phase 5, or for a way to make a
  loose set into a sheet cheaply.
- **What happens to a comment pin at rung 4?** Pins are already drawn outside
  the item they belong to. Not thought through here.

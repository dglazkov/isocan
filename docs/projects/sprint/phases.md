# The sprint board: implementation phases

[`journey.md`](journey.md) is the ideal and the acceptance suite; this is the
walk. Each phase is a discrete amount of work that ends in a scene playing,
and the demonstration is named up front. How the work runs is defined once,
in [`../multiuser/phases.md`](../multiuser/phases.md) — the conductor model,
one subagent per phase, the conductor verifying the named proof itself — and
applies here unchanged.

**Phase citations name their project:** *sprint phase 2*, never a bare
number.

**The order is the order of dependency, not of the week.** Areas come first
because every later phase places something in one. The board comes second
because it is the thing `/sprint` shows. The walk, the desk, the wall, the
grids and the run follow, each closing a scene.

**Two laws every phase is held to.** *Both surfaces*: a button in the app is
a verb in the CLI, and the test that already holds the two to one vocabulary
holds these. *No new op type unless a phase proves it needs one*: the
1 Sep build added zero ops and one property, and the target here is the
same — an area is an item, a board is a group of adds, a hand-in is a copy
and a property.

---

**Where we are: phases 0 and 1 built, 2 Sep 2026.** Areas exist on both
surfaces — `core/area.ts`, the sheet drawn behind everything and grabbed by
its name, `isocan area new/ls` and `--in` on `text`, `add`, `mv`, `ls` and
`format` — proved over the wire in `cli/test/area.test.ts`. The board is
`SPRINT_BOARD` in core, laid by `isocan sprint board` as one group and
idempotently; every phase knows its sheet (`sprintState.area`); the brief is
one card with a history (`isocan sprint brief`); and the `/sprint` skill lays
the board before it asks anything (`cli/test/board.test.ts`). **Phase 2 is
built too:** a phase call glides everyone who watched it to the phase's
sheet, and the clock chip offers the phase's one action — *Go there*, *New
note* on the phase's paper in the sheet, *Hand in* which lands the
selection on the sheet — through helpers the item menu shares
(`web/test/walk.test.ts`). **Phase 3 is built:** `isocan sprint desk <name>`
births a private canvas — link off, one pass in — that knows its sprint; its
chip reads the sprint's clock by pulling the snapshot and offers *Hand in*,
a cross-canvas copy onto the phase's sheet, stamped, in one group; the
terminal's twin is `copy --to --in --handin` (`cli/test/desk.test.ts`).
**Phase 4 is built:** the wall is the Vote sheet's contents when a board is
laid, and the curtain applies there and nowhere else; `item.react` carries
an optional point as fractions of the item's box — the one wire change of
the project, written by a click while the chip says *Placing* and by
`isocan react --at`; dots draw where they were put, only yours under the
curtain, everyone's at the bell; the reducer keeps a point when the mark
comes off so undo can put the dot back without the inverter knowing whose
(`core/test/heatmap.test.ts`, `cli/test/heatmap.test.ts`). Phase 5 is next.

---

## Phase 0 — Areas: a titled region things are placed in

**The primitive the journey stands on.** An area is an ITEM — `kind=area`,
a title, a tint from the paper palette, a box — rendered behind everything
else as a faint sheet with its title at the top-left in the display step, so
it reads at 6% zoom the way the board must. Membership is **derived by
geometry**: an item is *in* an area when its box lies inside the area's,
the same way a lane's arrows and a map's edges are derived from where things
are now. No `areaId` on items; nothing to keep in sync when something is
dragged out.

- core: `AREA_KIND`, `isArea`, `areaOf(canvas, item)`, `itemsIn(canvas,
  area)`, `areaPatch`; a constant for the tints (paper's, reused on purpose).
- web: render below items; drag an area and everything in it moves (one
  `items.move`, one undo); resize is the ordinary handles; double-click the
  title renames; the item menu gets *Move to area…*.
- cli: `isocan area new "<title>" [--at] [--size] [--tint]`, `area ls`,
  `ls --in <area>`, `mv <items> --in <area>` (places at the next free spot
  inside), `format --in <area>`, `present <area>` (already works — an area
  is an item — but the glide should fit the area, not the item's centre).
- placement: an item placed `--in` an area is placed *within* it and never
  tidied out of it; `nearestFreeSpot` gets a bounding box.

**Proof:** `isocan area new "Sketches" --size 1600x900`, three notes placed
`--in Sketches`, `ls --in Sketches` lists exactly three; drag the area in
the app and the three come along in one undo; `format --in Sketches` lays
out only those three. A note dragged out stops being listed. Both themes.

## Phase 1 — The board, and the brief

`SPRINT_BOARD` in core: the eleven areas in order, their default sizes and
tints, and the three-line card each starts with — so the app and the CLI
lay the same board. `isocan sprint board [--at]` lays it out as one group
(one undo takes the whole board away). The `/sprint` skill's setup step
becomes: lay the board, present it, ask the four questions, write the
**Brief** card from the answers as one item whose versions are the brief's
history, and wait for ✅ on it or *go*.

**Proof (Scene 0):** `/sprint <words>` on a canvas with an enrolled
facilitator yields, in one round-trip, a laid-out board and a brief in its
area; `isocan sprint board` on a bare canvas yields the same board;
undo removes it whole.

## Phase 2 — The walk: present the area, offer the action

`sprintState` gains `area`: the board area whose title matches the phase's
`board` field (a phase table column, so a renamed area still resolves by the
property `board=<phase>` the layout stamps). The skill presents the area on
every phase call. The chip grows **one action per phase kind**, derived,
never stored: *New note* (silent phases — opens the Text tool on the phase's
paper, in the area, where the click lands), *Place a 🔴 / ⭐* (vote phases),
*Hand in* (when the actor has un-handed items in the area), *Go there* (the
glide, always). The item menu's *Hand in for …* moves the item into the
area if it is not there. `isocan sprint` prints the area's name beside the
phase.

**Proof (Scene 1):** Calling `hmw` presents Experts & HMW; *New note* puts
a yellow note inside it with one click; the box passes with only the phase
line in the Chat; `isocan sprint` says *How Might We · in Experts & HMW ·
7 notes*.

## Phase 3 — The desk, and Hand in

`isocan sprint desk <name>` creates a canvas titled *<name>'s desk*, admits
that one actor, and records the sprint canvas and area on it as properties
(`sprintOf`, `sprintArea`) — the desk is born knowing its sprint. The
desk's chip reads the sprint canvas's clock through the home link the
replica already keeps. **Hand in** on a desk is a cross-canvas copy into
the sprint's area plus `sprint=<phase>`, one group on the receiving side;
the clipboard already copies into a different canvas, so the copy is the
existing gesture with a destination area. The CLI twin is `copy --to
<sprint> --in <area>` then `sprint handin`.

**Proof (Scene 2):** Two desks, two sketchers, a 30-second box; at the bell
each presses *Hand in*; the sprint canvas's Sketches area holds both, one
undo each; `isocan sprint` says *2 of 2 in*; neither desk's contents are
readable by the other sketcher (admission refused at the door).

## Phase 4 — The wall is the area

`wallFor` becomes *the Vote area's contents* (falling back to hand-ins when
there is no board), and `hidesVotes` applies to the wall and only to it —
closing the 1 Sep departure. The heat map renders dots sized by count on
the sketch at the bell. *Place a 🔴* records the click's position on the
reaction so the dot lands where it was placed (a reaction already carries
an actor; whether it may carry a point is this phase's one design question,
and the answer must be an op the CLI can write too — `react --at`).

**Proof (Scene 3):** During `heatmap`, a sketch in Vote hides its count
and a note in Brief does not; at the bell dots appear on the sketches
where they were placed; `isocan react 🔴 <sketch> --at 40,60` draws the
same dot.

## Phase 5 — Grids: the storyboard and the test wall

An area may carry a grid — `rows`, `cols`, and names for each — drawn as
guides inside it, and `isocan text --in Test --cell 3,4` places a note in a
cell. The storyboard is a 1×15 grid; the test wall is people×frames.
`slides add --in Storyboard` makes the deck from the grid's order.

**Proof (Scene 5):** A 5×15 grid with named rows; a transcribing agent
fills cells by address; patterns are reactions; the Wrap thread's answers
resolve by `#Title` to cells.

## Phase 6 — Run one for real

The 1 Sep recommendation's first line, still undone. One sprint, the
one-day cut, three people and two agents, on dev, with the board. What
breaks is the next phase list. Rival rooms (Scene 7) after that, because
they are two of these and a copy.

**Proof:** A canvas on dev that reads left to right as Scene 6 describes,
made by people who did not read this document.

---
status: partial
since: 2026-09-02
see: on-demand, personas, mindmap, atlas
note: phases 0–2 built 2 Sep, the day of the design — areas on both surfaces, the board and the brief, the walk with the chip's actions; Scenes 0 and 1 play. Phases 3–6 (desks, the wall as the Vote area, grids, a real run) are designed and not built
---
# The sprint journey

This is the **ideal**: what it feels like to type `/sprint` on a canvas and
be walked, with your team and your agents, from a one-line brief to a tested
prototype — without knowing the method, the vocabulary, or the CLI. It is
written as scenes and held as ground truth, the way
[`../multiuser/journey.md`](../multiuser/journey.md) is: every scene is
something a person should be able to do, and [`phases.md`](phases.md) is
the walk that makes each one play.

What exists already, from [the 1 Sep
research](../../docs/research/2026-09-01-design-sprint.md): the phase table
and its clock, derived from the Chat; hand-ins as a property; votes as
reactions with a curtain the lens draws; the split tally; the bell; and
`/sprint` as a facilitator's skill. What that left is the thing this journey
is about. The skill *knows* the method. The canvas does not *show* it. A
person who types `/sprint` today gets a question in the Chat and then a chip
with a clock, and everything else — where things go, what to do now, what
happens next — is in the facilitator's head and the skill's prose. The room
is a room with a clock and no walls.

**The one idea: the sprint is a board.** A facilitator running a real sprint
does one thing before anything else — covers a wall in labelled sheets, one
per phase, so the week is visible before it starts and everyone always knows
where to stand. That is an *area*: a titled region of the canvas that things
are placed in, walked to, and read back from. Areas are the one primitive
this journey needs, and once the canvas has them the rest of the flow is the
facilitator laying them out, walking the room from one to the next, and the
app offering the single action each area wants.

Three rules carried over unchanged, because they are what make it isocan
rather than a template: **no sprint mode** (a board is items; a phase is a
line in the Chat), **both surfaces** (everything a scene does from a button
is a verb from the terminal), and **the record is never hidden** — the
curtain is etiquette.

## Cast

- **Maya** — product lead. Starts the sprint. The **Decider**.
- **Theo** — designer. Sketches, and has never run a sprint.
- **Ravi** — engineer. Joins Tuesday, skeptical.
- **Kit** — the facilitator. An agent enrolled on the canvas
  ([on-demand](../on-demand/)); holds the clock, never votes, never sketches.
- **Nia** — Maya's emissary agent. Sketches under Maya's name-with-a-mark
  when Maya is in another meeting.
- **The experts** — the repo's personas (`performance`, `accessibility`,
  `copy`, `market-researcher`), interviewed as Monday's experts.
- **Five people** — Friday's users. People, always.

## Scene 0 — `/sprint`, and the board appears

Monday, 9:02. Maya is on the canvas for the product — a dozen screens, a
Chat, Kit enrolled and answerable. She types in the Chat:

> /sprint make signing up feel like it takes ten seconds

Kit wakes ([on-demand](../on-demand/) journey 2) and does **two things at
once**, and the order matters. First, in the Chat, one comment: the four
setup questions the skill already asks — who decides, who sketches (people
and agents by name), the long-term goal in a sentence and two or three sprint
questions, and which cut. Second, **on the canvas**, off to the right of
the existing work, **the board**: a row of areas, each titled for a phase in
the order the week runs them — *Brief · Map · Experts & HMW · Target ·
Demos · Sketches · Vote · Storyboard · Prototype · Test · Wrap* — sized for
what each will hold, tinted faintly, each carrying one card that says in
three lines what happens there, how long it takes, and what you do. The
camera glides to the whole board so Maya sees the week at a glance.

What Maya sees is a *map of the next five days*, not a form. She answers
the setup in the Chat in one message. Kit fills the **Brief** area with a
brief card — goal, questions, Decider, sketchers, cut — as the first
version of one item, and edits it as answers change. The Brief is the one
area that is done before the first bell.

Then Kit asks the one question that starts the clock: *Ready? React ✅ on
the Brief, or say go.* Maya clicks ✅. That reaction is the sprint's first
op after the board, and the retro will find it.

**Acceptance:** From `/sprint <words>` to a laid-out board with a brief in
it is one round-trip in the Chat and zero knowledge of the method.
`isocan sprint board` lays out the same board from a terminal; `isocan ls
--in Brief` lists the brief. The board is items — moved, undone, formatted
like any other — and a canvas with no `/sprint` line in its Chat has no
board unless somebody laid one.

## Scene 1 — Monday: the walk begins

**9:20, Map.** Kit calls `/sprint map 45m` and *presents the Map area* —
the camera glides there for anyone following Kit, and the area's card now
reads as the phase card: the clock, the goal, and the one verb: *say the
steps and I'll draw them*. Maya and Theo talk; Kit draws the map with the
mind map verbs (actors left, ending right) *inside the area*. Nothing they
say needs to be spelled `isocan map add`. Theo drags a node; the arrows
follow.

**Experts, overnight before this.** The Experts & HMW area is not empty
when they arrive. Kit interviewed the four personas at 6 a.m. — the
overnight Monday the research imagined — and each interview is a thread
pinned in the area, with the HMW notes it produced already on the wall as
yellow post-its. Maya reads a wall she did not have to make.

**10:05, HMW.** `/sprint hmw 10m`. The chip says *How Might We · 10:00* and
grows the phase's one action: **New note**, which opens the Text tool on
yellow, *in the area*, where the click lands. Theo writes eight notes
without touching a tool button. Ravi is not here yet. Silence: Kit narrates
on its own status line, never in the Chat, and the parked agents stay
asleep.

**10:20, Target.** Kit *formats the area* — the notes cluster — and calls
`/sprint target`. Two ⭐ each; Maya's 🎯 on one map node picks the target.
The Target area holds one thing: the map node Kit copies there with the
chosen HMWs beside it. The board now reads left to right as a story:
brief → map → questions → target.

**Acceptance:** Calling a phase presents its area; the chip offers the
phase's one action and it acts *in the area*; a silent box passes with no
Chat traffic but the phase line; `isocan sprint` names the area with the
phase. Overnight experts are a `wait`-driven practice the facilitator runs
from the skill, and their output is threads and notes in the right area.

## Scene 2 — Tuesday: sketching alone, together

**Demos.** Ravi joins, reads the board from Brief to Target in a minute
without a word from anyone — that is the board doing its job — and calls
`/sprint demos`. Three minutes each: a site as an item in the Demos area,
one pink note under it saying what to steal.

**The desk.** `/sprint sketch 30m`. The chip's action now reads **Open your
desk**. Kit has given every sketcher — Theo, Ravi, Maya, and Nia for the
hour Maya is away — a *desk*: a scratch canvas of their own, shared with
nobody, named for them, born by the facilitator at setup (`isocan sprint
desk <name>`). The desk opens in a new tab. Nothing a sketcher does there
is on the wall. This is the real privacy the research chose over a veil:
the daemon enforces admission at the door, and a desk has one admitted
person.

Theo draws three panels with the Pen on his desk. Nia, on hers, makes one
HTML screen — one, because the quota is one, and the skill tells her so.
Ravi types a storyboard in three text notes.

**The bell.** Each desk shows the sprint's clock too — the desk was born
knowing its sprint. At zero, the desk's chip says **Hand in**: select what
you made, press it, and it is copied to the sprint canvas's Sketches area
and stamped `sprint=sketch`. Four hand-ins land within a minute, and Kit
`format`s the area once so the wall arrives together. `isocan sprint` says
*4 of 4 in*.

**Acceptance:** A desk is a canvas, made and admitted by the facilitator;
its chip reads the sprint's clock; **Hand in** from a desk lands a copy in
the named area of the sprint canvas with the hand-in property, in one undo
on the receiving side. From a terminal the same is `isocan copy <items>
--to <sprint> --in Sketches` then `isocan sprint handin`. Nothing lands on
the wall before the bell unless somebody chooses to.

## Scene 3 — Wednesday: the wall decides

**Museum.** `/sprint museum`. Kit presents each sketch in turn — one
`present` per sketch, the room following — and nobody presents their own.
Nia's screen is clickable; Theo's is ink; the rule that they are judged as
sketches holds because the wall shows them the same size, in one row.

**Heat map.** `/sprint heatmap 5m`. The chip's action: **Place a 🔴**, and
clicking a sketch places one where you clicked. Counts and names are
hidden — *on the Vote area's wall*, which is now a precise thing rather
than "every item" — until the bell. The dots draw on the sketches, sized by
count, at the bell.

**Critique, poll, supervote.** Three minutes per sketch; Kit's scribe half
writes each big idea as a pink note beside the sketch. `/sprint poll 2m`,
one ⭐ each; the tally at the bell shows people's dots and agents' dots
apart, and Ravi, who did not believe the agents' opinion was worth a row,
reads Nia's ⭐ and changes his mind about which sketch he is arguing for.
Then the Decider's 🏆. Maya places two. The winner **moves to the
Storyboard area** — Kit does it, and says so.

**Storyboard.** Fifteen slots, drawn as a grid inside the area. Existing
sketches are moved in, not redrawn; a missing frame is a yellow note that
says what goes there. `slides add` on the row, so the deck *is* the
storyboard and full screen flips through it.

**Acceptance:** The curtain applies to the Vote area's wall and only to it;
the heat map renders dots on sketches at the bell; the supervote's winner
lands in Storyboard by a facilitator gesture that is one op; a storyboard
grid is an area with guides, not a new kind.

## Scene 4 — Thursday: the fan-out

`/sprint prototype`. Kit says in the Chat, once, who builds what: *Nia —
frames 1–5; Percy — 6–10; Theo — 11–15; Stitcher: Kit.* Each frame's
note in the Storyboard area becomes the brief for a screen. The agents work
in their own directories and hand in to the **Prototype** area frame by
frame; the area shows fifteen slots filling in. Kit runs `design check`
across the area and `format` once, and the trial run is the deck full
screen.

Maya is in a meeting for two hours. She reads the Prototype area on her
phone at 3 p.m., reacts 🐛 on frame 8, and Nia — parked on the area — fixes
it as a second version. The lane shows what her message made.

**Acceptance:** `format --in Prototype` lays out one area; `wait --in
Prototype` parks an agent on one area; `design check --in Prototype`
reports on one area. An area is the unit the fan-out is coordinated on.

## Scene 5 — Friday: five people

`/sprint test`. The **Test** area is a grid: five rows named for the five
people, fifteen columns for the frames. Theo interviews; Ravi's agent
transcribes — a note per cell, from what it hears, never from what it
imagines. After the third interview Kit says, on its status line, *pattern
on frame 4: three of three*. By five o'clock the grid has its patterns
marked as reactions in the cells, and the sprint questions from Monday's
Brief are quoted in a Wrap thread, each answered with a `#` to the cell
that answers it.

**Acceptance:** A grid is an area with guides and named rows and columns
that `isocan text --in Test --cell 3,4` can address; patterns are
reactions; the Wrap thread's answers reference cells by `#Title`.

## Scene 6 — The retro, and the board as the record

`/sprint wrap 30m`, then `/sprint end`. The board stays. A week later Ravi
opens the canvas to explain the decision to somebody who was not there,
and walks the board left to right: the brief, the map, the target, the
sketches with their dots, the storyboard, the prototype, the grid. `isocan
at <seq>` shows the wall as it stood at the supervote; `recap` writes the
page. Nothing had to be "exported" because nothing was ever anywhere else.

**Acceptance:** A finished sprint reads left to right on its board with no
narrator; every phase's outcome is in its area; the recap names the areas.

## Scene 7 — Rival rooms

Two canvases, the same brief, different sketchers — one with Theo and Nia,
one with Ravi and Percy — each with its own board. Thursday each room's
prototype is copied into a third canvas's Prototype area, side by side,
and Friday's five people see both. `copy --to … --in` carries an area's
contents with their arrangement. This is Tiny Stitch's founding move and
the first time three canvases do one thing.

**Acceptance:** Two boards run from one brief; a third board's Prototype
area holds both rooms' work, labelled by room; the supervote at the end is
one person's.

## What a scene must never require

- Knowing a phase name. The board's cards say what happens; the chip's
  action does it.
- Typing in the Chat during a silent box to find out what to do.
- Opening a terminal to hand in, to vote, or to decide. Every one has a
  button; every button has a verb.
- A sprint mode, a Sketch kind, or an area that is anything but items.
- Faking anonymity. *Not shown while voting* is the promise, said on the chip.

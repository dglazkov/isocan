# The agent that proposes — the walk

[`journey.md`](journey.md) is the ideal and [`design.md`](design.md) the
mechanism. Each phase ends with something a person can do, and something
they can switch off again.

**Ordered by what the rest stands on, and then by what helps a first session
most.** First the proposal, because nine of the ten ideas are a proposal with
a different trigger. Then design words in the composer, which the concept's
own note argues should come first: it resolves a vague word before a
generation is spent, and so helps the person who would otherwise leave after
one try. Then the triggers, in shadow, because a proactive agent that fires
at the wrong moment is worse than one that never fires. Then the features,
cheapest first.

**Phase citations name their project**: `proactive phase 2`, never a bare
"phase 2".

**Where we are:** specified 13 Oct 2026; nothing is built.
**proactive phase 0 is next** — the proposal.

**Two rules for every phase.**

- **Shadow before on.** Anything that fires by itself runs first as a log
  line that changes nothing, and is switched on only after its false-alarm
  rate has been read on real canvases.
- **Behind an experiment.** Each feature is an entry in
  `packages/web/src/lib/experiments.ts`, off until a person ticks it.

---

## Phase 0 — The proposal

**Status: NOT STARTED.**

The primitive, on both surfaces (design.md *The primitive*).

- Core: the four properties, the band function, the citation grammar and its
  resolver, keep and dismiss as existing ops in one group, `settled`, and
  the refusal to propose against a settled screen.
- CLI: `isocan propose`, `isocan proposals`, `isocan proposal keep|dismiss`,
  `isocan settle`. Agent guide and README with it.
- Web: a dashed frame and a connector to the source; the citation as a chip
  that goes to what it cites; the confidence mark; Enter keeps (or develops
  a hunch), Backspace dismisses, no dialog. The four authorship tokens, in
  both themes.
- The Taste card: created on first dismissal, appended with a conditional
  edit, undone with the dismissal.

**Acceptance:** an agent run by hand proposes a change beside a screen on a
scratch canvas. A person sees it dashed under its source with its citation,
keeps one (the source gains a version and is settled; one undo takes it
back) and dismisses one (it goes, a `noted:` line appears, one undo restores
both). A proposal against the settled screen is refused. The source item is
never the target of an op the agent sent. A browser journey holds the keys.

## Phase 1 — Say it like a designer

**Status: NOT STARTED.**

3B. The glossary in core: design terms with a one-line definition, and vague
words with named readings and the sentence a designer would say for each.

- The Chat composer underlines a glossary word and offers the designer's
  sentence as ghost text; Tab takes it, Enter sends what was typed.
- Sent as typed, the request goes with the first reading, and the other
  readings arrive as hunch proposals beside the result (phase 0's
  primitive). Asking first is a setting.
- An agent's comments underline glossary terms, which open their definition
  in place.
- The panel's three lists, counting nothing.

**Acceptance:** on a scratch canvas, *make the header pop* sends one comment;
the result arrives with two hunches labelled by reading; the term in the
agent's why opens its definition. Switching the experiment off leaves the
composer exactly as it was. A walk for how it feels.

## Phase 2 — Maybes are proposals

**Status: NOT STARTED.**

1C, which is mostly built. A wireframe *maybe* gains the proposal's two keys
and its lesson: Enter develops it (`wire flesh`, redrawn in the governing
design system and wired into the flow), Backspace removes it and writes a
`noted:` line. `wireMaybe` and `proposalP` are read through one function so
the two cannot disagree about a band.

**Acceptance:** `/wire` on a scratch canvas draws its maybes; Backspace on
one writes the note; `isocan judge corpus` reads the removal as a label.

## Phase 3 — The triggers, in shadow

**Status: NOT STARTED.**

`returned`, `settled` and `stuck` as pure functions in core over a log and a
seen-mark, with their thresholds in one file and tests on synthetic logs. A
reader, `isocan evals triggers`, replays a real canvas's log and reports when
each would have fired. Nothing acts.

**Acceptance:** a page in `docs/research/` with, for each trigger, how often
it would have fired on real canvases and a person's reading of a sample: was
that a real moment? **A trigger with more false alarms than real moments
does not get switched on**, and its definition is rewritten here.

## Phase 4 — Stuck

**Status: NOT STARTED.**

3C. When the phase 3 detector fires on a request, the agent's reply is not a
generation. It says it has been guessing, says what it noticed in the
person's behaviour as an observation they can correct, and asks a
four-option question: density, brand expression, layout, tone of voice, each
a now-and-instead pair with a plain phrase and its design name, its own
guess marked. Two ways out: *show me extremes* (four hunches) and *name a
product that gets it right*.

It needs a question a person can be asked outside an admitted design
request; `isocan ask` is the lighter path to check first.

**Acceptance:** a fourth short reroll with quick undos on a scratch canvas
gets the question and no generation; choosing a tile generates once. A walk
for the tone, which matters more here than anywhere.

## Phase 5 — The brief as a card

**Status: NOT STARTED.**

3A. Three more lines and the *right now* mode, an id per line, a card a
person edits, Right / Wrong on an inferred line (three inferred lines at
most), and `brief:<lineId>` citations that resolve. Decide here whether the
brief can stand outside the opt-in design workflow.

**Acceptance:** a person edits *for*; nothing on the canvas changes; every
screen is sorted into three lists, one question is asked, and a proposal is
drawn for each answer, each with a chip that goes to the line it answers.

## Phase 6 — The handoff and the morning

**Status: NOT STARTED.**

1B and 1A, their smallest versions together.

- `/handoff` writes the note: settled, left open, and **one** ticked promise
  with a count and a budget, of one of the three kinds. *Not tonight* is one
  tap. A dashed empty frame appears under the screen the promise concerns.
- A ticked promise is the person's word for that line's turns under
  `rcLimits`, and for no others.
- The morning says first that nothing of the person's changed, then shows
  the frame filled — a proposal, or for a watch promise a sentence and a
  number — or a sentence saying why not, and a *left alone* list.

**Acceptance:** a handoff on a scratch canvas in the evening, with `isocan
rc` left running; in the morning, the frame is filled or explains itself.
Run again with the laptop asleep: the morning says nothing ran. Run a watch
promise: no design is made. The spend is inside the line's budget, read from
the rc's own accounting.

⚑ Unattended model spend on the person's key. Asked, with the budget, before
this phase runs once.

## Phase 7 — Two critics

**Status: NOT STARTED.**

2B. Two of design-competition's packs run as lenses over one screen, on
demand, each alone. They pin points (`react --at`) and comment; they hold a
grant that cannot edit; the lead agent writes agree / split / blocker, names
the tension in a split, and *build both* makes two proposals, each citing
the critic it answers. The two settings — how loud, and when — arrive with
the first trigger that could use them, not before.

**Acceptance:** two critics over one screen; an attempt by a critic to edit
is refused at the door, not by its prompt; a split produces two proposals.

## Phase 8 — Explain this screen

**Status: NOT STARTED.**

2A, as a panel. For one item: the versions `timeline --majors` calls major,
who made each (a person, an agent, a ripple), a one-line reason for each
(the comment or request it came from, where one exists; otherwise none is
invented), each pinned to its place on the screen; what in the governing
DESIGN.md changed after the item's current version; and a critique in three
parts, whose *one thing to try* becomes a proposal.

**Acceptance:** `isocan explain <item>` and the panel agree on the same
item; a version with no recoverable reason says so.

## Phase 9 — The pulse, then the ripple

**Status: NOT STARTED.**

1D, for tokens. An index of which screens use which design token, built
from the audit that already reads each screen, gives every screen a state:
current, behind, in conflict.

- **The pulse first**: one tick per screen in the canvas's top bar.
- **Then the ripple**: after `settled` fires on a screen, the agent reads
  the edits back as named decisions and lists the other screens in three
  states, previews only, with the choice of altitude and the one-off mark.
  Wireframes first, because `wire style` can already re-render them.

**Acceptance:** change a colour on one wireframe; the pulse shows the others
behind; the ripple lists them with their state; accepting updates the design
system and re-renders in one undo; marking the source a one-off silences it.

## Phase 10 — Walk it through a lens

**Status: NOT STARTED.**

3D, as the three measurable lenses: one-handed, low vision (with the
washed-out redraw), and screen reader. Over each screen of a prototype's
flow, with an outcome per lens — made it, stumbled, gave up — stumbles
pinned where they are, a finding shared by more than one lens called out,
and one proposal for it.

**Acceptance:** three lenses over one flow; every result says it is a check
and not a test with a person.

## Later, unordered

The concept's undrawn ideas, each a proposal or a question with a different
trigger: kickoff questions in place of a bare prompt; a narrated first
generation; three next moves after a first result; a desk check before
sharing, which is where critics and lenses run unasked; a written rationale
for stakeholders from the explain panel; *why not?* to draw a rejected
alternative; naming a good move a person made by hand; the two walkers that
need a model (second language, first-timer); a critic derived from work a
person admires; and lenses on the depth setting for who is reading (an
engineer hears tokens, a founder hears trust).

## Trajectory

- **2026-10-13** — Specified. The handoff's map onto existing features was
  checked against the code and mostly redrawn: the proposal is `wireMaybe`
  promoted to core, the intent card is `DesignBrief` with three more lines,
  and personas, docket and the accessibility measures are about this
  repository, not a person's canvas.
- **2026-10-13** — Read against the canvas the same day, which changed six
  things: promises are of three kinds and one of them draws nothing; a
  promise carries a count as well as a budget; *settled* is a state on a
  screen that the agent may not propose against; the pulse is a standing
  piece of its own; design words moved to phase 1, as the concept argues;
  and a vague word no longer stops a request — the other readings arrive as
  hunches.
- **2026-10-13 — Open:** a grant that may comment and not edit; what a watch
  is as data; whether a budget per promise can be enforced; whether the brief
  can leave the opt-in workflow; and what feeds the morning beyond promises,
  since a canvas has no outside source of insights.

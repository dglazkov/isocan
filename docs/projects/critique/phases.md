# Critique — the walk

[`journey.md`](journey.md) is the ideal and [`design.md`](design.md) the
mechanism. Each phase ends with something a person can do, behind the
`critique` experiment, and switched off again by unticking it.

**Ordered so the first critique is real as early as possible.** Critics on
the canvas first, because everything summons one. Then one critic asked and
answering, because that is the experiment's whole promise in its smallest
form. Then the ceiling, before anything runs that a person did not watch.
Then two critics and the read, then the web's doors.

**Phase citations name their project**: `critique phase 2`, never a bare
"phase 2".

**Where we are:** specified 14 Oct 2026; nothing is built.
**critique phase 0 is next** — critics on the canvas.

---

## Phase 0 — Critics on the canvas

**Status: NOT STARTED.**

- Core: `critic: true` persona items parsed by `parsePersona`; the naming
  check (`packProblems`' rules) on every critic; the `critique.critics`
  contribution point, with the nine packs contributed to it.
- CLI: `isocan critic ls` (the roster, and the critics on this canvas),
  `isocan critic add <pack>` (writes the pack's lens into a new critic
  item), `isocan critic new "<name>"` (a skeleton). Agent guide topic.
- Web: critic items render as cards with their colour and credit line.

**Acceptance:** on a scratch canvas, `critic add inevitable` makes a card
with the pack's three questions and credit; editing the card changes what
`critic ls --json` reports; `critic new "Acme Counter"` makes a skeleton;
a critic named after a person, or clashing on a first word, is refused in
words.

## Phase 1 — One critic, asked

**Status: NOT STARTED.**

- The `critique.critic` template: `AGENTS.md` from the critic item, the note
  format, notes and nothing else, read the screen and not the thread.
- `isocan critique <item> --by <critic>`: enrols the critic once per canvas
  (`host.enrol`) and opens a thread on the item that mentions it.
  `@Critic … #Item` in the Chat does the same through the ordinary wake.
- `isocan critique note <item> --at x,y --kind working|risk|blocker
  --question N "…"`: a thread pinned at a fractional point, with the typed
  first line; the core parser that reads it back.
- `critique done`, posted by the critic when it has finished.
- The critic's `budget` bounds the run, and a stop at the cap says so.
- Seeing the screen: the critic reads the item's HTML and, where `canvas
  shot` renders it reliably, a picture of it.

**Acceptance:** on a scratch canvas with `isocan rc` running, `critique
#Checkout --by inevitable` produces pinned notes on the screen, each with a
kind and a question, and the screen's version is unchanged. The spend is
inside the critic's budget, from the runner's own accounting. A walk: does a
real critique read like the pack's voice?

⚑ Model spend on the person's key for each critique run. Asked with the
budget before the first real run.

## Phase 2 — The ceiling

**Status: NOT STARTED.**

A `note` ceiling on an enrolled critic's claim on one canvas, checked at the
door after the badge's capability. Only creating an item-anchored thread,
replying in its own threads, and reacting with a point pass; everything
else is refused with `beyond-ceiling` and logged. Decide where the ceiling
lives (enrolment, claim, or session) by building the smallest one the home
can check; the CLI and the web read the same refusal.

**Acceptance:** a critic enrolled on a scratch canvas runs `isocan edit` on
the screen it was asked about and is refused with `beyond-ceiling`; its
notes still land; the same agent un-enrolled as a critic can edit again. A
test that sends the op directly, not through the CLI, is refused the same
way.

## Phase 3 — Two critics, and the read

**Status: NOT STARTED.**

- `/critique #Item with A and B` and `critique <item> --by a,b`: one thread,
  both mentioned, both run.
- `critiqueRead(notes)` in core: agree, split and blocker from parsed notes
  and their pins, tested on synthetic notes.
- The lead's single reply once every critic has posted `critique done`,
  naming tensions in design words.
- **Build both** on a split: two variations (`parent=`), each citing the
  critic it answers.

**Acceptance:** two critics over one screen on a scratch canvas produce one
synthesis reply whose groups match `critiqueRead`'s; a split's *Build both*
makes two variations citing different critics; neither critic's notes cite
the other's.

## Phase 4 — The web's doors

**Status: NOT STARTED.**

- **Critics** panel: the roster, the canvas's critics, add and new.
- Right-click on a screen → **Critique with…** → pick critics → the same
  thread the CLI opens, through `WebHost.enrol` to the parked runner; a
  sentence when no runner is parked.
- Pins in each critic's colour; a note opens where it is pinned; the
  synthesis's **Build both** as a button.

**Acceptance:** the whole of journey scene 3 played in a browser on a scratch
canvas, driven by a journey in `scripts/journeys.mjs`, and walked once by a
person.

## Trajectory

- **2026-10-14** — Specified, from proactive's *Two critics* and a survey of
  the code. It found that no grant can comment without editing, and that
  roles rejected a commenter rung on purpose. So "never edits" is a ceiling
  on one agent's claim, which only narrows, rather than a new rung.

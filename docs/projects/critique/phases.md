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

**Where we are, 14 Oct 2026:** phases 0 and 2 are CLOSED, phase 1
PART-DONE. Critics live on the canvas, answer a critique with pinned, typed
notes, and are refused at the home if they try anything else. Phase 1
still owes a dollar cap proven against a harness that reports cost.
**critique phase 3 is next**: two critics, and the read.

---

## Phase 0 — Critics on the canvas

**Status: CLOSED.** 2026-10-14 — `critic add|new|ls` on a scratch canvas: a pack becomes an editable persona item read back through `parsePersona`, an edit changes what `critic ls` reports, and a duplicate, a person's name and a first-word clash are refused in words; works with design-competition absent.

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

**Status: PART-DONE.** 2026-10-14 — a real critic run on a synthetic Acme checkout left four pinned, typed notes and `critique done`, and the screen's version did not move; the dollar cap is unproven, because the harness walked reports no cost.

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

**Status: CLOSED.** 2026-10-14 — a critic's edit, move, add or unpinned comment is refused with `beyond-ceiling` and nothing is written, through the CLI and through ops sent directly, and by the home when a replica forwards them; its notes, replies and reactions land; it cannot lift its own ceiling; the person's `critic release` lets the same agent edit again.

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

- **2026-10-14** — The naming rules left design-competition for core
  (`packages/core/src/homage.ts`), so critique uses them without depending
  on competitions; `packProblems` and `rosterClashes` call them unchanged.
- **2026-10-14** — A module renderer could only claim an item by mime, and
  claiming `text/markdown` would have taken every note. Renderers may now
  also require a property (module API 0.2.8).
- **2026-10-14** — `parsePersona` listed `color` as a known key and then
  dropped it, despite its own test's warning. It is read now.
- **2026-10-14** — The first real critique, by *Inevitable* on Codex, took
  38 seconds and one turn, and left one *working* note and three *risk*
  notes, each naming its question ("Pay and Save … divide the checkout into
  two competing destinations. Make Save for later a text link."). The first
  attempt produced nothing: Codex's sandbox blocked the local port and its
  login shell put the released `isocan` ahead of the one being tested.
- **2026-10-14** — A critic's `turns per run` counts summons, not model
  steps, so one prompt with many tool calls fits in a single turn. A
  harness that reports no cost (Codex) is bounded only by that and the
  ten-minute turn ceiling. The dollar cap is read from ACP's
  `usage_update.cost`, and it has not met a harness that sends one.
- **2026-10-14** — A critic's colour is its actor's colour (`actor.setColor`,
  set when it is asked), so the pins wear it everywhere, outside the
  experiment. That is a fact about the actor, so it is not gated.
- **2026-10-14** — The ceiling lives on the critic's enrolment row in canvas
  state (`EnrolledAgent.ceiling`, with `ceilingBy`), written by a new op,
  `agent.ceiling`, and checked in `Engine.applyAndPersist`: the one place the
  home applies an op, so a replica forwarding a write meets it there. A new
  op rather than a field on `agent.enroll`, because a home that predates it
  refuses an unknown op but would silently drop an unknown field and leave
  the critic uncapped. Undo and redo are checked before they choose.
- **2026-10-14 — Open:** the ceiling binds the critic's *actor*, not its
  process. Agents ride their machine's badge (agent-custody), so a critic
  process that drops its session key speaks as the person, who is not
  capped. The door holds against the critic; it is not a sandbox.
- **2026-10-14 — Open:** a capped critic may still reply in any thread and
  mention anyone, so it could ask an editing agent to make the change it
  is not allowed to make. This is the same worry that kept roles from a
  commenter rung. One way to close it is refusing mentions from a capped
  actor.
- **2026-10-14 — Open:** isocan.io refuses `agent.ceiling` until this is
  deployed there, so `critique` against a hosted canvas fails loudly —
  nothing is asked, and a critic enrolled for the ask is withdrawn — rather
  than running uncapped. dev.isocan.io follows CI; production moves with the
  `prod` tag, which is a person's step. Smaller: a refused `edit` has
  already uploaded its blob; the agent tray does not yet say "notes only".
- **2026-10-14 — Open:** proving the dollar cap needs a harness that
  reports cost. Claude Code's adapter (`@agentclientprotocol/claude-agent-acp`)
  is not on this machine, and downloading it is Dion's call. A critic sees
  only the screen's HTML: `canvas shot` renders a whole canvas, not one item.
  The packs' "How it ranks" section talks about competition entries and
  reads oddly in a critique brief.
- **2026-10-14 — Open:** the browser has no roster: design-competition's web
  activation does not carry its contributions, so the critique phase 4
  Critics panel needs the roster from the CLI side or the daemon. And the
  entry chunk was already 4,663 bytes past its agreed ceiling before this
  phase; critique added 277 to it, and its own chunk is 3 KB.

- **2026-10-14** — Specified, from proactive's *Two critics* and a survey of
  the code. It found that no grant can comment without editing, and that
  roles rejected a commenter rung on purpose. So "never edits" is a ceiling
  on one agent's claim, which only narrows, rather than a new rung.

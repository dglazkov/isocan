---
status: designed
since: 2026-10-14
see: design-partner, wireframes, standing-agents, personas, version-diff, copy-edit
note: "the walk: proposals and the taste note first, because every moment uses them; then the night watch and the morning review; explain; the brief card; ripple; stuck detection; critics and the desk check; walkers; design words; evidence."
---

# A proactive agent — the walk

**14 October 2026.** Held to [journey.md](journey.md) and
[design.md](design.md). Each phase ends with **Trajectory**: only what the
phase discovered that changes the project's course, and the Open entries a
later phase must pay for.

**Where we are, 14 Oct 2026: designed, not started. Next: phase 1, proposals and the taste note, which every later phase uses. Open questions that shape a build wait on Dion, each named under the phase it blocks (what counts as leaving, settling and being stuck; caps; where a canvas's critics and brief live; how walkers are grounded).**

Rules for every phase, on top of `AGENTS.md`:

- **Never over the person's work.** Nothing a phase builds edits an item
  the person made without the person's click. A test says so for each
  moment.
- **No trigger, no proposal.** Every proposal carries at least one cite;
  the CLI and the web refuse one without.
- **No new op.** Properties, comments and the existing design ops carry
  everything.
- **Both surfaces.** Each phase lands the CLI verb, the web surface, the
  agent-guide paragraph and the tests together; `surface.test.ts` names
  every new verb.
- **Stub agent in tests.** Journeys use a scripted agent; a real model runs
  only in phase 11, and scheduling it is Dion's yes.

## Phase 1 — Proposals, and deletes that teach

**Status: NOT STARTED.**

**Outcome:** core `proposal.ts` (`proposalMarked`, `proposalsOf`,
`proposalRoom`), `design-words.ts` (the glossary); `isocan propose`
refusing an empty cite list and a fourth open proposal; the dashed mark,
trigger chip and dotted-underlined why in the web app, generalised from the
wireframe *maybe* marks; **Keep** (`choose`), **Compare** (the diff
inspector), **Delete** (⌫, one undo) that summons the author with
`{ deleted }` data; the taste note (`taste=1`, pinned into context); the
`proactive` agent-guide topic.

**Proof:**

- Unit: a proposal is marked until kept and unmarked after; Keep makes one
  new version of the source and trashes the proposal in one undo; the cap
  and the empty-cite refusal hold on both surfaces.
- Journey `proactive-proposal` (stub agent): a proposal hangs beneath its
  source with its chip; Delete trashes it, a comment reaches the author, and
  the taste note gains a line; with nobody answerable, the delete still
  happens and the toast says the note was not taken.

### Trajectory

- **2026-10-14** — Open: whether the cap of three is per canvas or per
  source, and whether non-screen proposals draw the same way. Waits on Dion.

## Phase 2 — The night watch

**Status: NOT STARTED.**

**Outcome:** `/goodnight`, the **Hand off** menu row and `isocan handoff`;
core derivations for *settled today* and *left open*; the handoff note as a
text node with ticked lines, budgets, *will not touch* and *ready by*;
promised frames (`proposal=promised`) under the screens they concern; the
ticked note sent as an ordinary summons to the canvas's lead agent; an
honest "nothing can answer tonight" when no standing agent is answerable.

**Proof:**

- Unit: settled-today and left-open on a fixture day (a `choose`, a kept
  maybe, a DESIGN.md version, two open questions) list exactly those, each
  cited.
- Journey `proactive-night-watch` (stub agent through `isocan rc`): unticking
  a line removes its frame; the summons reaches the agent; with the agent
  dismissed, the note promises nothing and says why.

### Trajectory

- **2026-10-14** — Open: what counts as leaving (an explicit word only, or
  also closing the tab or idling, and after how long); whether a team shares
  one night watch; whether a first session gets one. Waits on Dion.
- **2026-10-14** — Decided (Dion): the night watch starts only with an explicit `/goodnight`, never a closed tab or idling. `/goodnight` opens a conversation in the Chat about what to work on; the note and its promised frames are written from what that conversation agreed, and by the morning the canvas carries that work. Open: whether the agreed work may edit an original, or only hangs beside it.

## Phase 3 — The morning review

**Status: NOT STARTED.**

**Outcome:** the "While you were away" panel on desktop as well as the
phone, leading with the agent's brief (found by its `record` data), at most
three proposals in confidence order, **Left alone** with reasons, then the
digest; promised frames filled or filled with a reason; the rule that an
item the person edited in their last hour is off limits unless named.

**Proof:**

- Journey `proactive-morning` (stub agent, a fixture night): returning past
  *ready by* shows the brief first, three proposals, one failed promise with
  its reason, and the person's screens unchanged byte for byte.
- Unit: a fourth proposal from the night is refused; a seen mark newer than
  *ready by* shows no review.

### Trajectory

- **2026-10-14** — Open: whether three is the cap or it scales with time
  away; the wording when the night found nothing. Waits on Dion.

## Phase 4 — Explain this item

**Status: NOT STARTED.**

**Outcome:** core's explain story (versions and authors, the comment that
made each version via `lane.ts`, design decisions, `choose` and `prefer`,
`wire why` for wires, seams by `timeline.ts` significance; the roads not
taken from the trash and unadopted options; what moved since);
`isocan explain <item>`; the Explain panel with pins, the depth switch and
**Copy as rationale**; *Critique* as a summons whose "one thing to try"
arrives as a proposal.

**Proof:**

- Unit: on a fixture item with fifty versions, three variations and one
  `choose`, the story names the four seams, the chosen variation's comment
  as its reason, and the two losers as roads not taken; a DESIGN.md
  version newer than the item appears under *what moved*.
- Journey `proactive-explain`: the panel opens beside the live canvas and
  Escape closes it; nothing is written unless *Copy* or *Critique* is
  pressed.

### Trajectory

*nothing yet.*

## Phase 5 — The brief as a card

**Status: NOT STARTED.**

**Outcome:** a card item rendering the active brief, solid rules for
supplied facts and pencil rules for assumed ones (at most four); **Right**
and **Wrong** through `design brief --update`; proposals citing
`brief:<factId>`; the re-read after an edit (*still holds*, *assumed the old
line*, *matters more now* with one question); **Right now** from the
brief's intent plus a sensed mode the person can overrule.

**Proof:**

- Unit: changing a fact sorts a fixture's screens by which proposals and
  receipts cite it, and writes nothing else.
- Journey `proactive-brief-card`: Right turns a pencil line solid, and the
  brief's history shows the person as the source.

### Trajectory

- **2026-10-14** — Open: one card per canvas, per group or per design
  request, and whether it lives on the canvas, in a panel, or both. Waits on
  Dion.

## Phase 6 — Changes ripple

**Status: NOT STARTED.**

**Outcome:** the settle trigger in the rc; `isocan ripple <item>` listing
the screens that use the changed tokens, values or terms; previews as
proposals citing the source version; the three states and the altitude
choice (design system, screen by screen, `ripple=off`); the derived pulse
strip; the decision read-back from the lead agent.

**Proof:**

- Unit: on a fixture of six screens, changing one token in the source
  lists exactly the screens that use it; `ripple=off` silences it; the pulse
  derives behind and conflict without a write.
- Journey `proactive-ripple` (stub agent): after a settled run of edits,
  previews arrive as proposals and nothing else changes until Keep.

### Trajectory

- **2026-10-14** — Open: when an iteration has settled, and whether the
  default altitude should ever be the design system. Waits on Dion.

## Phase 7 — Stuck detection

**Status: NOT STARTED.**

**Outcome:** `stuckOn` in core over asks, results and `undoneSeqs`; the rc
putting it in `SummonsContext`; derived observations (what survived each
try); the agent-guide rule to ask with a `visual-cards` question set (four
axes, its own guess marked, *show me extremes*, *name a product*) instead
of generating again.

**Proof:**

- Unit: three undone tries on one item in a fixture log trip `stuckOn`;
  three tries on three items do not; a kept result resets it.
- Journey `proactive-stuck` (stub agent): the fourth ask gets a question
  set, not a version.

### Trajectory

- **2026-10-14** — Open: the trigger (tries, time, undo speed, shrinking
  asks) and whether the four axes are fixed. Waits on Dion.

## Phase 8 — Critics in the room, and the desk check

**Status: NOT STARTED.**

**Outcome:** critics as personas worn by the lead agent; `isocan crit
<item> --as <persona>…`; per-critic pins coloured by `{ persona }` data; the
read of the room (agree, split, blocker) and *build both*; the critics list
with *how loud* and *when*; the desk check on `share` and `present`
(design audit, contrast, words lint, wires behind, stale receipts, critics
set to *before I share*), reporting and never blocking.

**Proof:**

- Unit: a fixture with two critics who disagree produces a split, not an
  average; critic runs write comments only.
- Journey `proactive-critics` (stub agent): two lenses over one screen give
  two colours of pins and one synthesis; `isocan share` prints the desk
  check before the address.

### Trajectory

- **2026-10-14** — Open: where a canvas's critics live when no repo is
  bound; whether critics see each other's notes; whether a blocker can stop
  a share. Waits on Dion.

## Phase 9 — Walk it as someone else

**Status: NOT STARTED.**

**Outcome:** `isocan walk <flow> --task "…" --as low-vision --as
one-handed`; deterministic walkers over a wire prototype path or a group's
reading order (contrast, target size and reach, accessible names and
order); lanes drawn as the walker meets each screen; pins, outcomes, the
shared stumble and one fix proposal; the simulation notice.

**Proof:**

- Unit: on a fixture flow with one low-contrast button and one small
  target in the bottom corner, the two walkers stumble exactly there and
  the shared finding names the screen both hit.
- Journey `proactive-walk`: lanes render with the overlays and the notice;
  nothing is written but pins and one proposal.

### Trajectory

- **2026-10-14** — Open: how walkers are grounded so they are not
  caricatures, and whether a walk joins the desk check. Waits on Dion.

## Phase 10 — Say it like a designer

**Status: NOT STARTED.**

**Outcome:** composer underlines for vague words from `design-words.ts` in
messages to an agent; readings drawn on the person's own screen where one is
selected; the designer's sentence on Tab; the picked reading carried as
data; the *when I am vague* setting; the vocabulary panel; coinages learned
into the taste note.

**Proof:**

- Unit: the word list underlines "pop" and "cramped" and nothing in a
  fixture of precise asks.
- Journey `proactive-words`: picking a reading adds it to the sent
  message's data; Return sends the person's words unchanged.

### Trajectory

- **2026-10-14** — Open: whether a pause to pick feels like friction, and
  whether any count of asks that needed no translation is shown (opt in
  only). Waits on Dion.

## Phase 11 — Evidence

**Status: NOT STARTED.**

**Outcome:** a verify walk in `docs/verify/` for what only a person can
judge (is a proposal ever unwelcome, does the morning review earn the
return, does Explain teach, is the stuck question kind); a bench run of a
real lead agent over a synthetic Acme canvas for one night, recording each
proposal's cites and whether a judge would keep it; an eval of
keep-versus-delete rates that a persona owns.

**Proof:** the walk written, the night's record, and the eval's first
number.

### Trajectory

*nothing yet.*

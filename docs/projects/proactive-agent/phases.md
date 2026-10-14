---
status: partial
since: 2026-10-14
see: design-partner, wireframes, standing-agents, personas, version-diff, copy-edit
note: "the walk: proposals and the taste note first, because every moment uses them; then the night watch and the morning review; explain; the brief card; ripple; stuck detection; critics and the desk check; walkers; design words; evidence."
---

# A proactive agent — the walk

**14 October 2026.** Held to [journey.md](journey.md) and
[design.md](design.md). Each phase ends with **Trajectory**: only what the
phase discovered that changes the project's course, and the Open entries a
later phase must pay for.

**Where we are, 14 Oct 2026: phases 1–4 (proposals; the night watch; the morning review; explain) are CLOSED. Next: phase 5, the brief as a card — after the entry chunk's slimming pass, since it sits 193 bytes under the jump. A slimming pass of the entry chunk follows the phases (Dion). Open questions that shape a build wait on Dion, each named under the phase it blocks (what counts as leaving, settling and being stuck; caps; where a canvas's critics and brief live; how walkers are grounded).**

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

**Status: CLOSED, 14 October 2026.** Core `proposal.ts` (`PROPOSAL_CAP = 5`, `proposalMarked`, `proposalsOf`, `proposalRoom`, `proposalRefusal`), `proposal-words.ts` and `design-words.ts` (twelve terms); the reducer refuses any `item.add` carrying `proposal` with an empty cite list, a missing source, an empty or overlong why, or a sixth open proposal by the same agent, so every door is refused in one sentence. `isocan propose` (placed beneath the source by footprint) and `isocan taste`; the `proactive` agent-guide topic. The web draws the dashed mark, the connector, the ochre chip and the why with defined terms, and Keep (`choose`), Compare and Delete (⌫ and the button: the trash and the `deleted` comment to the author in one undo, with an optional reason). The taste note, "What your deletes taught", is pinned and placed clear of every footprint. `proposal.test.ts`, `propose.test.ts` and the `proactive-proposal` journey (the terminal standing in for agent Kit): the proposal beneath its source with its chip; Delete trashes it, the comment reaches the author, the taste note gains a line; with nobody answerable the delete still happens and the toast says the note was not taken. Deep suite 834 of 834; entry 721,210 → 723,869.

**Outcome:** core `proposal.ts` (`proposalMarked`, `proposalsOf`,
`proposalRoom`), `design-words.ts` (the glossary); `isocan propose`
refusing an empty cite list and a sixth open proposal; the dashed mark,
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

- **2026-10-14** — Decided (Dion): the cap is five, not three ("Cap of three feels a lil small? Maybe 5?"), per agent per canvas, one constant `PROPOSAL_CAP`. Open: whether non-screen proposals draw the same way (phase 1 draws them the same). Waits on Dion.
- **2026-10-14** — Decided (Dion): the cap does not grow with time away, and an open proposal never expires; room frees only when the person keeps or deletes one ("Should acknowledge before growing more").
- **2026-10-14** — The cite and cap rules run in the reducer, not either client, so a plain `add --prop proposal=…` is refused in the same words; the cost is about 2.6 KB of entry chunk, because the reducer runs in the browser.
- **2026-10-14** — Keep is `choose`, and choosing a proposal now trashes only that proposal; other children of the source stay. `isocan choose` on a proposal behaves the same way.
- **2026-10-14** — A delete's note cannot be anchored to the trashed proposal (a thread needs a live anchor); with no prior thread it stands freestanding at the proposal's spot, in the delete's undo group.
- **2026-10-14** — Placement counts footprints (the name strip above, the marks row below): the first cut's taste note landed on the source's name strip, and its 40-unit gap let a proposal's strip sit on the source's marks row.
- **2026-10-14** — Open: an agent can still `isocan rm` its own proposal and free room (the guide says not to); kept and deleted proposals are not yet judge-corpus labels (a third corpus kind); on a group canvas a proposal lands at the root, not in the source's group; `--hunch` does not draw rough.

## Phase 2 — The night watch

**Status: CLOSED, 14 October 2026.** `/goodnight` in the Chat (or `isocan goodnight`) summons the lead (`proactive=<name>` on the canvas, else the first answerable standing agent, critics excluded), which reads `goodnight read`, opens with settled today, left open and what it could try, and is steered in the Chat; **That's the plan** (a button, the words, or `goodnight plan`) ends it. Only then does `goodnight note` write the note (Settled today, Left open, Tonight I will, Will not touch, a thought, Ready by; its model in `handoffNote`) and hang an empty `proposal=promised` frame beneath each promise. Core `planNight` holds the rules: agreed lines only, the cap with promised frames counted, an edit only on an item the person named, never the design system or anything settled today, never an item another person's open goodnight named; with nothing answerable the note promises nothing and says why. Untick by checkbox, ⌫/**Not tonight** or `goodnight untick`. The night fills (`goodnight fill`, a new version for a named original) or fails each frame with a reason; `goodnight done` posts the brief as a Chat `record` with `goodnight: {step: "brief"}` once every ticked line is answered. `goodnight.test.ts` (core 15, CLI 4) and the `proactive-night-watch` journey (real `isocan rc`, a fake ACP agent as Kit, no model). Deep suite 835 of 836, the one a connect timeout under load in `passes.test.ts`, which passes alone. Entry 723,869 → 725,217.

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
- **2026-10-14** — Decided (Dion): the agreed work may edit an original the conversation named for editing, as a new version the morning review lists; everything else stays beside, as proposals. Each person leaves their own `/goodnight`; one person's promises never touch an item another's conversation named.
- **2026-10-14** — "That's the plan" is the one summons for the night: the lead writes the note and its frames and does the work in that turn, so an untick races the work. Open: a separate send, if that race matters with a real model.
- **2026-10-14** — With nothing to answer, the person's own client writes the note, which promises nothing and says why.
- **2026-10-14** — Promised and failed frames are proposal states the reducer counts toward five; a promised frame must cite `promise:<note>#n`, and Keep refuses an empty frame or a failure with no take.
- **2026-10-14** — Open: when a note stops blocking another person's night (ready-by, or every ticked line answered); every standing agent wakes on `/goodnight` and the non-leads spend a turn staying silent; a second `/goodnight` the same day writes a second note; the proposal cards overlap neighbouring frames at low zoom.
- **2026-10-14** — Entry 725,217, 18,917 past the ceiling against a jump of 20,000. Dion: finish the phases, then a slimming pass.

## Phase 3 — The morning review

**Status: CLOSED, 14 October 2026.** Core `morning.ts`: `morningDue` (this person's latest goodnight note, not yet reviewed, its night over, their seen mark older than ready-by; no goodnight, no review) and `nightReview` (a headline only when the night failed or made nothing; the brief found by its `goodnight` data; at most `PROPOSAL_CAP` proposals, sure, hunch, then failed with its reason; Left alone; originals edited because the person named them, each with the version before). The phone's digest leads with `MorningBrief`; on desktop a lazy `AwayPanel` shows only when a review is due. `isocan goodnight review` prints the same. "Mid-way" items (content edits in the hour before `/goodnight`) are off limits unless named: `planNight` refuses the line and `propose` refuses the night's extra proposals on them. Seeing the review closes the note (`handoffReviewed`) with a write that has no inverse. The `proactive-morning` journey: brief first, proposals in order with the failure's reason, Left alone, Checkout the only edited original with its compare, the other screens unchanged byte for byte, the note closed and still closed after a ⌘Z, and no review after a later seen mark. Deep suite 837 of 838: the one a test pinning a line that `da6fcb916` changed, fixed in `4e8c2035e`. Entry 725,389 → 725,793.

**Outcome:** the "While you were away" panel on desktop as well as the
phone, leading with the agent's brief (found by its `record` data), at most
up to five proposals in confidence order, **Left alone** with reasons, then the
digest; promised frames filled or filled with a reason; the rule that an
item the person edited in their last hour is off limits unless named.

**Proof:**

- Journey `proactive-morning` (stub agent, a fixture night): returning past
  *ready by* shows the brief first, its proposals (at most five), one failed promise with
  its reason, and the person's screens unchanged byte for byte except an
  original the goodnight conversation named for editing.
- Unit: a sixth proposal from the night is refused; a seen mark newer than
  *ready by* shows no review.

### Trajectory

- **2026-10-14** — Decided (Dion): five, and it does not scale with time away; nothing new until what is there is kept or deleted. Open: the wording when the night found nothing. Waits on Dion.
- **2026-10-14** — The review is derived, not stored: the note's model, the lead's proposals made after the note, and the brief record; `isocan goodnight review` and the panel read one `nightReview`.
- **2026-10-14** — Seeing the review closes the note with a write that has no inverse (`invert.ts`), so it is on nobody's ⌘Z; the panel sends it once. This answers phase 2's "when does a note stop blocking".
- **2026-10-14** — Proposal notes are placed against real neighbours (`placeCards`): beneath their own frame first, beside only when clear, a chip when there is no room, so none covers another frame at any zoom; the night-watch journey checks it at four zooms.
- **2026-10-14** — Open: the failed or empty night's wording (drafts in `morning.ts`); whether desktop shows the ordinary digest when no review is due (no, for now); older open proposals count toward five but are not listed; the digest below the brief lists each of the agent's overnight edits. Waits on Dion.

## Phase 4 — Explain this item

**Status: CLOSED, 14 October 2026.** Core `explain.ts`: `explainStory` reads the canvas alone (versions grouped into moves by one hand, split where a comment announced the work; a choose, a kept proposal or an adopted decision stands alone), picks at most four seams for Plain and Designer and every move for Deep dive, and lists the roads not taken (trashed variations, deleted proposals, unadopted options), what moved around the item since (a newer DESIGN.md, relatives, proposals beside it) and speak-design pairs. One renderer, `explainSections(story, depth)`, feeds the panel, `isocan explain` and Copy as rationale. A panel beside the canvas, loaded on click; Escape closes it with the view and selection untouched and nothing written. **Critique** asks the lead in the Chat; it answers with `explain --critique`, a record comment plus a proposal citing `explain:`; with nothing to answer the button is disabled and says why. `explain.test.ts` (core 19, CLI 5) and the `proactive-explain` journey (real `isocan rc`, a fake ACP agent). Entry 725,793 → 726,107, 193 bytes under the jump.

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
- **2026-10-14** — The seams come from the canvas, not `timeline.ts` weights (every `item.addVersion` weighs the same): runs by one hand, split where a comment announced the work, turn fifty versions into four.
- **2026-10-14** — `laneFor`'s open span over-claims for a history, so Explain bounds each comment to versions within two minutes after it; the Chat's own lane is unchanged.
- **2026-10-14** — The goodnight CLI test took 37 s on CI against a 30 s limit (12 s here), which kept main red: it moved to the deep lane with a two-minute limit.
- **2026-10-14** — Open, waits on Dion: one depth setting for the whole app or Explain only; pins drawn on changed regions; asking for a second critique; a wire's slot-level why and "behind" are pointed at, not shown.

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

# The agent that proposes — the mechanism

**13 October 2026.** Specified from a brainstorm of ten drawn concepts: its
written handoff first, then the canvas itself — the framing note, the notes
beside each screen, the two lists of further ideas, the design system, and
two of the screens as drawn. Nothing is built. The scenes are [`journey.md`](journey.md); the walk is
[`phases.md`](phases.md).

**The debt it discharges.** Every agent on a canvas today waits to be
addressed. The parts of a proactive agent already exist in pieces, each in
its own project and none joined:

- wireframes draws a screen it is unsure of as a dashed *maybe*;
- design-partner keeps a brief whose facts say whether a person supplied
  them or the agent assumed them;
- design-competition has nine critic packs;
- the night shift lands one measured fix per night;
- the oplog records every undo.

This project is the joining, around one primitive.

## The sentence

> **An agent may propose and never replace. It says why in design words, and
> it learns from what you delete.**

## The six rules, as things a test can check

The brainstorm's ten screens share one grammar. A build keeps it, because
the ideas depend on it. Each rule is stated so that a test, not a reviewer's
eye, holds it.

| # | Rule | How it is held |
| --- | --- | --- |
| 1 | **A proposal never replaces.** Solid frame is a person's work; dashed frame is an agent's proposal, hanging under its source. | Making a proposal is one `item.add`. A test asserts that no op an agent sends while proposing names the source item as its target. |
| 2 | **Fidelity is confidence.** | One number per proposal, three bands, one function in core that maps number to band; the web draws from the band and nothing else. |
| 3 | **Every proposal cites its trigger.** | `propose` refuses without a citation that parses and resolves on this canvas. |
| 4 | **The why is in design vocabulary.** | Terms come from one glossary in core; the renderer underlines only terms the glossary holds. |
| 5 | **Delete is the main gesture and it teaches.** | Deleting a proposal and appending its taste line are one op group, so one undo restores both. |
| 6 | **One lead voice, with visible restraint.** | A cap per run enforced where proposals are made; a run that hit the cap must write its *left alone* list. Critics hold a grant that cannot edit. |

## The primitive: a proposal

A proposal is an **ordinary item with four properties**. No new item type
and no new operation: the wireframe module already does exactly this with
`wireMaybe=<p>` on an `item.add`, and this promotes the idea out of one
module into core so every feature here can use it.

| Property | Value | Meaning |
| --- | --- | --- |
| `parent` | an item id | the screen it came from — the lineage property variations already use (`core/src/lineage.ts`) |
| `proposal` | `edit`, `brief`, `audit`, `night`, `critic`, `stuck`, `ripple`, `walk` | it is a proposal, and what kind of trigger made it |
| `proposalP` | `0`–`1` | the agent's confidence that the person will keep it |
| `proposalCites` | a citation (below) | what triggered it |

The **why** is the proposal's first comment, written by the agent that made
it: two sentences, in the glossary's words. A comment and not a property,
because it is prose a person may answer.

**Keeping** is an ordinary act on the source: the proposal's current version
is copied onto the source as its next version (`item.addVersion`), the way
design-competition's `take` does, "a copy, never `choose`, so the arena stays
the record". The proposal is then marked `proposal=kept` and stays where it
is. One undo.

**Deleting** is `items.delete` on the proposal and a new line in the Taste
card, in one op group.

**Comparing** is the existing version diff (`isocan diff --source`).

Both surfaces:

```sh
isocan propose <file> --of <item> --p 0.6 --cites edit:1482 --kind edit --why "…"
isocan proposals [--of <item>] [--json]     # open proposals, surest first
isocan proposal keep <proposal>
isocan proposal dismiss <proposal> [--noted "…"]
```

On the web, Enter keeps and Backspace dismisses when a proposal is selected,
with no dialog. A hunch's Enter is *develop*: it asks for the finished
version, which arrives as a new version of the same proposal.

A dismissal may carry one of two reasons a person picks instead of a note:
*not for this project* (the default; it writes the taste line) or *the
evidence is wrong*, which is recorded against the citation, not as taste.

### Settled: what the agent will not touch

The concept screens show a state on each screen — *settled today*, *left
open* — and the agent's *will not touch* list is defined by it. So a screen
can be **settled**: the property `settled=<date>`, set when a person keeps a
proposal onto it, or says so (`isocan settle <item>`, and the same from the
screen's menu). Editing a settled screen unsettles it.

**No proposal is made against a settled screen** unless the person named
that screen in a promise. `propose` refuses it, which is how *will not
touch* is a rule and not a sentence. The governing DESIGN.md is always
treated as settled: an agent proposes a change to it and never makes one.

### How it looks: authorship is the only thing allowed to be loud

The brainstorm's design system gives one rule for colour, and it is the
right one to keep: the chrome stays neutral, and colour says **who made this
and how sure they are**. Four tokens, in both themes, checked for contrast
by the accessibility persona like any other:

| Token | Used for |
| --- | --- |
| `--proposal` | a dashed frame and its connector: an agent's proposal, drawn finished |
| `--hunch` | a dashed frame with no fills: a proposal the agent is unsure of |
| `--evidence` | the citation chip, always a chip and never a fill |
| `--keep`, `--risk` | a verdict only: kept, in sync, blocker |

Critics each get one quiet colour, on their pins and nowhere else.

### How it speaks

The agent talks like a senior designer at the next desk: first person,
short, specific, naming the trade-off, and saying what it chose not to do.
It never says "I've generated". That last one is checkable, and goes into
the copy lint's list of tells.

### Confidence, and what is drawn

| Band | `proposalP` | Drawn as |
| --- | --- | --- |
| **sure** | ≥ 0.5 | finished, in a dashed blue frame |
| **hunch** | 0.3 – 0.5 | the same content under sketch chrome: pale, no fills, a three-bar mark |
| **left alone** | < 0.3 | not drawn; one line in the run's *left alone* list, with the reason |

The cut points are wireframes' own (`NEEDS_YES = 0.5`, `MAYBE_FLOOR = 0.3`).
They are reused rather than invented, and they are a starting point:
wireframes measured its judge as overconfident by about 0.4. **Every keep
and every dismiss is a label** for that number, in the shape `isocan judge
corpus` already reads, so the bands can be moved by evidence.

"Sketch" in the first version is **chrome the canvas draws around the item**,
not a re-rendering of its content. Drawing a designed HTML screen as a
pencil sketch is a rendering problem of its own; only wireframes can do it
today, and a hunch about a wireframe may use that.

### Citations

One small grammar, so a chip can be drawn and followed:

| Citation | Points at |
| --- | --- |
| `edit:<seq>` | an operation in this canvas's log — one of the person's edits |
| `comment:<id>` | something somebody said |
| `brief:<lineId>` | a line of the brief (below) |
| `design:<versionId>` | a version of the governing DESIGN.md |
| `audit:<itemId>#<rule>` | a design-audit finding on a screen |
| `taste:<n>` | a line of the Taste card |
| `proposal:<itemId>` | another proposal, for a synthesis |

`loop:<id>` is deliberately absent. The brainstorm treats "Loop" as a source
of product insights that arrive overnight. In this repository Loop findings
are markdown about isocan's own code (`docs/loop/`), and no canvas agent can
read them. An insight source for a person's own product is a separate
project; this one cites only what a canvas holds.

## Taste: what a delete teaches

A **Taste card** is one markdown item per canvas, marked `taste=1`. Each
dismissal appends a line: `noted: <what the agent took from it>`. The person
edits the card like any other text, and that is the feature: the note is
visible, and wrong notes get corrected.

- It is written with `isocan edit --if-version`, the conditional edit, so an
  agent's append never lands over a person's correction.
- Agents read it as context: it is pinned for every design request on the
  canvas (`context` pins exist).
- It is per canvas. Carrying taste across canvases is what the memory
  project's personal context is for, and is a later step.

Nothing stores "why" for a preference today: `core/src/preference.ts`
deliberately has no such field, and removing a wireframe *maybe* records
nothing at all.

## The brief, as lines that can be cited

The intent card is mostly built, under another name. `DesignBrief`
(`core/src/design-partner.ts`) has `audience`, `primaryTask`, `constraints`
and `facts[]`, and each fact has an `origin`: `supplied`, `context` or
`assumed`. That is the card's *said* against *inferred*.

What is missing, and what this project adds:

- **Three more lines**: *should feel*, *never*, *right now*.
- **A stable id per line**, so `brief:<lineId>` can cite one.
- **A card a person can edit.** Today the brief is JSON, stamped by its
  writer, and exists only inside an admitted design request, in a workflow
  that is opt-in.
- **Right / Wrong on an inferred line**, which turns `assumed` into
  `supplied` or removes it.

An edit to the brief **changes nothing by itself**. It re-reads: every screen
is sorted into *still holds*, *assumed the old line*, and *matters more now*,
and the agent asks the one question that matters (*instead of regulars, or
as well as?*), with a proposal drawn for each answer.

*Right now* is the one line that is a mode and not a fact: **exploring**,
**refining** or **shipping**. It sets how the agent behaves — many hunches
while exploring, quiet precision while refining, critics and checks before
shipping — and the person can overrule it like any other line.

## Ripple, and the pulse

When an iteration on one screen settles, the agent reads the run of edits
back as **a few named decisions** (*anchored primary action*, *summary
before detail*). This is the teaching moment, and it is a proposal like any
other: the decisions are its why.

Every other screen is then one of three states: **would change**, **in
sync**, or **disagrees**. The person chooses the altitude: update the design
system so future screens follow, go screen by screen, or mark the source an
intentional one-off (`rippleException=<date>`) so the agent stops asking.
The agent may argue *for* an exception when one is warranted. Previews only,
until confirmed.

The **pulse** is the same three states drawn small: one tick per screen —
current, behind, in conflict — in the canvas's top bar, always. It is the
quiet proof that nothing was left behind, and the way back into the ripple.
It needs the per-screen state and nothing else, so it can ship before the
previews do.

## Triggers: computed, never guessed

A trigger is a **pure function over what the canvas already records**, in
core, with its thresholds in one file. No model decides that somebody is
stuck.

| Trigger | First definition | Reads |
| --- | --- | --- |
| **returned** | the prior visit ended 4 or more hours ago, and open proposals exist | `PriorVisit` from the seen-mark (`core/src/seen.ts`) |
| **settled** | 3 or more edits to one item inside 10 minutes, then 90 seconds with none | the log |
| **stuck** | 3 or more new versions of one item inside 10 minutes, each from an ask of 6 words or fewer, with 2 or more undone inside 30 seconds | the log's undo entries (`core/src/undone.ts`), version stacks |
| **left for the day** | the person says so: `/handoff` | nothing inferred |

These numbers are guesses, and are labelled as guesses. Each detector runs
**in shadow first** — it logs when it would have fired and does nothing — and
is switched on only after its false-alarm rate has been read on real
canvases. That is the voice fast path's own rule, and `isocan evals corpus`
already produces the per-ask rows (`undone`, `opsUndone`) to read it from.

Two things the log does not record, and the stuck detector needs: which ask
produced a version, and how long the ask was. Both are derivable from the
comment a request came from; phase 2 says whether that is enough.

## Who acts: nothing nobody launched

The house rule, from standing-agents, is that "no agent is ever spawned by
machinery nobody launched". A proactive agent presses on that rule harder
than anything before it, so the answer is stated once:

- **A trigger wakes only an agent a person parked and told to watch.** Today
  an agent wakes on a comment that addresses it. A watch is a standing
  instruction the person gave — in words, on the canvas — that lets the three
  computed triggers above wake that one agent.
- **Or it makes an offer inside a turn the person started.** The stuck
  question and the vague-word readings interrupt a request the person just
  made. Nothing new is launched.
- **Unattended work is launched by the handoff note.** Each ticked line is a
  promise the person approved, with a budget. A promise is one of three
  kinds, as drawn: **draw** (up to N takes on a screen, some of them
  hunches), **fix** (one proposal against a named finding), or **watch**
  (no design at all: a report on one question, whichever way it goes). An
  unticked line is an offer and spends nothing. `rcLimits.agentChain` pauses an
  agent after three turns with no person's word; a ticked line **is** a
  person's word for that line's turns and no more. It is not a way round the
  limit.
- **It runs where the person's agents run.** That is `isocan rc` on their
  machine. A laptop that slept did nothing overnight, and the morning says
  that in those words.

The concept draws the morning as fed by an outside source of insights that
arrived overnight. A canvas here has no such source, so the morning is fed
by **what the note promised** and by what the canvas itself holds: audit
findings, comments nobody answered, a brief line that changed. The note
also takes one free line — *a thought for the night* — which the agent
treats as a watch promise, and one choice of how to be told it is ready.

Each person leaves their own note. A promise spends that person's key and
runs on that person's machine, so a team's shared night is several notes,
not one.

`scripts/night.mjs` already does a narrow version of this for this
repository: one measured fix per night, landed as a version, with a
three-line comment. It is the precedent, not the mechanism: it is a script
somebody schedules, not a promise somebody made.

## Design words

One glossary in core, two uses:

- **Terms**: `visual hierarchy`, `affordance`, `density` and the like, each
  with one plain sentence. A term in an agent's comment is dotted-underlined
  and opens its definition in place.
- **Vague words**: `pop`, `cleaner`, `modern`, `busy`, each with two or three
  *named readings* (`pop` → contrast, scale, colour) and the sentence a
  designer would say for each.

It is a hand-kept list, on purpose. local-judge phase 1 measured a zero-shot
model at about the accuracy of a regex on Chat intents; a list that names
forty words is honest about what it knows. DESIGN.md's Voice glossary
(`core/src/copy-voice.ts`) is a different thing — a product's own wording —
and stays separate.

The concept's own note raises the risk that stopping to ask feels like
friction, and offers a way round it: **send the best reading, and show the
others as hunches.** That is the default here. The request goes with the
reading the glossary lists first, and the other one or two readings arrive
as hunch proposals beside the result, so nobody waits and the word is still
taught. Asking first is a setting, for people who want it.

The panel keeps three lists and counts nothing: words you now use, words
you have seen and not used, and **your words the agent has learned** (*the
thumb button*). The agent may use a coinage back once the person has used
it twice.

A depth setting (Plain, Designer, Deep dive) chooses how much of this an
agent's comments carry. One setting, per person, everywhere.

## What exists, checked against the code

The handoff mapped each idea onto isocan features from the CLI guide alone,
and said so. Checked at `7bb1f4e9`:

| Idea | Already there | Missing for the smallest version |
| --- | --- | --- |
| **1A Morning review** | seen-marks and `PriorVisit`; a "while you were away" digest (phone layout only); `parent=` variations; `prefer`, `choose` | a proposal flag, a citation, confidence on a variation, a desktop surface |
| **1B Night watch** | `rc turn`, `rcLimits`, per-run persona budgets, `scripts/night.mjs` for this repo | an end-of-session note, promises, a budget per line, anything that schedules |
| **1C Maybes** | all of it for wireframes: P(yes), the maybe band, dashed marks, ⇧K keep, `wire why` | Enter to develop; anything recorded when a maybe is removed |
| **1D Ripple**, and the project pulse | `design audit` per screen (off-system values, candidate token repairs); `wire style` re-renders wireframes | an index of which screen uses which token; a settle trigger; a would-change preview; re-rendering designed HTML; any notion of a component; a per-screen state (current, behind, in conflict) to draw a pulse from |
| **2A Explain** | `versions`, `diff`, `timeline --majors`, `history`, `lens`, per-op words | one fold per item; a reason on a version (versions have no note); "what changed in the system since" |
| **2B Critics** | nine packs with a `critique.md` each and principle-first names; `react --at` pins a point | packs as critic-only lenses (today they compete and build); a comment-only grant; the agree / split / blocker read |
| **3A Intent card** | `DesignBrief` with said / assumed facts; questionnaires and their UI | three fields, line ids, an editable card, a brief outside the opt-in workflow |
| **3B Design words** | a `clarify` route in `core/src/intent-route.ts`; `words lint` | any hook in the Chat composer; a design glossary; named readings |
| **3C Stuck** | undo entries in the log; the `visual-cards` question renderer | a detector; a gate that stops generation; a question outside a design request |
| **3D Walkers** | a clickable prototype with typed hotspots; deterministic screen graders (contrast, names, three widths) | any walk format, simulated person, or pinned stumble |

Corrections to the handoff's mapping, so nobody builds on them:

- There is no `isocan memory`; memory is `context inherit` and
  `context personal`.
- `isocan whatsnew` is the product's changelog, not news about a canvas.
- `design reconcile` saves a projected DESIGN.md back to its source. It does
  not reconcile screens to a system.
- Personas (`.agents/personas/`), the `journeys` persona, the `accessibility`
  persona and `docket` are about **this repository**, not a person's canvas.
  `sandbox` runs a program file.
- `Actor` is `{id, name}`. There is no agent bit on it; agent-ness comes from
  `GET /api/kinds`. "Solid is a person's, dashed is an agent's" therefore
  rests on the `proposal` property, not on who made the item.

## The handoff's open questions, answered

Each was answered to proceed; each can be reopened.

| Question | Answer chosen | Why |
| --- | --- | --- |
| **Named personas** | Principle-first names: *Less but Better*, not a person's name. A credit line may say "after". | design-competition decided this on 11 Sep and a validator enforces it. The packs already exist. |
| **When has an iteration settled; when is someone stuck; when have they left** | The table under *Triggers*; "left" is never inferred. | A computed rule can be measured and tuned. A guess cannot. |
| **Caps** | Three proposals per run, as drawn. The run must list what it left alone. | The number matters less than the cap being enforced in one place and the remainder being visible. |
| **Explain: mode or panel** | A panel beside the live canvas. The concept draws a full mode, with a scrubber and numbered pins on the screen; the pins stay, on the live item. | A mode hides the thing being explained, and a canvas already has room. |
| **Scoring** ("6 of 10 prompts needed no translation") | Not shown. The vocabulary panel lists words; it counts nothing. | The brainstorm's own rule: nothing is graded. |
| **Simulated users** | The concept walks a flow as five people. Three of them are measurable and come first, as **lenses**: *one-handed* (targets outside thumb reach at 390 wide), *low vision* (contrast, and the screen redrawn washed-out so the problem is seen, not read as a ratio), and *screen reader* (accessible names and order, which the graders already check). *Second language* and *first-timer* need a model, and come after, beside these. Every result says it is a check, not a test with a person. | A measured constraint cannot be a caricature. |
| **Is the handoff only at day's end** | Any time: `/handoff` is the person's word, whenever they say it. It is offered, never forced, and "not tonight" is one tap. | "Left for the day" is never inferred. |
| **Does the morning's brief live in the panel or on the canvas** | Both: a Chat entry that says it in three lines, and a note on the canvas the person can keep. | The canvas is the channel that keeps. |
| **May the agent work on a screen left half-done last night** | Only if a ticked promise names it. *Left open* lists it; listing is not licence. | Consent is per line. |
| **How many pencil lines may the brief carry** | Three inferred lines at most; a fourth waits until one is answered. | An agent that infers everything has asked nothing. |
| **Do critics see each other's notes** | No. Each reads the screen alone. | The split is only real if it was not negotiated. |
| **Failure** | An unfilled frame holds one sentence saying what happened and why. A night that produced nothing says so first, above everything. | Rule 6, applied to bad news. |

## Not in this project

- An insight source for a person's own product (the brainstorm's "Loop"),
  which the concept leans on for most of its evidence. Everything here that
  cites it in the drawings cites something a canvas holds instead.
- Rendering designed HTML as a sketch.
- A notion of a *component*. Ripple's first version is about tokens.
- Taste that follows a person across canvases.
- Model-driven simulated users.

## Open

- **A grant that may comment and not edit.** The rungs are `view`, `read`,
  `edit`, `own` (`core/src/grants.ts`). Whether `read` may comment was not
  established here; critics need exactly that capability, and may need a
  rung of their own.
- **What a watch is, as data.** A property on the agent's enrolment, or a
  standing comment the wake rule reads. The wake rule is deterministic today
  and must stay so.
- **Where the handoff note's promises live.** A markdown item with a checkbox
  list is the simplest thing that is visible and editable; whether a budget
  per line can be enforced from prose is what phase 4 finds out.
- **Whether the brief can leave the opt-in design workflow** without
  becoming a second brief.

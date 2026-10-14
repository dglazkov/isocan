---
status: designed
since: 2026-10-14
see: design-partner, wireframes, standing-agents, personas, version-diff, copy-edit
note: "The mechanism for a proactive agent: a proposal is an ordinary item with parent= and a few properties, drawn dashed outside itself like a wireframe maybe, kept with choose and deleted with one key; a delete summons its author, who writes a line in a pinned taste note. One lead agent per canvas, a standing agent through isocan rc, is woken by triggers the rc derives from the op stream or the person asks for. Then a section per moment: night watch, morning review, explain, the brief card, ripple, stuck, critics, walkers, design words."
---

# A proactive agent — design

**The debt this discharges.** `journey.md` asks for an agent that speaks
first, at a handful of named moments, without ever touching a person's work
uninvited. Every agent in isocan today waits for a comment: `isocan wait`
wakes on a mention, the Chat or a thread it is in, and `isocan rc` wakes a
standing agent the same way. This is the mechanism for the other direction,
and the one grammar every moment shares, mapped onto what isocan already
has.

## 1. What already exists, and is reused

| Need | What isocan has | Where |
| --- | --- | --- |
| Work made *from* other work | `parent=<itemId>` on the child, by convention, undone by undo | core `lineage.ts` (`PARENT_PROP`, `childrenOf`) |
| Fold a winner back | `choose`: the winner becomes a new version of its source, its siblings go to the trash, one undo | core `converge.ts` |
| A recorded preference | `prefer`: this over that, kept as a fact | core `preference.ts` |
| A dashed mark drawn *outside* an item | the wireframe *maybe*: a derived mark, a dashed outline and a tag, gone when kept | `packages/modules/wireframe/src/maybe.ts`, `maybe-marks.tsx`, `compose.ts` (`MAYBE_FLOOR`) |
| Low fidelity as a drawing style | `fidelity=wireframe` on a screen; the wire renderer's blue skeleton and grey fill | core `design-scope.ts` (`FIDELITY_PROP`), the wireframe module |
| "This is behind; the mark asks" | a wire is *behind* its design system, derived on every read; restyling on its own is refused | `packages/modules/wireframe/src/behind.ts`, `behind-marks.tsx` |
| A standing agent that answers | enrolment, `isocan rc`, the bench, pets that follow their owner | `packages/rc/src/room.ts`, core `roster.ts`, `bench.ts` |
| What a summons carries | the thread's earlier comments and the anchored item | `SummonsContext`, `packages/rc/src/helpers.ts` |
| Whether a summons reached anybody | answerable or not, said in words | core `summons.ts`, `roll.ts` (here / back / away lines) |
| A click as a request | a prototype click becomes an ordinary comment carrying data, mentioning the author | core `prototype-click.ts` |
| Where you were, and what is new since | per-person seen marks at the home; a "While you were away" digest | core `seen.ts`; web `lib/visitdigest.ts`, `components/VisitDigest.tsx` (phone face only today) |
| History at a glance | significance-weighted seams; decaying recap | core `timeline.ts`, `recap.ts`, `activity.ts` |
| What a message *made* | comment → items it produced | core `lane.ts` |
| What changed between versions | one diff engine | core `diff.ts` (`diffVersions`), `isocan diff` |
| A design brief | audience, primary task, constraints, intent (create / extend / refine), fidelity, and **facts whose origin is `supplied`, `context` or `assumed`** | core `design-brief.ts`, `design-request.ts`; web `DesignTaskPanel.tsx` |
| Questions asked with pictures | question sets with a `visual-cards` renderer, a named human respondent, 0–3 questions on a first pass | core `questionnaire.ts`; web `QuestionnaireDock.tsx` |
| Comparisons and decisions | options with a hypothesis and trade-off, an attributed recommendation, one reversible adoption | core `design-decision.ts`; web `DesignComparisonDialog.tsx` |
| Screen styling against the system | parsed audit with coverage and repair candidates | core `designaudit.ts`, `isocan design audit` |
| Group-scoped design systems | a DESIGN.md governs where it sits | core `design-use.ts` |
| Words across screens | Voice glossary; one name per thing; copy tells | core `copy-voice.ts`, `copy-lint.ts`, `isocan words lint` |
| Contrast as a number | sRGB maths shared by audit and lint | core `contrast.ts`; `/accessibility-audit` |
| Personas | a lens, a goal and a memory, read from `.agents/personas/` of the bound directory | core `persona.ts`, server `personas.ts`, `isocan persona` |
| Findings that want a person | ✅ / ❌ marks on docket items | core `docket.ts` |
| Pinned and excluded context | a property, no new op | core `contextmark.ts`, `isocan context pin` |
| Asks and what happened next | a read over the oplog, including undone ops | core `evals.ts`, `undone.ts` |

Nothing here needs a new op. Every write below is `item.add`,
`item.update`, `item.delete`, a comment, or a design op that already
exists.

## 2. The shared grammar

Seven rules, the same in every moment, so a person learns them once.

1. **Solid is the person's; dashed is a proposal.** A proposal is an
   ordinary item placed beneath its source and carrying `parent=` plus a
   `proposal` property. The canvas draws it with a dashed blue outline and a
   chip *outside* the item, derived on every read, as the wireframe *maybe*
   already is. A proposal never replaces a screen. §3 is the mechanism.
2. **Fidelity is confidence.** A proposal the agent is sure of is drawn
   finished; a hunch is drawn at `fidelity=wireframe` (a screen) or as
   pencil-faced text (a note). The `proposal` property carries the
   confidence (`sure` or `hunch`), and the agent's word decides it, not a
   threshold the person cannot see.
3. **Every proposal cites its trigger.** `proposalCites` lists what prompted
   it: a comment, an op by seq, an item version, a DESIGN.md version, a
   brief fact, a promise, a docket finding or a critic's note. The chip
   shows the first; the panel shows all. **No trigger, no proposal**: the
   CLI refuses a proposal with an empty list.
4. **The why is in design words.** `proposalWhy` is at most two sentences.
   A small glossary in core (`design-words.ts`: term, one-line definition,
   the plain phrases that mean it) lets every surface dotted-underline a
   known term and define it in place. The same table drives §12.
5. **Delete is the main gesture, and it teaches.** One key, no dialog, one
   undo. The delete summons the proposal's author, which writes one line in
   the canvas's taste note. §3.
6. **One lead voice, with restraint you can see.** One agent per canvas
   proposes (`proactive=<agent name>` on the canvas, set by the person).
   It caps itself at five open proposals per canvas (`PROPOSAL_CAP`;
   Dion, 14 Oct 2026: three felt small), says what it chose
   not to do, and states what it will not touch. A result ends with at most
   three next moves, at different altitudes (this screen, the flow, the
   system). Critics and walkers are guests: their notes are comments the
   lead posts wearing a persona (§9, §11), and only the lead acts.
7. **Never over a run of edits.** No moment fires while the person is
   editing: a trigger waits for the person to be quiet on that item.

## 3. Proposals, and deletes that teach

**Trigger:** any moment below, or an agent that has a reason.

**What the person sees:** a dashed copy hanging beneath the source, joined
by a connector, with the trigger chip and the why. **Keep** folds it into
the source as its next version (`choose`); **Compare** opens the existing
side-by-side diff inspector; **Delete** (⌫) trashes it, and a moment later
the Chat says *"Noted: …"*. **What your deletes taught** is a text node on
the canvas, titled so, pinned into context, editable like any note.

**Rules:**

- The properties: `proposal=sure|hunch`, `proposalCites=<JSON list of
  {kind, ref}>`, `proposalWhy=<text>`; `parent=` from `lineage.ts`. A core
  module `proposal.ts` is the one reading: `proposalMarked`, `proposalsOf`,
  `proposalRoom(canvas, actorId)` (how many of the five are free).
- Placed beneath the source with the existing anchor placement, never on
  top of anything.
- Delete is a summons: like a prototype click (`prototype-click.ts`), the
  web app writes an ordinary comment on the proposal's thread carrying
  `{ deleted: itemId }` as data and mentioning the author. The person may
  type a reason in the toast ("the trigger was wrong" is one); empty is
  fine. The author answers by appending one line to the taste note. If
  nobody can answer (`summons.ts`), the delete still happens and the toast
  says the note was not taken.
- The taste note is ordinary text with `taste=1` and `context=pinned`
  (`contextmark.ts`), so `isocan context` hands it to every agent. One per
  canvas. The person edits or clears it; nothing else is stored.
- Kept and deleted proposals are labels for the judge corpus, the way kept
  and removed *maybes* already are.

**Smallest version:** `isocan propose <source> <file> --cites <ref> --why
"…" [--hunch]`, the dashed mark and chip in the web app, Keep / Compare /
Delete, and the taste note written by hand-run agents. No triggers yet.

**What exists:** the wireframe maybe (mark, tag, keep property), `choose`,
the diff inspector, lineage, context pins, the prototype-click road.

**Open questions:** whether a proposal for a non-screen item (a note, a
DESIGN.md) is drawn the same way (phase 1 draws it the same; Dion to
confirm). The cap is five open proposals per agent per canvas.

## 4. The night watch

**Trigger:** the person says they are stopping, and only then:
`/goodnight` in the Chat (or `isocan goodnight` in the terminal). Nothing is
offered on a closed tab or an idle pointer (decided, Dion, 14 Oct 2026).

**A conversation first.** `/goodnight` opens a thread with the lead agent,
in the Chat, to talk through what the person wants worked on overnight. The
agent opens with what it read (settled today, left open, and two or three
things it could try, each with why), and the person steers: add, drop,
reword, "not that one". The thread ends when the person says so (**That's
the plan**, or a word to the same effect), and only then does the agent
write the note below from what was agreed.

**What the person sees:** a handoff note written by the lead agent, as a
text node near the work: **Settled today**, **Left open**, **Tonight I
will** (a ticked, editable list, each line with its budget), **Will not
touch**, a free line, and **Ready by**. Under each screen a ticked line
concerns, an empty dashed frame: a placeholder proposal with
`proposal=promised`.

**Rules:**

- *Settled today* is derived, not written: today's `choose`, design
  decisions, kept maybes and `prefer` records by this person, and new
  DESIGN.md versions. *Left open* is the open questions
  (`comment list --open`), unkept maybes and proposals, and doubts the agent
  read in today's comments, each cited.
- Only ticked lines are promises. The morning fills exactly the promised
  frames, and a promise that fails fills its frame with a reason and, where
  there is one, the take it would have shown.
- Before writing, the note says whether anything can answer overnight: a
  standing agent that is answerable (`summons.ts`, the bench). If none is,
  the note says so and promises nothing.
- *Will not touch* always includes what was settled today and the design
  system, and every original the conversation did not name for editing; the
  agent may add, never remove.
- The work runs through the standing agent's ordinary summons: the ticked
  note is a comment addressed to it, so the rc wakes it as for any other
  ask, and its budget is the rc's.

**Smallest version:** `/goodnight` opens the thread; one exchange settles
one promise; the note lists settled, open and that promise; one promised
frame; the morning review (§5) fills it.

**What exists:** `isocan rc`, the bench, `summons.ts`, `roll.ts`'s *away*
line, `comment list --open`, `converge.ts`, `preference.ts`, the maybe and
keep properties.

**Decided (Dion, 14 Oct 2026):** leaving is an explicit `/goodnight` only,
and it starts a conversation about what to work on; by the morning the
canvas has changed: the agreed work is on it.

**Decided (Dion, 14 Oct 2026), the rest:** the agreed work **may edit an
original** when the conversation named that item and said so ("rework the
checkout screen"); the edit lands as a new version of the item, so the
version before the night is one step back in its history and the morning
review lists every original it changed. Anything not named that way is still
work beside the person's, as proposals. And **each person leaves their own**:
two people on one canvas can each `/goodnight`, each conversation has its own
note and promises, and a promise never touches an item another person's
conversation named.

**Open questions:** *Open — waits on Dion:* whether a first session gets a
night watch.

## 5. The morning review

**Trigger:** the person returns after a `/goodnight`: their seen mark
(`seen.ts`) is older than the handoff's ready-by time. Without a goodnight
there is no morning review; the ordinary "While you were away" digest still
shows what others did.

**What the person sees:** their work untouched; the promised frames filled;
the "While you were away" panel, on desktop as on the phone, leading with
the agent's brief (at most three items, highest confidence first, each with
its two-line why), then **Left alone** (what the agent saw and did not act
on, with a reason), then the digest of what everyone else did.

**Rules:**

- At most five proposals per morning (`PROPOSAL_CAP`), whatever the night
  found, plus any original the goodnight conversation named for editing.
- Lower confidence is drawn as a hunch (§2.2).
- The brief is a comment the agent posted when its work finished; the panel
  finds it by its `record` data, so nothing has to be live at return.
- A failed or empty night says so plainly in the brief.
- Never on a screen the person was mid-way through: an item the person
  edited in the last hour before leaving is off limits unless a ticked line
  names it.

**Smallest version:** on return, one proposal beside one screen, its
evidence chip and a two-sentence why, and the brief at the top of the
digest panel.

**What exists:** `VisitDigest.tsx` and `visitdigest.ts` (phone face only
today), seen marks, `recap.ts`, `inbox`.

**Open questions:** *Open — waits on Dion:* whether five is the cap or it
scales with time away; what the morning says when the night found nothing
(the draft: one line, and the reason).

## 6. Explain this item

**Trigger:** select an item, choose **Explain** (menu, palette,
`isocan explain <item>`).

**What the person sees:** a panel beside the live canvas: **How it got
here** (the moves that mattered, each with who and the reason at the time,
pinned to places on the item), **The roads not taken** (siblings in the
trash after a `choose`, and options a comparison did not adopt, each
viewable), **What moved around it** (newer DESIGN.md versions, a wire now
*behind*, a word another screen now spells differently), and **Speak
design** (phrases typed about this item beside the designer's phrase). A
depth switch (Plain, Designer) changes the register. **Copy as rationale**
puts the explanation on the canvas as a note.

**Rules:**

- The story is derived, not generated: versions and their authors; the
  comment that made each version (`lane.ts`); design compare and decide
  records; `choose` and `prefer`; `wire why`'s recorded decisions for a
  wire; seams by `timeline.ts`'s significance, so fifty versions become
  four.
- A critique is an ask: *Critique* summons the lead agent, and its "one
  thing to try" arrives as a proposal (§3).
- Nothing in Explain writes to the canvas except *Copy as rationale* and a
  critique, both of which the person asks for.

**Smallest version:** `isocan explain <item>` and the panel: the three or
four versions that mattered with a one-line reason each, the roads not
taken, and design-system versions newer than the current one.

**What exists:** `show`, `version ls`, `diff`, `lane.ts`, `timeline.ts`,
`converge.ts` (the trash holds the losers), `design-decision.ts`, the
wireframe module's `why.ts` and `behind.ts`, `copy-lint.ts`.

**Open questions:** whether *Speak design* starts nudging the person's
asks elsewhere (that is §12); whether the depth switch is one setting for
the whole app.

## 7. The brief as a card

**Trigger:** always present on a canvas with an active design brief; the
key moment is an edit to a line.

**What the person sees:** a card item rendering the brief: **Making**,
**For**, **Should feel**, **Never**, **Constraints**, **Right now**. A fact
whose origin is `supplied` has a solid rule; `assumed` has a pencil rule
with **Right** and **Wrong**. Proposals' chips can cite a line (`cites ·
For`). After an edit, every screen is sorted into **still holds**,
**assumed the old line**, **matters more now**, and the agent asks one
clarifying question.

**Rules:**

- The card is a view of the brief, not a copy: edits go through
  `isocan design brief --update`, so the brief stays the record. **Right**
  turns an assumed fact into a supplied one; **Wrong** removes it and asks
  for the right value.
- An edit changes nothing by itself. It only re-reads: screens whose
  proposals or receipts cite the changed fact are *assumed the old line*;
  the rest *still holds*; *matters more now* is the agent's call and comes
  with its question.
- **Right now** is the brief's `intent` (create, extend, refine) plus a
  mode the agent reads from behaviour (exploring, refining, shipping),
  shown as an assumed line the person can overrule.
- Assumed lines are capped (four), so the card never reads as presumption.

**Smallest version:** the card for one brief, said and assumed lines,
Right / Wrong, and proposals that name the line they answer.

**What exists:** `design-brief.ts` (facts with `supplied | context |
assumed`), `design-request.ts`, `DesignTaskPanel.tsx`, receipts with
current / stale reasons.

**Open questions:** *Open — waits on Dion:* one card per canvas, per group,
or per design request (a brief belongs to a request today); whether the
card is on the canvas, in a panel, or both.

## 8. Changes ripple

**Trigger:** an iteration settles: the person made several versions of one
item and has been quiet on it for a while.

**What the person sees:** the edits read back as a few named decisions;
every other screen in scope previewed after them, changed regions outlined
and tagged, each in one of three states (**would change**, **already in
sync**, **disagrees, your call**); a choice of altitude (**put it in the
design system**, **screen by screen**, **this one is a one-off**); one
sketched idea the change makes possible, set apart. A **pulse** strip in
the top bar, a tick per screen (current, behind, in conflict), opens the
view.

**Rules:**

- Previews are proposals (§3) citing the source's version; nothing changes
  until the person picks an altitude and keeps.
- *Disagrees* may argue for the exception, in one line.
- *One-off* is a property on the source (`ripple=off`) so the agent stops
  asking; undo takes it back.
- The pulse is derived, like *behind*: a screen is behind when a token or
  term it uses changed after its version, in conflict when a ripple
  proposal for it was deleted or it is marked a one-off.
- A good move the person made by hand is named in the read-back ("you used
  proximity"), once, sparingly.

**Smallest version:** after an edit settles, list which other screens use
the changed tokens, values or terms (`isocan ripple <item>`), and offer to
preview the change on each.

**What exists:** `diff.ts`, `designaudit.ts` (per-screen styling against
tokens), `design-use.ts` (scope), `copy-lint.ts` (one name per thing),
`behind.ts` (derived *behind*, restyle refused without a click).

**Open questions:** *Open — waits on Dion:* when an iteration has settled
(time since the last edit, an explicit "I like this", or both); whether
the default altitude should ever be the design system.

## 9. Critics in the room

**Trigger:** critics the person switched on, run when asked, when the
person pauses, or before they share.

**What the person sees:** a list of critics with toggles, each a one-line
lens; *how loud* (blockers only, studio crit, everything) and *when* (when
I pause, before I share, only when asked; the default is only when asked);
pins in each critic's colour with the note beneath; the lead agent's read
of the room in three parts, **agree**, **split** and **blocker**, with
**build both** on a split.

**Rules:**

- A critic is a persona (`persona.ts`): a lens, a goal and a memory. The
  lead agent wears it; the critic's notes are comments the lead posts with
  `{ persona: <name> }` as data, so one actor is accountable and the canvas
  colours the pin.
- Critics never edit. A split is surfaced, never averaged away. *Build
  both* makes two proposals, each citing the critic it answers.
- Critics are lenses with names that describe the lens, never real people.
  A person can describe a new one, or point at work they admire and let
  the agent draft a lens from it.
- **Before you share:** `isocan share` and `present` (and their web
  doors) run a desk check first: `design audit`, contrast, `words lint`,
  wires *behind*, stale receipts, and any critic set to *before I share*.
  The check reports; it never blocks.

**Smallest version:** two critic lenses run on demand over one screen
(`isocan crit <item> --as <persona> --as <persona>`), with the lead
reporting agreements and disagreements separately.

**What exists:** `persona.ts` and `.agents/personas/` in the bound
directory, `isocan persona`, the docket, `design review`, `/design-audit`,
`/accessibility-audit`, `designaudit.ts`, `contrast.ts`, `copy-lint.ts`.

**Open questions:** *Open — waits on Dion:* where a canvas's critics live
when no repo is bound (a persona item on the canvas is the draft);
whether critics see each other's notes; whether a blocker can ever stop a
share.

## 10. Stuck detection

**Trigger:** several tries at one item in a short time, each result undone,
deleted or replaced, with asks getting shorter.

**What the person sees:** instead of another result, the agent says it has
been guessing; what it noticed in behaviour (what survived every try, what
was undone twice); a question with pictures: four now-and-instead pairs
(density, brand expression, layout, tone of voice), its own guess
highlighted; and two ways out, **show me extremes** and **name a product
that gets it right**.

**Rules:**

- Detection is a pure function in core, `stuckOn(entries, itemId,
  actorId)`, over the oplog the way `evals.ts` reads it (asks, results,
  `undoneSeqs`). The rc puts its answer in `SummonsContext`; the agent
  guide says what to do with it.
- The question is a design question set with the `visual-cards` renderer,
  so it is answered, skipped or delegated like any other.
- Observations are derived (what text and regions survived across the
  tries' diffs), and offered as observations the person can correct.
- Tone: the agent owns the miss; it never says the person is stuck.

**Smallest version:** after the third try, the fourth ask gets a
four-option visual question instead of a fourth generation.

**What exists:** `evals.ts`, `undone.ts`, `diff.ts`, `questionnaire.ts`,
`QuestionnaireDock.tsx`, `SummonsContext`.

**Open questions:** *Open — waits on Dion:* the trigger (tries, time, undo
speed, shrinking asks); whether the four axes are fixed or chosen per
screen.

## 11. Walk it as someone else

**Trigger:** the person asks for a walk of a task over a flow.

**What the person sees:** a lane per walker, each drawing the screens as
that person meets them (a thumb-reach overlay for one-handed use; blur and
washed-out contrast for low vision; the reading order for a screen
reader); stumbles pinned where they happen; an outcome per walker (made it,
stumbled, gave up); the stumble that trips several walkers called out, with
one fix as a proposal; and a plain line that these are simulations and do
not replace testing with people.

**Rules:**

- A walk follows a real path: a wire flow's prototype links, or a group's
  screens in reading order.
- What can be measured is measured, not narrated: contrast (`contrast.ts`),
  target size and position, accessible names and order from the real HTML.
  A model is used only for walkers whose stumble is about meaning (a
  first-timer, a second language), and their notes say so.
- Walkers are defined by a situation and a capability, never a
  stereotype; the definitions are on the canvas, editable.
- The rendered lanes are proposals-free views: a walk writes pins
  (comments) and one fix proposal, nothing else.

**Smallest version:** two walkers (low vision, one-handed) over one flow,
deterministic, reporting stumbles per screen and any shared finding.

**What exists:** `contrast.ts`, `/accessibility-audit`, the wireframe
prototype and its typed intents, `prototype-click.ts`, `isocan canvas
shot`, the accessibility persona.

**Open questions:** *Open — waits on Dion:* how walkers are grounded so
they are not caricatures; whether a walk can run in the desk check (§9).

## 12. Say it like a designer

**Trigger:** the person types a word the agent can read more than one way,
in a message to an agent.

**What the person sees:** only those words underlined; their readings shown
on the person's own screen where there is one (three headers for "pop":
contrast, scale, colour); the sentence a designer would say, taken with
Tab; Return keeps their words. A **vocabulary** panel: words you now use,
words you have seen and not used, and your own words the agent has learned
("the thumb button").

**Rules:**

- The word list and readings are `design-words.ts` (§2.4): deterministic,
  no model to underline.
- A picked reading travels with the message as data, and the agent guide
  says to honour it.
- Keeping your own words is always fine; nothing is graded; offers fade as
  the person's asks sharpen (the setting *when I am vague*).
- The person's coinages are learned into the taste note (§3), so the agent
  can use them back.

**Smallest version:** for a short list of vague words, offer two or three
named readings in the Chat composer before the ask is sent.

**What exists:** the Chat composer, `copy-voice.ts` (a glossary format the
person already writes), `intent-route.ts` (the composer already reads a
line before it is sent).

**Open questions:** *Open — waits on Dion:* whether pausing to pick a
reading feels like help or friction (the alternative: send with the best
guess and draw the other two as hunches); whether any count of asks that
needed no translation is shown, and only if the person opts in.

## 13. Both surfaces

| Surface | What |
| --- | --- |
| Ops | none new: `item.add` / `update` / `delete`, comments, existing design ops |
| Core | `proposal.ts`, `design-words.ts`, `stuckOn`, the settled-today and left-open derivations, the pulse derivation, the explain story |
| CLI | `propose`, `handoff`, `explain`, `ripple`, `crit`, `walk`; `design brief` as today |
| rc | trigger detection (settle, stuck) into `SummonsContext`; the handoff's ticked lines as an ordinary summons |
| Agent guide | a `proactive` topic: the grammar, the cap, the cites, what to do when stuck or summoned by a delete |
| Web | the proposal mark and its three keys, the taste note, the handoff note, the desktop away panel, the Explain panel, the brief card, the pulse strip, the critic pins, walker lanes, composer underlines |
| Tests | each derivation pure and fixture-tested; journeys with a stub agent; `surface.test.ts` names every new verb |

## 14. Not built here

- **Kickoff questions in place of a bare prompt**: exists. A design request
  asks 0–3 initial questions with pictures (`questionnaire.ts`,
  `visual-cards`), and `/grill-me` is the long interview.
- **Narrating the first generation**: exists in spirit. Presence narrates
  an agent's work (`session work --say`), and a wire flow draws its skeleton
  at once and fills in.
- **Core screens plus maybes**: exists for wire flows (`compose.ts`'s
  *maybe* below `NEEDS_YES`, a dashed mark, ⇧K keeps). What it lacked, a
  delete that teaches, is §3.
- **Three next moves**, **mode sensing**, **the rationale for others**,
  **"why not?"**, **naming a good move**, **your vocabulary**, **seeing a
  failure rather than a number**: folded into §2.6, §7, §6, §6, §8, §12 and
  §11.
- **One depth setting everywhere, with role lenses**: not now. Explain's
  switch (§6) is the first place depth is needed; a global setting waits
  until a second surface needs it.

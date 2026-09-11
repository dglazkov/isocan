# The design competition — the argument

**11 September 2026.** Design, written the day of the ask. Nothing built.
The status lives in [`journey.md`](journey.md)'s front matter; the
[research note](../../research/2026-09-11-design-competition.md) is what was
found on the way, the [journey](journey.md) is the acceptance suite,
[`packs.md`](packs.md) the fighter format and roster,
[`module-gaps.md`](module-gaps.md) what the module system has to grow, and
[`phases.md`](phases.md) the walk.

The ask, close to verbatim:

> An epic feature named "Design Competition". Maybe as a skill entry
> `/design-competition` — it would be great to have as a module to test the
> module system, and extend it to allow it to pull this off. You set up WHO
> the designers are — defaults like "Jony Ive and Apple", "frog design",
> "IDEO", and a few other famous software product designers — each a package
> with a name, a fun profile picture, a main DESIGN.md with their philosophy,
> and examples of their work that can be picked as input context. Starting a
> competition opens a "choose your fighter" popup; you start a session on
> what to design, and an agent for each designer builds a design in its own
> area of the canvas. It would be cool to have a voting system too.

## The sentence

> **A design competition is a sprint with one phase, cast by a picker: one
> brief, N lanes, one agent per lane carrying one designer's philosophy, a
> bell, and a vote the people win.**

Everything but the cast already exists, which is the finding this design
stands on. The sprint (2 Sep) built areas, a board laid as data, desks,
cross-canvas hand-in, a curtain drawn by the lens, placed dots, a tally that
counts people and agents apart, and the rule that a person decides. The
preference work (9 Sep) built `isocan prefer` and `standings()`. The design
system work built `DESIGN.md` as an item with a role, `design --css`, and an
audit that can cite the line. The rc (30 Aug) built enrolment as an op and a
summons that wakes an agent on a message. **The competition adds no
operation.** What it adds is a way to *choose who is in the room* — and every
piece of that is something the module system cannot yet say.

## Why it is a module, and what that tests

It could be built as a sprint phase in core, and it would ship sooner. It is
built as `@isocan/design-competition` instead, because the ask is explicit
that it should test the module system — and it is the right test, because it
is the first feature that needs a module to do five things none of the four
modules so far has needed:

| It needs to… | Today | Gap |
| --- | --- | --- |
| ship **content** — nine packs, each with an avatar and a `DESIGN.md` | `module-build.mjs` copies code and the guide; nothing else reaches `~/.isocan/modules/` | [assets](module-gaps.md#1-assets) |
| let **others add** fighters — a teammate's pack, another module's roster | a module contributes to *core's* registries and nothing contributes to a module's | [contribution points](module-gaps.md#2-contribution-points) |
| open a **popup** — the fighter select | overlays are edges, pages are cover routes; `Modal` is the shell's | [a dialog slot](module-gaps.md#3-a-dialog-slot) |
| give each lane **its own design system** | `designSystem(canvas)` returns one per canvas | [scoped design system](module-gaps.md#4-a-design-system-scoped-to-an-area) — core, not module |
| **cast agents** — enrol N, brief each, withdraw them | a person enrols one at a time; the summons carries no persona; `AddAgent` deliberately has no templates | [casting](module-gaps.md#5-casting-agents) |

Two smaller ones fall out on the way: `wait --in` (an agent parked on one
area — the sprint journey's Scene 4 asked for it and it was never built) and
the curtain lifted out of the sprint's phase table
([module-gaps.md §6](module-gaps.md#6-smaller-a-curtain-that-is-not-the-sprints-and-wait---in)).

And the removal test is the strongest yet. A competition leaves an arena of
areas, cards, `DESIGN.md` items, HTML entries and reactions; with the module
gone every one of them is still a file and every vote is still in the log.
If that holds for a module this large, the module sentence holds.

## The arena

`isocan competition new` lays a board the way `isocan sprint board` does —
one grouped write, one undo, `placement.chosen` — with a **Brief** area
across the top and one **lane** per fighter beneath it. A lane is an area
(`kind=area`) titled with the fighter's agent name; membership is geometry,
as it is for every area, so `isocan ls --in "Road Signs"` is the lane's
contents with no new code.

Each lane is furnished with three things, all ordinary items:

1. **The fighter card** — the one new kind. A small JSON file
   (`application/vnd.isocan.fighter+json`, extension `.fighter`) holding the
   pack id, name, agent name, tagline, colour and homage line, rendered by the
   module as the portrait card and read as JSON without it.
2. **The lane's design system** — the pack's `DESIGN.md`, added with the
   design-system role *and scoped to the lane*
   ([gap 4](module-gaps.md#4-a-design-system-scoped-to-an-area)).
3. **The reference shelf** — one card per chosen work: title, year, what to
   learn, a link out. Pictures only where the licence travels
   ([packs.md](packs.md#references-and-licences)).

The **competition itself** is the Brief item: markdown whose body is the
brief and whose properties say what the bout is —
`competition.fighters`, `competition.entry` (`screen` | `flow`),
`competition.mode` (`exhibition` | `blind`), `competition.decider` (an actor
id), `competition.target` (the item a winner would become a version of).
Where the bout *is* — building, voting, decided — is not stored: it is read
from the Chat, as the sprint reads its phase (`sprintState` reads the newest
`/sprint <phase>` line). One source of truth, and it is the one people can
read.

## The cast

### A fighter is an enrolled agent named for its principle

One agent per fighter, enrolled for the bout with `agent.enroll` — the op
that exists. Separate agents rather than one agent playing three parts,
because the spectacle *is* three cursors moving at once, and because a
fighter's identity has to be an actor for the tally to be able to say *Fast
Is a Feature ranked Road Signs' entry first* and for standings to accumulate
across bouts (the enrolment key is the name, so re-enrolling *Road Signs* next
week is the same actor — standing-agents phase 1).

**The principle leads; the person is a credit** (decided 11 Sep 2026). The
card's headline is the pack's `title` — *Less, but better* — with *after
Dieter Rams & Braun* beneath it, and the agent is named for the principle:
*Less but Better*, not *Dieter Rams* and not *Rams Bot*. AGENTS.md's house
rule is that presence is honest, and a cursor reading *Dieter Rams* claims
to be somebody it is not; a cursor reading *Rams Bot* is honest but still
wears a living person's name on every op it makes. Naming the idea is honest
twice over — it is also what actually fought. Three consequences, all in
[packs.md](packs.md#homage-not-impersonation): the validator refuses an
`agentName` carrying any name from the credit; a credit can be changed or
removed on request without the pack losing what it is; and because mentions
resolve by first word (`@Less` is *Less but Better*), fighters' first words
must be unique on the canvas.

### Whose compute, and the button that is not there

Fighters run on **the person's own rc**, under their harness and their model
account — the agent-custody rule, unchanged: no agent is spawned by
machinery nobody launched. The picker's **Fight** button follows `AddAgent`'s
precedent exactly: *no rc, no button*, and in its place a sentence saying
what to start and that the fighters will run on the person's compute. The
cost is stated before it is spent: *three agents, twenty minutes, on
claude-code — about N turns each*, from the rc's own `rcLimits`
(`turnsPerHour` defaults to 12; a bout that would exceed it says so).

The sheep harness is where this goes next — a fighter per cell, nothing on
the laptop — and nothing here depends on it.

### The first turn is a message, on the canvas

The rc's summons is fixed (`summonsPrompt`): it tells an agent its name and
hands it the `wait` payload of whatever woke it. It carries **no persona**,
and `AddAgent.tsx` records why that was deferred on 30 Aug: *"until the
personas machinery can say what a template defaults, rather than a picker
that decorates without deciding."* A fighter pack is exactly a template that
decides — a name, a colour, a working directory, a brief — so this is the
first customer that deferral was waiting for.

Two halves, both through things that exist:

- **Who it is** lives in its **working directory**. Enrolment already takes
  `--dir`; the competition makes one per fighter per bout
  (`~/.isocan/competitions/<bout>/<fighter>/`) holding an `AGENTS.md` — *you
  are Road Signs, an homage to Susan Kare's work, not her; here are the rules
  of the bout* — beside the pack's `DESIGN.md` and references. Every harness
  isocan runs already reads `AGENTS.md` (or `CLAUDE.md`) from its cwd.
- **What to do** is **a message addressed to it, in its lane**: the brief,
  the entry format, the clock, and `#` links to its design system and shelf.
  That message is what wakes it — the summons's payload *is* the brief — and
  it is on the canvas, where the room can read exactly what each fighter was
  told. A prompt only the machine can see would be a hidden store in all but
  name.

### Parked on its lane

A fighter should wake for its own lane and nothing else: coaching in its lane,
the bell in the Chat. `isocan wait --in <area>` is that filter, and it is
owed anyway. Critiques are posted **after** the bell, when fighters are no
longer parked on lanes, so a critique on a rival's entry cannot start an
agent-to-agent chain (the rc's `agentChain` bound, 3, would stop one — the
point is not to need it).

### Withdrawal

At the result, each fighter is withdrawn (`agent.withdraw`): the roster row
goes, the log keeps everything, the working directory is kept under the
bout's id until the person clears it. A fighter that should stay — *Road Signs
is on our team now* — is simply not withdrawn.

## Exhibition and blind

The ask wants each fighter to build "in its own area of the canvas". That is
the **exhibition** bout, and it is the default (decided 11 Sep 2026) because
fun is the point: you watch three cursors race in three lanes.

It is also not a blind test, and the design should say so rather than pretend.
In an exhibition, voters watched *Less but Better* build the grey one; the curtain
can hide the byline and it cannot hide the memory. Fighters can also read
each other's lanes — an agent with `isocan ls` sees the whole canvas — and
the bout's rules ask them not to, which is etiquette, not a wall.

The **blind** bout is the other shape, and the sprint already built it: each
fighter builds on a **desk** (`isocan sprint desk` — a canvas of its own,
link off, one pass, admitted to nobody else), and at the bell hands in to a
**Wall** area here, in a shuffled order, labelled *Entry A, B, C*. The door
enforces what the exhibition could only ask. It also solves the design-system
scope for free: a desk is a canvas, and a canvas already has exactly one
design system. Blind is what to run when the question is *which idea is
best*, because people vote for names.

## The vote

**A ballot is reactions.** Nothing about voting needs an operation, because
`item.react` already carries an actor, an emoji, on/off, and an optional
point:

| Mark | Means | Per voter |
| --- | --- | --- |
| 🥇 🥈 🥉 | a **ranking** — first, second, third | one of each; placing 🥇 on a second entry moves it (off + on, one group, one undo) |
| 🔴 with `at` | a **steal** — the part of an entry you would keep | as many as you like; feeds the remix |
| ⛔ | **misses the brief** | on any entry, including one you ranked |
| 🏆 | **the decision** | the Decider's, once |

A ranking rather than one ⭐, because with three or four entries a ranking is
barely more effort and says far more: it is a full set of pairwise
preferences per voter, which is what arena leaderboards collect one pair at a
time ([research](../../research/2026-09-11-design-competition.md#4-prior-art)).
**The eye test composes with it**: Design Arena turns four entries into a
full 1st–4th order with a five-vote bracket (two openers, a winners' match, a
losers' match, a tiebreak if needed), and flipping A-versus-B in the stage is
exactly that bracket — so the eye test is a way to *arrive at* a ranking, and
the ranking is what gets written.

**⛔ is the arena's "both bad", kept.** 18% of WebDev Arena's votes were *both
bad*, mostly broken builds; a ranking with no way to say *none of these
answers the brief* forces a winner out of three misses. An entry most voters
⛔ is flagged in the tally rather than crowned, and the Decider sees it.

**Rank by the brief, not the polish.** Chatbot Arena's style-control work
found voters reward length and gloss; a design contest will reward finish the
same way. So the ballot's question is *which best answers the brief?*, the
floor check (tells, off-system values) is shown beside each entry as its own
line, and a fighter's critique names which of its questions decided its
ranking. Polish is visible; it is not the question.

**The tally** is one function in core both surfaces call:
`competitionTally(canvas, bout)` → per entry, a Borda score **for people and
for fighters separately** — a person ranks all N entries and scores N…1
(3·🥇 + 2·🥈 + 1·🥉 for three); a fighter ranks the N−1 it did not make and
scores N−1…1 — plus dot counts and the Decider's mark. It reads the sprint's
`agentActorIds` to tell the two apart. People's and fighters' scores are never
summed — the sprint's rule, carried over: an agent's opinion is shown, beside,
and never mixed in.

Three rules, enforced by the verb and visible in the record:

- **A fighter never ranks its own entry.** `competition vote` refuses; a raw
  `isocan react` could still do it, the tally drops it and says so.
- **One ballot per voter.** The verb moves a medal rather than adding a second;
  a hand-placed duplicate counts once.
- **The Decider decides.** The 🏆 is counted only from `competition.decider`;
  anybody else's is shown as a vote for it, not the result. Whether others may
  *place* one at all is the roles ladder's question, which the sprint left open
  too.

**The curtain** is the sprint's, lifted out of its phase table: names and
counts hidden on the entries while a vote round's clock runs, the record
public, and the chip saying *not shown while voting*. Today `hidesVotes` only
knows sprint phases and `wallFor` only knows the Vote sheet
([gap 6](module-gaps.md#6-smaller-a-curtain-that-is-not-the-sprints-and-wait---in)).

## The result, and what it becomes

`isocan competition result` prints both tallies and the Decider's pick. Then
three buttons, three verbs:

- **Take it** — the winner's bytes become the target's next version
  (`item.addVersion`). **Not `choose`**: `convergePlan` folds a child into its
  parent and *trashes every sibling*, and the siblings here are the other
  entries, which are the record of why. A competition converges by copying,
  not by folding.
- **Remix** — a new bout, one fighter (the winner's, by default), the winning
  entry as its input and a generated brief listing every 🔴 dot and every
  critique idea from the other lanes. Diverge, then converge: the remix is the
  converge, and it is usually the round that produces the thing you ship.
- **Rematch** — same fighters, new brief, new arena beside the last.

## Standings, and what the ballots are worth

`isocan competition standings` reads every bout on the canvas — derived,
never stored — and prints each fighter's record: bouts, wins, average Borda,
and against whom, with a **Bradley–Terry** rating fitted over every pairwise
preference the ballots imply (the arenas' method) and **no rating shown below
a minimum number of bouts** — Design Arena hides a model under fifteen
comparisons, and a fighter that has won its only bout has not won anything
yet. Every entry and every retry stays on the canvas: "The Leaderboard
Illusion" found private reruns distort arena rankings, and a lane cannot
reroll quietly because nothing on a canvas is quiet. A month of Tuesdays says *Fast Is a Feature* wins dense screens and
*Road Signs* wins anything a customer sees first, and that is a sentence the
canvas's own design system can be told.

The evals plan already says the best signal here is the one people produce
for free: *a version stack is a preference pair*. A ranked ballot is N·(N−1)/2
of them, labelled by who, about entries built from the same brief under
different philosophies. That is the most controlled preference data isocan
will ever collect, and the competition should hand it to
`docs/projects/evals/` rather than invent a leaderboard of its own.

## What it may not add

The module rules, unchanged: **no operation** (the whole feature is `item.add`,
`item.update`, `item.react`, `thread.*`, `agent.enroll`/`withdraw`), **no
protocol message**, **no server route**, **no hidden store** (the bout is the
Brief item and the Chat), **no read of the desk**. The platform changes it
needs — assets, contribution points, a dialog slot, a scoped design system,
casting, `wait --in`, the curtain — are made in the platform, for every
module, and listed in [`module-gaps.md`](module-gaps.md).

## Decided against

- **Photographs, or any likeness.** Avatars are illustrated emblems drawn for
  the pack — a 1-bit happy face in a 32×32 grid for Kare, an orange dot on a
  grey field for Rams. A photo is somebody else's copyright and a real
  person's face on a bot. See [`packs.md`](packs.md#avatars).
- **Bundling pictures of the designers' work.** The repo is MIT and almost
  none of the work is. References ship as descriptions and links; a picture
  travels only with a licence that allows it, and the validator checks.
- **Packs as personas.** The persona format is a contract with measured goals
  (`personaWarnings` warns on a persona with none), and the design-auditor
  persona is right that taste *must never pretend it has a number*. A pack is
  a lens with no goal, so it is its own format; a persona *can* fight
  (Scene 6's *Agent Jun*) because an emissary is already an enrolled agent.
- **An agent Decider**, as the sprint refused. Fighters build, critique and
  rank; a person decides.
- **One agent playing every fighter**, sequentially. Cheaper and no spectacle,
  and it leaves the tally with one actor who ranked itself three times.
- **A competition mode or a Competition kind.** An arena is areas and items;
  a round is a line in the Chat. The one new kind is the fighter card, and
  only because a portrait needs a renderer.
- **A stored leaderboard.** Standings are derived from ballots, like the
  sprint's tally and `standings()`.
- **Hiding the brief in a prompt.** The first turn is a message on the canvas.

## On isocan.io

**It ships there** (decided 11 Sep 2026). What that means, given how the
hosted home works today:

- **A build-time module.** The hosted home loads no runtime modules, so the
  competition is in the two lists and the Dockerfile's manifest layer, and the
  nine default packs are in the image as its assets. That is also the removal
  test's real home: if isocan.io can drop it and every arena still reads as
  files, it holds.
- **Gate the download, not the drawing.** The stickers module's lesson (9
  Sep): a plain import gated at render still cost every first visit 6,227
  bytes. The picker, the avatars and the arena's web half are one lazy chunk
  fetched when somebody opens the picker or a canvas holds a fighter card;
  `test/bundle-budget.test.ts` holds everybody else's first visit where it is.
- **Fighters still run on the person's own rc**, parked against isocan.io —
  the hosted home spawns nothing, and the picker's Fight button reads the
  parked-rc fact exactly as `AddAgent` does there today. The sheep harness is
  how a person with no laptop open gets fighters anyway.
- **Bring-your-own on the hosted home waits** for the question every module
  there shares: who may add one. A **data-only** module (gap 2) is the first
  thing a hosted home could reasonably accept — it runs no code — so it is the
  natural first answer, and it is not this project's to give alone.
- **The proposed parts are ours to break.** Dialogs, templates, assets, points
  and rounds are on the proposed list; a build-time module is not refused for
  using them, and shipping on isocan.io does not freeze them. The module moves
  with the API until 1.0.

## Open

- **The fighter cursor's colour and mark** are the pack's; whether an homage
  agent should wear a distinct *mark* (as an emissary wears its person's name
  with a mark) is a question for the identity desk, not this module.
- **A pack from a canvas.** Scene 6 says a pack can live on a canvas as items.
  The directory form comes first; the canvas form is the inception project's
  shelf with a validator, and waits for it.
- **Cost.** Nobody has measured what a three-fighter, twenty-minute bout costs
  in turns or tokens. Phase 0 measures it before the picker offers five.

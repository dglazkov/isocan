---
status: designed
since: 2026-09-11
issue: 250
see: sprint, modules, personas, on-demand, standing-agents, evals
note: designed 11 Sep 2026 from the ask and the research note; nothing built. The competition is a sprint with one phase, cast by a picker — areas, desks, the curtain, placed dots, the split tally, hand-in and the rc's message-wake already exist. What does not is the module-system half, and it is the other half of the point — packs as module content, a dialog slot, assets on both surfaces, a scoped design system, and a way for a module to cast agents. Phase 0 (one fighter pack, by hand, no module) is next
---
# The design competition journey

This is the **ideal**: what it feels like to type `/design-competition` on a
canvas, pick three famous designers from a *choose your fighter* screen, give
them one brief, and watch three agents — each carrying one designer's
philosophy — build rival designs side by side, in their own lanes, before the
room votes. It is written as scenes and held as ground truth, the way
[`../sprint/journey.md`](../sprint/journey.md) is. [`design.md`](design.md) is
the argument, [`packs.md`](packs.md) the designer pack format and the default
roster, [`module-gaps.md`](module-gaps.md) what the module system has to grow
to carry it, and [`phases.md`](phases.md) the walk.

**The one idea: a competition is a sprint with one phase, cast by a picker.**
The sprint already has a board of areas, a brief, a clock, a bell, desks for
private work, hand-in across canvases, a wall with a curtain, dots, a split
human/agent tally, and a Decider. What it does not have is a *cast*: who is
sketching is whoever turned up. A competition is the same room with the cast
chosen on purpose — rival philosophies rather than rival people — which is the
Tiny Stitch founding move ("run rival teams on the same task") at its most
legible.

**And the second idea: it is the module system's test.** It is built as
`@isocan/design-competition`, a module, because it is the first feature that
needs a module to ship *content* (nine designer packs with pictures), to open a
*popup*, to scope a design system to part of a canvas, and to *cast agents*.
Each of those is a thing the module API cannot do today; each is written up in
[`module-gaps.md`](module-gaps.md) as a change to the platform that any module
can then use. If the competition can be built as a module, the module system
is real.

Four rules carried over unchanged from the sprint, because they are what make
it isocan rather than a template: **no competition mode** (the arena is areas
and items; a round is a line in the Chat), **both surfaces** (every button in
these scenes is a verb in the terminal), **the record is never hidden** (the
curtain is etiquette, never a secret), and **people decide** — agents build and
critique, and their votes are counted apart; the winner is a person's call.

And one rule that is new, because the fighters are named after real people:
**a fighter is an homage, and says so.** The card, the cursor and the agent's
name never pass as the designer. See [`packs.md`](packs.md#homage-not-impersonation).

## Cast

All synthetic.

- **Priya** — product lead on *Acme Plants*, a small plant shop's canvas. Starts
  the competition. The **Decider**.
- **Jun** — designer. Has a house style he has been meaning to write down.
- **Ola** — engineer. Votes, argues, and does not care who anybody is.
- **The fighters** — agents, each enrolled for the bout under a pack's agent
  name (*Kare Bot*, *Rams Bot*, *Linear Bot*), each carrying that pack's
  `DESIGN.md` and references. They build and they critique. They never decide.
- **Kit** — the facilitator from the sprint, optional. The competition runs
  without one; with one, Kit holds the clock and calls the rounds.

## Scene 0 — `/design-competition`, and the fighters line up

Tuesday, 10:14. Priya has a checkout screen nobody loves. She types in the
Chat:

> `/design-competition a checkout for a plant shop that doesn't feel like a form`

Instead of a question in the Chat, a **picker** opens over the canvas: the
*choose your fighter* screen. Nine portraits on a grid — each an illustrated
avatar, never a photograph — with a name, a tagline, and a small **homage**
mark. Hovering one turns its card over: three lines of philosophy, the
signature moves, the works it will study.

| | | |
| --- | --- | --- |
| **Jony Ive & Apple** — *make it inevitable* | **frog design** — *form follows emotion* | **IDEO** — *build to think* |
| **Susan Kare** — *friendly at 32×32* | **Dieter Rams** — *less, but better* | **Bret Victor** — *see the thing change* |
| **Matías Duarte** — *paper, ink, and meaning* | **Linear** — *fast is a feature* | **Edward Tufte** — *above all, the data* |

Three more tiles close the row: **🎲 Random**, **＋ Bring your own** (Scene
6) and **Your emissaries**, which lists any persona agent enrolled on this
canvas — *Agent Jun* can fight too.

Priya picks three: **Kare**, **Rams**, **Linear**. Each pick lights its card
and plays its slot in a *P1 · P2 · P3* bar along the bottom. Below the grid,
four settings, each with a default she does not have to touch:

- **The brief** — prefilled from her message; `#Checkout` attached, because it
  was selected.
- **The entry** — *one screen* (or *a flow of three*).
- **The clock** — *20 minutes*.
- **The vote** — *exhibition* (live, named) or *blind* (Scene 4).

She presses **Fight**.

**Acceptance:** `/design-competition` opens the picker from the Chat, and ⌘K →
*Start a design competition* opens the same one. The picker is a module's
dialog, not a shell screen. The same act from a terminal:

```sh
isocan competition new "a checkout for a plant shop that doesn't feel like a form" \
  --fighters kare,rams,linear --entry screen --time 20m --attach Checkout
```

`isocan competition fighters` prints the roster the picker shows — id, name,
tagline, and where the pack came from.

## Scene 1 — the arena

The picker closes and the canvas pans to a new board beside the old work:
the **arena**. A **Brief** card across the top with Priya's sentence, the
attached screen copied in as a reference, and the clock. Beneath it, three
**lanes** — areas, the sprint's primitive — side by side, each headed by its
fighter's card: avatar, name, tagline, homage mark.

Each lane arrives furnished:

- the pack's **`DESIGN.md`** as the lane's **design system** — an item with the
  design-system role, *scoped to the lane*, so `isocan design --css --in
  "Kare Bot"` prints Kare's tokens and not the canvas's;
- a **reference shelf** — the pack's chosen works as cards: a title, a year,
  one line on what to learn from it, and a link out. Pictures only where the
  licence allows (see [`packs.md`](packs.md#references-and-licences));
- an empty **Entry** slot where the finished design goes.

**Acceptance:** the arena is items and areas — one Brief area, one lane per
fighter, laid by the same board code the sprint uses. Nothing in it is a new
kind except the fighter card, which is a small file with a mime and reads as
JSON without the module. `isocan area ls` lists the lanes.

## Scene 2 — the fighters walk in

Three cursors arrive, one per lane, each wearing its pack's colour and agent
name: *Kare Bot*, *Rams Bot*, *Linear Bot*. They were enrolled for the bout by
the Fight button, on Priya's own rc — the picker would not offer **Fight**
without one parked, and said so ("Start `isocan rc` on your machine to run
fighters — they run on your compute, under your harness").

Each fighter's first turn is its brief: the competition brief, its lane, its
`DESIGN.md`, its references, and the rules of the bout — *build only in your
lane; do not read the other lanes; one entry; hand in before the bell.* The
lane's card flips from *waiting* to *building*. The Chat shows one line per
fighter as each starts.

Nobody has to watch, and everybody does. Kare Bot's lane fills with a warm
cream screen, a 1-bit pot-plant icon at 32×32 and a button that says *Send it
home*. Rams Bot's is grey and white, one orange accent, nothing that is not a
control. Linear Bot's is dark, dense, and the whole flow works from the
keyboard.

Jun reacts 🔥 on Kare Bot's icon. That is cheering, and it is a reaction like
any other — the fighter is not told to change anything by it. **Coaching** is
something else: a thread in a lane addressed to its fighter
(`@Kare Bot the price is too quiet`) is a message the fighter answers, and in
an exhibition bout that is allowed and visible. In a blind bout it is refused,
and the refusal says why.

**Acceptance:** the Fight button enrols one agent per fighter through the op
that already exists (`agent.enroll`), on a machine with a parked rc, each
with a working directory made from its pack (an `AGENTS.md` that says who it
is an homage to and what the bout's rules are, beside the pack's `DESIGN.md`).
Each is woken by the thing that already wakes an agent — **a message
addressed to it**, posted in its own lane, carrying the brief — so the first
turn is on the canvas where everyone can read it, not in a prompt nobody can
see. Each parks on its own lane (`isocan wait --in "Kare Bot"`, which the
sprint journey asked for and nobody built). The lanes show what each message
made. From a terminal: `isocan competition start <competition>` does the
same, and `isocan competition status` prints each lane — fighter, state,
items, time left.

## Scene 3 — the bell

At twenty minutes the clock chip rings. Each fighter hands in: its entry is
stamped as the lane's entry (`competition=entry`), and anything else in the
lane is left as working. Rams Bot handed in at fourteen minutes and parked; a
fighter who finishes early is allowed to stop.

Then the **floor check**: the existing design audit runs across the three
entries — the slop floor and each entry against its *own* lane's design system
— and writes one line under each: *Kare Bot · 0 tells · 2 off-system values*.
It is shown as a floor, not a score. The competition is not decided by a
linter.

**Acceptance:** hand-in is the sprint's hand-in with a different property
value; `isocan competition handin` is the fighter's verb and `isocan design
check --in <lane>` is the floor. A fighter that misses the bell has no entry,
and its lane says *no entry* rather than promoting whatever was there.

## Scene 4 — the vote

**Exhibition** (what Priya chose). The three entries are presented in turn —
one `present` per entry, the room following — each with its fighter's card
beside it. Then **the vote**: every person gets one ballot, a **ranking** — 🥇
🥈 🥉 placed on the entries, answering *which best answers the brief?* — as
many 🔴 **dots** as they like, placed on the *part* of an entry they would
steal, and a ⛔ on any entry that misses the brief altogether. Counts and names are hidden until
the bell (the sprint's curtain, by lens). The chip says so.

Then **the fighters critique each other**, in voice. Each fighter posts one
thread on each rival's entry, written from its pack's critique questions —
Rams Bot on Linear Bot's entry: *"Which of these fourteen shortcuts would a
first-time buyer miss if it were gone?"* — and ranks the entries it did not
make. A fighter never ranks its own entry. The verb refuses; the record would
show it anyway.

**Blind** is the alternative, and it is a different bout rather than a
setting: the fighters build on **desks** — a private canvas each, admitted to
nobody else, the sprint's desks — and hand in at the bell to a **Wall** area
here, in a shuffled order, labelled *Entry A, B, C*. No lanes to watch, no
coaching, no names on the wall until the tally. It is what to run when the
question is *which idea is best* rather than *which designer is fun to watch*,
because people vote for names.

**Acceptance:** a ballot is reactions — medals and dots — so a vote is an op
that already exists (`item.react`, with `at` for a dot), one per voter per
medal, attributable in the log; moving your 🥇 is one gesture and one undo.
The curtain hides names and counts on the entries and nowhere else — which
means lifting the sprint's curtain out of its phase table, since today
`hidesVotes` only knows sprint phases and the Vote sheet. A blind bout's fighters are on desks the door
admits only them to. From a terminal: `isocan competition vote <entry>
--rank 1` and `isocan competition dot <entry> --at 0.4,0.7`.

## Scene 5 — the result, and what happens to it

At the bell the curtain lifts. The tally shows people's rankings and the
fighters' apart, as the sprint's tally does — *People: Kare 7 · Linear 6 ·
Rams 5 (Borda, three ballots). Fighters: Linear 4 · Kare 3 · Rams 2 (each
ranking the two entries it did not make).* — and the heat map of
dots draws on the entries. Ola, who ranked Linear first, reads Rams Bot's
critique and the cluster of dots on Kare Bot's price and says the checkout
should be Linear's flow with Kare's voice.

**Priya decides.** The Decider's 🏆 goes on **Kare Bot**'s entry — the winner
card fills the arena header with the avatar, and the Chat says *Kare Bot wins
— Priya's call* (the confetti is one frame, and skippable). Then the three
things a result can become, each one button and one verb:

- **Take it** — the winner's bytes become `#Checkout`'s next version; the
  canvas's real screen moves, and the arena stays as the record of why. (Not
  `choose`: that folds a child into its parent *and trashes the siblings*,
  and the siblings here are the other entries — the record.)
- **Remix** — a second round, one fighter, with the winner as its input and
  every dot and critique idea from the other lanes as its brief. This is the
  converge half of *diverge, then converge*, and it is the round that usually
  produces the thing you ship.
- **Rematch** — the same fighters, a new brief, a new arena.

**Acceptance:** the tally is computed from the record (reactions by actor) by
one function both surfaces call; the Decider's pick is a reaction with a rank
above the others; *Take it* is one `item.addVersion` on the target;
*Remix* is a new bout
with one fighter and a generated brief item. `isocan competition result`
prints the tally both ways and the Decider's pick.

## Scene 6 — bring your own fighter

A week later Jun writes his house style down at last — a `DESIGN.md` of his
own, and three of his screens as references — and turns it into a **pack**:

```sh
isocan competition fighter new "Jun's house style" --design DESIGN.md \
  --ref "Pricing (2025)" --ref "Onboarding (2026)" --avatar jun.svg
```

The pack is a directory (a manifest, a `DESIGN.md`, an avatar, references),
so it can live in the repo, in a git spec a teammate can add
(`isocan competition fighter add github:acme/jun-style`), or on a canvas as
items. The next time anybody on the team opens the picker, *Jun's house
style* is a tenth portrait. The same week *Agent Jun* — Jun's emissary
persona — takes a slot in a bout against *Rams Bot*, and loses, and Jun reads
Rams Bot's critique of his own emissary with real interest.

**Acceptance:** a pack is a file format with a validator, loadable from the
module's own defaults, a directory, a git spec, or a canvas; the picker lists
every source with where it came from; a pack with no licence line on a
reference with a picture is refused, and says which reference.

## Scene 7 — standings, and the module taken away

After a month of Tuesdays, `isocan competition standings` reads every bout on
the canvas and prints which fighters win, against whom, on what kind of brief
— and the evals project reads the same ballots as **preference pairs**, which
is what a ranking is. *Linear Bot wins dense screens; Kare Bot wins anything a
customer sees first.* That is a fact the design system can be told.

Then the home's operator removes the module. The arenas are still there:
areas with titles, `DESIGN.md` items, reference cards that read as JSON,
entries that are HTML, ballots that are reactions. `isocan ls` files the
fighter cards under `other`. The oplog is untouched. Nothing a competition
made needed the competition to be readable.

**Acceptance:** standings are derived, never stored; removing the module
leaves every arena readable as files and every vote in the log — the module
system's own removal test, played by the largest module yet.

## What the scenes force

The load-bearing minimum — read this before building anything above.

1. **A pack format** — manifest, `DESIGN.md`, avatar, references, critique
   questions, homage line — with a validator both surfaces call.
   [`packs.md`](packs.md).
2. **Module assets**: a module ships files (SVGs, markdown) that both surfaces
   can read, at build time and at runtime alike. Today a runtime build copies
   only code and the guide. [`module-gaps.md`](module-gaps.md#1-assets).
3. **Module content registries**: packs come from more than one place, and
   *other modules* should be able to contribute fighters — a module declaring
   an extension point of its own. [`module-gaps.md`](module-gaps.md#2-contribution-points).
4. **A dialog slot**: a popup a module owns, opened by a command or a palette
   action. Overlays are edges and pages are cover routes; neither is a
   picker. [`module-gaps.md`](module-gaps.md#3-a-dialog-slot).
5. **A design system scoped to an area** — one canvas, three philosophies.
   A core change, not a module one. [`module-gaps.md`](module-gaps.md#4-a-design-system-scoped-to-an-area).
6. **Casting agents from a module**: enrol N, summon each with a composed
   first turn, withdraw at the end — through ops that exist and a host that
   says what compute it is spending. [`module-gaps.md`](module-gaps.md#5-casting-agents).
7. **Ballots as reactions**: a ranking as medals, a steal as a placed dot, a
   tally that is one derived function. Zero new ops. [`design.md`](design.md#the-vote).

## What a scene must never require

- Knowing a designer's name to have a good time — the cards say what each
  one believes.
- A photograph of anybody, or an agent passing as a person.
- Opening a terminal to start, watch, vote, or decide. Every one has a
  button; every button has a verb.
- A competition mode, a Competition kind, or an arena that is anything but
  areas and items.
- Trusting a fighter's vote as much as a person's, or letting one decide.
- Faking blindness. *Not shown while voting* is the promise, said on the chip;
  a blind bout is blind because the fighters were on desks, not because a
  lens was polite.

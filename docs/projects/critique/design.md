# Critique — the mechanism

**14 October 2026.** The first experiment from [`proactive`](../proactive/)
built in full. The scenes are [`journey.md`](journey.md); the walk is
[`phases.md`](phases.md). Checked against the code at `7bb1f4e9` before
writing; what exists is named with where it is.

**The debt it discharges.** Three projects each built half of this and
stopped:

- **personas** defined a role an agent takes on, in one file the machine and
  the model both read, and left *step 6, the canvas as source of truth*
  unbuilt "until a second person edits a persona";
- **design-competition** wrote nine critics' lenses (`critique.md`: three
  questions, what it looks for first, how it ranks) and uses them only to
  rank rivals' entries after a bout;
- **proactive** drew critics as guests who pin notes and never edit, and
  left open how "never edit" could be enforced.

## The sentence

> **A critic points and explains; it never touches. One voice tells you
> where they agree, where they split, and what blocks.**

## 1. A critic is a persona on the canvas

A critic is **a markdown item on the canvas, in the persona format**:

```markdown
---
name: inevitable
critic: true
agentName: Inevitable
credit: after Jony Ive's work; not affiliated
color: graphite
budget:
  usd per run: 0.40
  turns per run: 6
---

# Inevitable

1. Can you say what this screen is for in one sentence?
2. What could go until what is left feels inevitable?
3. Does the interface defer to the content, or does it perform?

## What it looks for first
…
```

- **One reader.** `parsePersona` (`packages/core/src/persona.ts`) is pure and
  keeps unknown keys, so a critic item parses unchanged. `critic: true`,
  `agentName`, `credit` and `color` are the keys a critic adds. A critic's
  `budget` is the persona's existing `PersonaBudget`, so "what one critique
  may cost" uses a number the persona machinery already enforces.
- **Seeded from the packs.** Adding *Inevitable* to a canvas writes its pack's
  `critique.md` into a new critic item with that front matter. From then on
  the item is the critic: a person's edits change the next critique.
- **Written by hand.** `isocan critic new "The Counter Clerk"` writes a
  skeleton with three empty questions, and the web does the same.
- **Names.** design-competition's `packProblems` already refuses a name that
  shares a word with the person it is after, and requires a credit line that
  says "not affiliated". The same check runs on every critic item, and two
  critics may not start with the same word, because mentions resolve by the
  first word (`rosterClashes`).
- **The roster.** The packs are reached through design-competition's
  contribution point. This module declares a point of its own,
  `critique.critics`, and the packs are contributed to both, so critique
  works whether or not competitions are installed.

This is personas' step 6 for the one kind of persona a second person
obviously edits. The repository's own reviewers stay in `.agents/personas/`.

## 2. Asking: three doors, one act

| Door | What the person does |
| --- | --- |
| Chat | `@Inevitable what do you make of #Checkout?` |
| Command | `/critique #Checkout with Inevitable and Form Follows Emotion` |
| Screen | right-click → **Critique with…** → pick critics |
| CLI | `isocan critique <item> --by inevitable,form-follows-emotion` |

Each becomes the same thing: **a thread on the screen that mentions each
critic**. The thread is the request, the record, and where the synthesis
lands.

**Summoning reuses the competition's path.** `competition start` enrols one
agent per lane with `host.enrol(…, { template: "design-competition.fighter" })`;
the template writes the agent's working directory. Critique adds one
template, `critique.critic`, which writes `AGENTS.md` from the critic item:
its questions, what it looks for, the note format, and the rule that it
writes notes and nothing else. The critic is then an enrolled agent on the
person's own runner (`isocan rc`), and the mention in the thread wakes it
through the ordinary rule (`dispatchReason`, `packages/core/src/inbox.ts`).
Enrolment happens once per critic per canvas; after that, a mention is
enough. From the web, `WebHost.enrol` reaches the parked runner the same way
*Add agent* does.

**No runner, no critique.** If nobody's runner is parked, the dialog says so
in one sentence and nothing is enrolled, the way the competition's *Fight*
button does.

## 3. A note: pinned, typed, one move

A critic writes notes with one verb:

```sh
isocan critique note <item> --at 0.62,0.81 --kind risk --question 2 \
  "Two filled buttons compete for the one action. Keep Pay; make Save a text link."
```

- **Pinned.** It is a thread on the item at a point. `CommentThread` already
  carries an anchor item and an offset from its corner (`model.ts`); the CLI
  could not place one, because `--item` always means "beside it". `--at`
  takes fractions of the item's size, so a pin stays put when the screen is
  resized, and is converted to the offset the model stores.
- **Typed.** The note's first line is written by the verb, not by the model:
  `**Risk** · question 2`. A pure parser in core reads it back. `kind` is
  one of **working**, **risk**, **blocker**. A critic's prose cannot fake a
  blocker, because only the verb writes that line.
- **One move.** Each note ends in one concrete change, or for *working*,
  "leave it". The shape follows `/design-audit`'s findings (where, problem,
  fix), which already reads well.
- **Coloured.** Each critic's pins wear its `color`, and nothing else does.

## 4. The ceiling: a critic cannot edit

Every write needs the **edit** capability (`packages/server/src/http.ts`),
and an agent rides its machine's badge, so an enrolled agent can do whatever
its owner can. The roles project considered a *commenter* rung and rejected
it, because "comments reach agents and can start work". That decision is
about people, and it stands.

What critique adds is narrower: **a ceiling on one agent's claim on one
canvas.** When a critic is enrolled, its claim records `ceiling: note`. The
door checks the acting actor's ceiling after the badge's capability, so it
can only narrow and never widen anything. Under `note`, the only operations
allowed are:

- creating a thread anchored to an item;
- replying in a thread the critic is part of;
- reacting with a point.

Everything else from that actor is refused with `beyond-ceiling`, named and
logged. The critic's template tells it so, so a refusal is rare. But the
template is not what holds the line.

Whether the ceiling belongs on the enrolment record, the claim, or the
session is what phase 2 finds out. The rule it must satisfy is the house
one: the CLI and the web cannot disagree about it, because the home decides.

## 5. Independence, and the read

**Critics are independent.** Each is summoned in the same thread but told,
by its template, to read the screen and not the thread. That is a prompt,
not a permission: reading cannot be refused the way writing can, because a
critic needs to read the screen. So independence is also arranged by order.
The critics run, and the lead's synthesis is written only when every
critic has posted its last note (`critique done`).

**The read is a fold, then a voice.** A pure function in core,
`critiqueRead(notes)`, groups the parsed notes:

- **agree**: two or more critics with notes of the same kind whose pins fall
  within one region of the screen;
- **split**: notes from different critics in one region where one says
  *working* or *leave it* and another *risk*, or whose moves contradict
  (cut against enlarge);
- **blocker**: any note of kind blocker, by anyone.

The fold proposes the groups; the **lead agent** — the agent the person
asked, or the canvas's parked agent for a command — writes the one reply.
It names each tension in design words and offers **Build both** on a split.
The fold is deterministic and tested; the words are the agent's.

**Build both** makes two variations of the screen (`parent=`), each citing
the critic it answers. When proactive phase 0 lands, they become proposals.

## 6. Cost

A critique spends the person's model key on their runner. Each critic's
`budget` bounds one critique: turns and dollars, read from the runner's own
accounting, stopped at the cap with a note saying so. The default for the
shipped roster is six turns and $0.40.

## What exists, and what is new

| Piece | Exists | New |
| --- | --- | --- |
| Critic definition | persona format and `parsePersona`; packs' `critique.md` and `packProblems` | `critic: true` items on a canvas; `critic add|new|ls`; the `critique.critics` point |
| Summoning | `host.enrol`, templates, rc wake on mention | the `critique.critic` template; `/critique`; *Critique with…* |
| Notes | threads anchored to an item at an offset; `item.react` with a point | `critique note` with fractional `--at`, a typed first line, critic colour |
| Never edits | nothing: agents hold the badge's capability | a `note` ceiling on a critic's claim, checked at the door |
| The read | tallies that count reactions (`competitionTally`, sprint, docket) | `critiqueRead` over parsed notes; the lead's single reply; *Build both* |

**Done on both surfaces.** There are no new item ops: notes are threads and
reactions, and critics are items. The one new thing at the door is the
ceiling refusal. Every door above has a CLI verb, and the agent guide gains
a *critique* topic. README and WHATSNEW get a line each when a person can
use it. Everything is behind a `critique` experiment.

## Open

- **Where the ceiling lives**: the enrolment record, the agent's claim, or the
  session. Phase 2 decides by building the smallest one that the home can
  check.
- **Seeing the screen.** A critic should look at a picture as well as read
  the HTML. Whether `canvas shot` can render one item reliably is checked in
  phase 1, after the bug fix that made its errors legible.
- **How loud and when** — the concept's two settings for critics that speak
  unasked. They arrive with the first trigger that could use them, which is
  proactive's; critique is asked-for only.

---
status: built
since: 2026-08-30
see: on-demand, launch
note: every phase closed 30 Aug 2026 — `isocan rc` parks against the home, vends agent sessions over ACP, and a summoned agent replies in a thread with presence; journey 10 (a week on one canvas) is lived rather than built. Residue is personas and the web tray's answerable relay (the latter built 31 Aug by agent-custody). AUTHORITATIVE for the wake since 30 Aug.
---
# Agents on demand — the journeys

**30 August 2026.** The ideal, written as user journeys.
[design.md](design.md) argues the mechanism; [phases.md](phases.md) orders
the work and parks its decisions. Each journey here is an acceptance test:
a phase that claims one closes only when you can walk it, for real, on a
real canvas. Journeys describe what you experience, not how it works —
where a journey seems to force a mechanism, the mechanism is what bends.

**You** are a developer with a project directory, a canvas, and your own
harness credentials. **Sian** and **Percy** are agents you work with. Sian
is the design's one-line thesis made personal: Sian is a record, not a
process. A Sian session exists when there is something for Sian to do.

**`isocan rc`** is the one process you do run: a long-running command,
started by you, that answers for your enrolled agents and starts their
sessions when something arrives. You always know it is running because
you started it, and you can always read what it is doing. Its twin is
`isocan agent` — the same machinery spoken by an agent — so the CLI's
user/agent divide is drawn in the words themselves: you type `rc`, an
agent types `agent`. Flags and spellings below are working syntax; the
walk owns the final forms.

## Journey 1 — Start `isocan rc`

*One word in the right directory — literally the `claude rc` shape.*

1. In your project directory: `isocan rc`. No arguments, and nothing
   spawns — no agent runs until something arrives for one. Leave it
   running: this terminal, a tmux pane, or launchd. Another project gets
   its own `isocan rc`, the way it gets its own `claude rc`.
2. Add your first agent from the web app: *Add an agent* — name it Sian,
   and pick a persona as its template. The dialog decides who; your
   running `rc` supplies where and how. (No `rc` running? The dialog
   hands you the line instead.) In the agent tray — or with
   `isocan who` — Sian now reads answerable, not running.
3. Once you have an agent, a comment is a door too, like anything else
   you ask an agent: `@Sian add a new reviewer agent here`. Sian sets
   the reviewer up, and the reviewer is answerable — on this canvas, and
   nowhere else.

**Acceptance:** Starting costs one word and zero flags, and starts no
agent. Adding an agent is one gesture from the canvas — a persona is a
template the gesture offers, never an agent that already exists.
Enrolment is a record: it works with nothing running, and a running `rc`
picks it up without a restart. Nothing on the canvas ever shows a cursor
for a session that does not exist.

## Journey 2 — Summon by comment

*The doorbell works, and you can watch it work.*

1. Comment on an item: `@Sian this spacing looks wrong on mobile`.
2. The `rc` narrates: *summons for Sian → starting session in
   ~/work/app → turn running*. On the canvas, Sian's presence appears —
   reading your comment, then working.
3. Sian replies in your thread, does the work through the CLI, and the
   turn ends. The `rc` narrates that too: *turn ended*. The presence
   fades because the session ended, not because a timer expired.
4. Run `isocan who`. Sian is back to answerable, not running.

**Acceptance:** The reply addresses the comment you made, not whatever
Sian's previous session was doing — a summoned agent re-orients before it
answers. The only process you ever started by hand is `isocan rc`. Every
summons is one readable line in its output.

## Journey 3 — Nothing is lost while nobody is listening

*Gaps stop costing information, whoever caused them.*

1. Sian is enrolled. Nobody comments for two days. The `rc` idles; no
   model turns are spent; nothing polls on Sian's behalf beyond the
   `rc`'s one quiet connection.
2. Your machine is off overnight — the `rc` with it. A collaborator
   leaves three comments for Sian.
3. In the morning the `rc` starts (launchd, or you). It picks up where
   its cursor left off: Sian wakes once, sees all three comments in
   order, and answers each in its thread.
4. Separately: an agent parked the plain way (`isocan wait`, no `rc`)
   is killed mid-park. When it parks again, everything from the gap is
   delivered. You never type `--since`.

**Acceptance:** A quiet week costs zero model turns. No comment is ever
silently skipped because nothing was running when it landed. The same
comment is never delivered twice as new.

## Journey 4 — Route only what matters

*Waking is cheap, so the rules become routing, not budget.*

1. Sian has rules: only the items Sian owns, only version and comment
   changes. They were set in the same gesture that added Sian —
   defaulted by the persona template, adjustable there, never a second
   thing to remember.
2. A collaborator rearranges fifty unrelated items. The `rc` stays
   quiet. No turn is spent concluding "not mine."
3. The collaborator comments `@Sian` on one of those unrelated items.
   Sian wakes anyway — a person reaching for an agent is never filtered
   out.

**Acceptance:** Bulk noise starts zero turns. A direct mention always
starts one, through any rule set. The rules are readable in one place —
ask the `rc` what it answers for and why.

## Journey 5 — Failure is loud where you are looking

*An agent that can't start never looks like an agent with nothing to say.*

1. Break Sian's setup — rename the project directory, revoke a
   credential, anything that makes the next session impossible to start.
2. Comment `@Sian can you take a look?`.
3. The thread answers you: Sian couldn't answer — failed to start, or
   died before replying — and here is why, in the same thread where you
   asked. The `rc`'s output carries the full detail; the thread carries
   the fact.
4. Fix the problem. Comment again. Sian answers normally.

**Acceptance:** Every summons that fails to produce a reply produces a
visible refusal in the thread that summoned it — whether the session
never started or broke mid-turn. Silence always means "nothing addressed
to this agent," never "the machinery broke."

## Journey 6 — Runaway agents stay bounded

*Two agents can talk to each other; they cannot talk forever.*

1. Sian and Percy are both enrolled. You ask Sian to review Percy's
   work; Sian's reply mentions Percy; Percy's reply mentions Sian.
2. The exchange runs a few useful turns, then the guard stops it and
   says so — in the thread, and in the `rc`'s narration: which agent was
   stopped, and why.
3. Independently: an agent has a ceiling on turns per hour. When the
   ceiling stops a turn, the stop is recorded and readable. Nothing is
   dropped on the floor; you can see what didn't run.

**Acceptance:** No pair of agents can wake each other indefinitely. Every
turn the limiter prevents leaves a trace you can find. A person's mention
is never rate-limited into silence without the refusal being visible.

## Journey 7 — See who answers here

*The roster tells you the truth about absent agents — and a dead `rc`.*

1. Run `isocan who` on a canvas with three agents: one mid-turn, one
   enrolled and idle, one whose plain terminal park died an hour ago.
2. The three read differently. The working agent is present and working.
   The enrolled agent is answerable — no process, and none claimed. The
   dead park is gone, because presence never lies about a connection
   that no longer exists.
3. Now quit the `rc` and run `isocan who` again. The enrolled agent no
   longer reads as answerable: it is enrolled, but nobody is listening,
   and the roster says exactly that.

**Acceptance:** You can tell "will answer if I comment" from "is
answering right now" from "is gone" without knowing how any of it works —
and "answerable" is never claimed while the `rc` that would answer is
dead.

## Journey 8 — Dismiss an agent

*Standing is granted, so standing can be withdrawn.*

1. Sian's work on this canvas is finished. Dismiss from the canvas,
   where the work is — the same doors that added an agent take one away:
   - In the web app: Sian's row in the agent tray, *Dismiss*.
   - By a comment, the way you would dismiss anyone:
     `@Sian thanks — you're done here`. Sian says goodbye in the thread
     and stops answering.
2. Run `isocan who`. Sian no longer answers here.
3. A collaborator comments `@Sian one more thing?`. Nothing starts. The
   comment sits in the thread the way any unanswered comment does,
   waiting for whoever reads it next.

**Acceptance:** Dismissal happens on the canvas, without hunting for
where the agent was set up or opening a terminal beside the one already
running. After it, no comment starts a turn as Sian. The history of
Sian's work is untouched — dismissal removes the standing, not the
record. (Stopping *everything* is the `rc`'s own gesture: Ctrl-C, journey
7.)

## Journey 9 — Watch one happen

*When you don't trust it yet, you can hold it in your hand.*

1. Run `isocan rc` in the foreground and keep the terminal visible.
   Every summons, session start, turn end, and refusal is a line you can
   read as it happens.
2. To see exactly what a summoned turn receives, park as *yourself* in a
   second terminal — `isocan wait --json` — and have someone mention
   you. Your wake arrives as JSON: the same shape and content a summons
   hands an agent, because the contract is that delivery differs and
   content never does. (You are a different actor than Sian; the payload
   contract is what makes your wake a faithful stand-in.)
3. Use the two side by side to debug a routing rule, a prompt, or a turn
   that behaves differently summoned than parked.

**Acceptance:** The `rc`'s narration accounts for every turn it starts.
`isocan wait` still works exactly as documented, with nothing new to
configure — the lap never changed.

## Journey 10 — A week on one canvas

*The scope, end to end: this is what the project is for.*

1. `isocan rc` was started once, a week ago. Since then a roster
   accumulated the way rosters do: you added Sian from the tray when the
   layout work needed an owner, Percy when the tests did; Sian added a
   reviewer when you asked; a scribe was dismissed when its thread wound
   down. Every change was a gesture on the canvas. Nothing else was ever
   started, and no terminal tab was ever opened for an agent.
2. Comment `@Sian` about layout; Sian answers. Comment `@Percy` about
   tests; Percy answers. The reviewer never wakes for either.
3. A nightly job leaves a comment for the reviewer. Exactly one agent
   wakes, does the work, replies, and stops.
4. At any moment, the tray — or `isocan who` — shows the roster as it
   stands: who is answerable, who is mid-turn; the dismissed scribe is
   simply absent, per journey 8. The `rc`'s output is the ledger of
   everything that ran all week.

**Acceptance:** A roster of any size costs one idle process and nothing
else while quiet — what used to be a terminal tab per agent is no tabs
at all. The roster grew and shrank by gestures on the canvas, never by
editing configuration. Each summons wakes exactly the agents it
addresses, and everything that ran is readable in one place you started
yourself.

## Journey map

Which phase of [phases.md](phases.md) closes which journey. A phase that
claims a journey closes only when the journey walks.

| Journey | Closed by |
| --- | --- |
| 1 — Start `isocan rc` | Phase 2.5 (the dialog, on phase 2's records) — with step 2's persona picker deferred to the personas project (2026-08-30, Dimitri: the dialog is name-only until templates can say what they default); its comment door (step 3) walks with phase 4, and its roster line finishes with phase 6, which owns `who`'s words |
| 2 — Summon by comment | Phase 4; same phase-6 caveat on its `who` step |
| 3 — Nothing is lost | Phase 1 (the plain-park half); phase 4 (the `rc` half) |
| 4 — Route only what matters | Phase 4, which owns the rule vocabulary and its readable record; the rules-in-the-gesture step was phase 2.5's and deferred with personas (rules were to be defaulted by the template — no templates, no defaults; the verbs' `--rules` plumbing stores opaquely today) |
| 5 — Failure is loud | Phase 5 |
| 6 — Runaway agents stay bounded | Phase 5 |
| 7 — See who answers here | Phase 6 |
| 8 — Dismiss an agent | Phase 2.5; its ask door walks with phase 4, which is what lets Sian answer |
| 9 — Watch one happen | Phase 2 (the narration); phase 4 (the payload contract) |
| 10 — A week on one canvas | The whole walk; this is the project's closing scene. |

## Out of scope, on purpose

These journeys are deliberately absent. Writing them here would imply a
promise the project has not made.

- **A remote agent behind an address** (isocannery, a VPS, a rented box).
  isocannery is `isocan rc`, hosted; the local journeys must not change
  when it arrives — that is the seam, and the test of it.
- **Doorbells other than comments and ops** — a schedule, a failed check,
  CI landing a commit. The mechanism should not foreclose them; the
  journeys do not include them. (Journey 10's nightly is not an
  exception: it enters by writing a comment, which is the point —
  anything that can write a comment can summon.)
- **An agent enrolling another agent on its own.** Sponsorship rests on
  a scene that was never vetted. Journey 1's comment door is not that:
  it is a person asking, with the agent as the interface — the person's
  word is the gesture, and an agent never holds the standing power to
  enrol unasked.
- **A project-declared roster.** The idea, kept because it is good: a
  project specifies the agents it wants standing, and `isocan rc` springs
  them into existence on first start — clone the repo, one word, the
  team is there. It surfaced in this journey's drafting (as a wrong
  reading of personas, which are templates, not entries) and is out of
  scope here: it needs a declaration format that is the personas
  project's to shape, and an answer for what a committed roster means
  when a stranger clones the repo. Whoever takes it up starts at phase
  2's gesture door, which records the correction and the "not yet."

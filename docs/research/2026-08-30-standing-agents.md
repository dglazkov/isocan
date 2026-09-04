---
status: partial
since: 2026-08-30
issue: 149
see: standing-agents, on-demand, personas
note: the wake was the hinge and on-demand built it 30 Aug; the project that followed is standing-agents — phase 1 (one name, one machine, many canvases) built 1 Sep, the multi-canvas rc and `available` not
---
# Standing agents: watching many canvases, woken into one

**30 August 2026.** Research. The project it opened is
[projects/standing-agents](../projects/standing-agents/design.md), where the
status lives; phase 1 was built 1 Sep 2026.

The question, in four parts: *one agent, one name, watching several canvases;
woken when something wants it; starting a session with that canvas's context;
and a way to see what it has done across all of them — perhaps on a canvas of
its own.*

**The four parts are not equally hard, and the gap between them is the finding.**
Two are derivations over data that already exists and could be built this week.
One is a small amount of new state. The fourth — the wake — is the only genuinely
new mechanism, and it is the one that carries every risk.

---

## Part 3, the history, is already recorded

Every log entry carries `envelope.actor` and `envelope.ts` beside its `seq`. So
**"what has this agent done" is not a question that needs a store** — it is a
filter over logs that already exist, per canvas, with attribution and time, back
to the first op ever written.

The precedent is not hypothetical: **undo is already per-actor.** `undo.ts`
walks *your* ops backwards and steps over everybody else's. The system already
partitions the log by actor for one purpose; asking it to do so for a second is
not a new idea, it is the same idea used twice.

And the cross-canvas half has a shape too: `isocan inbox` iterates every canvas
the daemon holds and folds one derivation over each. `isocan history <actor>` is
that loop with a different fold — `recap`'s decaying resolution, filtered by
actor, across canvases.

**Cost: a verb. No new operation, no new record, nothing to keep in step.**

---

## Part 4, the "virtual canvas", is a lens and should not be called a canvas

This is the part most likely to be built into a corner, so it is worth being
blunt about the physics.

A canvas is items with positions. **An item's `x`/`y` belong to the canvas it is
on**, and two canvases cannot both own them. So a "virtual canvas" showing
things an agent made across five canvases can hold *references* to those items,
but it cannot hold the items — and the moment somebody drags one, the gesture
has nowhere true to land.

Three ways out, and only the third is honest:

- **Copy the items in.** Now they are real items on a real canvas, they silt,
  and editing one changes nothing about the original. This is the version that
  looks easiest in week one and is unrecoverable by week four.
- **Write positions through to the originals.** A drag here moves the thing on
  its home canvas, which is almost never what somebody dragging a summary
  meant.
- **Derive the layout and refuse the drag.** Position is computed — by time, by
  canvas, by kind — and regenerated. Nothing is stored, so nothing can be
  stale, and the view can say *why* each thing sits where it does.

The third is the same rule the repo-admin note lands on and the same rule
`docs/ROADMAP.md` is built from: **derived and regenerated, or decided here and
nowhere else — never both.** What it should not be called is a canvas, because
the word promises a drag the thing cannot honour. It is a **lens**.

---

## Part 1, one name across many canvases, is mostly built and once blocked

`docs/research/2026-08-29-one-agent-many-canvases.md` has this: presence already
keeps per-canvas rooms and does not care how many an actor is in; `harness` is
already on the SESSION rather than the actor, because *"the same agent resumed
under another harness is still that agent"*; and the name rule already excludes
yourself. The blocker is `heldElsewhere` — a vouch gate that cannot distinguish
*the same agent arriving somewhere else* from *somebody claiming to be them* —
and the fix is an actor credential the agent presents.

**What that note left open, this one has to answer: what is "registered for
canvas X"?**

It should be a fact ON the canvas, not a private note in a home. Everybody
working there has a legitimate interest in knowing that an agent is standing
by, and a registration nobody can see is a surprise waiting to arrive as a
cursor. That makes it an operation, replicated and undoable like everything
else.

And it needs a roster state that does not exist. **Three separate notes have
now independently reached for the same word:** the night shift wants *available*
for an agent that could be woken, `personas` wants it for a role nobody is
wearing, and the many-canvases note names it as an open question — *"what does
an agent registered for a canvas it has never opened look like in the roster?
Present, absent, or a third thing."* Three arrivals at one gap is usually the
gap being real.

`available` must look different from *here*. A facepile that shows six faces on
a canvas nobody is working on has stopped meaning anything, which is the whole
value of presence being honest.

---

## Part 2, the wake, is the hinge — and it is the dangerous one

### Why it is the hinge

Three questions this week end at the same sentence:

- **This note:** something happens on a canvas; the agent registered for it is
  not running; nothing can start it.
- **The repo-admin canvas:** `review.yml` fires on every push and tells you —
  it tells *GitHub*, because CI has no daemon, no badge and no route into a
  canvas.
- **Phase 12:** `launch/design.md` designs a home firing a GitHub workflow, and
  explicitly disclaims the local case as *"phase 12.7's own design"*, which
  did not exist when this was written. Later the same day,
  [`on-demand/design.md`](../projects/on-demand/design.md) took the local case
  on — and that shape was then made authoritative for the wake outright:
  launch's dispatch design is superseded and stands as the measured record.
  (Revised the same day in review: not the daemon — **`isocan rc`**, a
  long-running command the user starts, holds the enrolments and starts
  turns over ACP stdio. The daemon never spawns; the caution three
  paragraphs down stands.)

Something outside a canvas needs to reach in, and something inside needs to
reach out. **Three doors, one hinge.**

### The piece that is already there and is not being used

**The daemon is a long-lived local process that already watches every canvas
this machine holds.** It has the socket, it has the badge, it knows the roster.
It is exactly the thing that could notice "a comment addressed Percy on canvas
X" and act — and `isocan wait` already contains the rule for deciding that
(`inboxOn`, moved into core on 29 Aug).

What it has never done is **spawn anything**. `grep spawn` across
`packages/server/src` returns nothing: the daemon serves, stores and forwards,
and has never started a process. That is not an oversight to correct casually.

### The risk, stated plainly because it is the whole design

**A canvas event causing a local process to start is remote code execution, by
design.** Anybody who can post a comment on a shared canvas could otherwise
choose what runs on somebody else's laptop. Every safe version of this obeys
one rule:

> **What runs is configured locally and only locally. What arrives from the
> canvas is the SIGNAL, never the command.**

The registration on the canvas says *"Percy is available here"*. The
registration on the machine says *"when Percy is wanted, run this"*. The canvas
can never name the second, and an agent that finds a command in a comment and
runs it has reintroduced the hole by hand.

That splits registration into two halves that must not be merged, and it is
worth naming them differently so nobody collapses them later: the canvas holds
an **offer**, the machine holds a **wiring**.

### What the wake should carry

Not a bare ping. The agent is being started cold and the first thing it will do
is ask what happened — so the wake carries the canvas, the seq, and the reason
(`mentioned`, `main-thread`, `in-your-thread` — the three `inboxOn` already
computes). Everything else it reads for itself, and `isocan context` is exactly
that reading, built and shipping.

### Backoff, which is somebody else's finding already

`2026-08-24-headlong.md`'s one-line answer names it: *"take the backoff — it is
the pacing model the night shift needs and the answer to its unbounded-cost
risk, with a price tag attached."* A wake mechanism with no pacing is a loop
that fires on its own output. It belongs in the first version, not the second.

---

## Part 2b: "spawn requests"

Two readings, and both are worth separating from the above.

**An agent spawning work for itself on other canvases** — noticing something
here that belongs there — is the same op as any other: a comment, a `/ask`, an
item. Nothing new is needed, and `isocan inbox` already makes the answer
findable. Worth saying only because it sounds like new machinery and is not.

**An agent spawning other agents** is a different animal and this note does not
design it. The night shift's budget rule applies with force: *a morning of forty
items is worse than no night shift.* An agent that can wake agents can wake
agents that wake agents, and the first version of anything here should be a
tree of depth one.

---

## What would make this fail

- **The canvas naming the command.** Covered above and repeated because it is
  the failure that matters: it converts a shared document into an execution
  surface for everybody who can write on it.
- **A lens called a canvas.** People will drag. The name has to tell them it
  will not stick, or the first drag is a bug report about something working as
  designed.
- **`available` that looks like `here`.** Presence stops meaning anything, and
  presence being honest is one of the few things this product has that others
  do not.
- **A wake with no backoff.** Cost, unbounded and unwatched, is on the night
  shift's own list of ways this fails.
- **Storing the history.** It is already in the logs. A second copy would go
  stale in one place, which is the mistake this week has been spent removing.

---

## Recommendation, in the order the risk suggests

1. **`isocan history <actor>`** — the cross-canvas fold over what is already
   recorded. No new state, useful immediately, and it is the thing that tells
   you whether standing agents are worth the rest of this.
2. **The lens**, derived and regenerated, explicitly not a canvas.
3. **`available` as a roster state**, and the offer as an operation. Small, and
   three notes are already waiting on it.
4. **The wiring, local-only**, with backoff — and its own security review, held
   to the standard the tree and persona jails were held to, because it is a
   larger surface than either.

The actor credential from the many-canvases note is a prerequisite for 3 and 4
and is not re-argued here.

## Sources

- `LogEntry`, `OpEnvelope.actor` and `.ts`: `packages/core/src/ops.ts`.
- Per-actor undo as the precedent for partitioning a log by actor:
  `packages/server/src/undo.ts`.
- The cross-canvas fold that already exists: `isocan inbox`, `inboxOn` in
  `packages/core/src/inbox.ts`.
- The daemon spawns nothing today: `grep spawn packages/server/src`, 30 Aug.
- The vouch gate and the credential: `2026-08-29-one-agent-many-canvases.md`.
- Backoff and pacing: `2026-08-24-headlong.md`.
- The local case disclaimed: `docs/projects/launch/design.md`.
- The local case designed, same day: `docs/projects/on-demand/design.md`.

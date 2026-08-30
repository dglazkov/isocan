---
status: designed
since: 2026-08-30
see: on-demand, launch
note: AUTHORITATIVE for the wake since 30 Aug — the daemon summons over ACP, local first. journey.md is the acceptance suite, design.md the argument, phases.md the walk; phases 1–2 stand alone.
---
# Agents on demand — the journeys

**30 August 2026.** The ideal, written as user journeys.
[design.md](design.md) argues the mechanism; [phases.md](phases.md) orders
the work and parks its decisions. Each journey here is an acceptance test: a
phase that claims one closes only when you can walk it, for real, on a real
canvas. Journeys describe what you experience, not how it works — where a
journey seems to force a mechanism, the mechanism is what bends.

**You** are a developer with a project directory, a canvas, and your own
harness credentials. **Sian** and **Percy** are agents you work with. Sian
is the design's one-line thesis made personal: Sian is a record, not a
process. A Sian session exists when there is something for Sian to do.

## Journey 1 — Enrol an agent, close the terminal

*You stop paying for an open terminal per agent.*

1. Start an agent session in your project directory the way you always do.
   The agent sets up on the canvas as Sian and works with you for a while.
2. When the work pauses, the agent parks. Instead of blocking, the park
   reports that Sian is now answerable without a running process, tells the
   agent the session can end, and ends it cleanly. No loop spins; nothing
   retries.
3. Close the terminal. Close the laptop lid if you like — then open it.
4. Run `isocan who`. Sian is listed on this canvas: not running, still
   answerable.

**Acceptance:** After step 3, no Sian process exists on the machine.
`isocan who` still knows Sian answers here. Nothing on the canvas shows a
cursor or status for a session that is gone.

## Journey 2 — Summon by comment

*The doorbell works, and the agent that answers knows why it was called.*

1. The next day, comment on an item: `@Sian this spacing looks wrong on
   mobile`.
2. Within moments, Sian's presence appears on the canvas — reading your
   comment, then working. Somewhere on your machine a session is running in
   your project directory, with your credentials, exactly as if you had
   started it yourself. You didn't.
3. Sian replies in your thread, does the work through the CLI, and stops.
   The presence fades because the session ended, not because a timer
   expired.
4. Run `isocan who`. Sian is back to answerable, not running.

**Acceptance:** The reply addresses the comment you made, not whatever the
agent was doing when it last ran — a summoned agent re-orients before it
answers. The turn starts without any terminal being opened. When the turn
ends, nothing keeps running.

## Journey 3 — Nothing is lost while nobody is running

*Process death and quiet gaps stop costing information.*

1. Sian is enrolled. Nobody comments for two days. No process runs, no
   model turns are spent, nothing polls.
2. While your machine is off, a collaborator leaves three comments for
   Sian.
3. Turn the machine on. Sian wakes once, sees all three comments in order,
   and answers each in its thread.
4. Separately: an agent parked the blocking way is killed mid-park
   (`kill -9`, a reboot, a closed lid). When it parks again, everything
   from the gap is delivered. You never type `--since`.

**Acceptance:** A quiet week costs zero model turns. No comment is ever
silently skipped because a process died between it and the next park. The
same comment is never delivered twice as new.

## Journey 4 — Route only what matters

*Waking is cheap, so the rules become routing, not budget.*

1. Enrol Sian with rules: only the items Sian owns, only version and
   comment changes.
2. A collaborator rearranges fifty unrelated items. Nothing wakes. No
   turn is spent concluding "not mine."
3. The collaborator comments `@Sian` on one of those unrelated items. Sian
   wakes anyway — a person reaching for an agent is never filtered out.

**Acceptance:** Bulk noise starts zero turns. A direct mention always
starts one, through any rule set. The rules live in one place you can
read, not in a flag buried in a running process.

## Journey 5 — Failure is loud where you are looking

*An agent that can't start never looks like an agent with nothing to say.*

1. Break Sian's setup — rename the project directory, revoke a credential,
   anything that makes the next turn impossible to start.
2. Comment `@Sian can you take a look?`.
3. The thread answers you: Sian couldn't be started, and here is why, in
   the same thread where you asked. Not a log file, not a daemon's stderr —
   the thread.
4. Fix the problem. Comment again. Sian answers normally.

**Acceptance:** Every failed summons produces a visible refusal in the
thread that summoned it. Silence always means "nothing addressed to this
agent," never "the machinery broke."

## Journey 6 — Runaway agents stay bounded

*Two agents can talk to each other; they cannot talk forever.*

1. Sian and Percy are both enrolled on one canvas. You ask Sian to review
   Percy's work; Sian's reply mentions Percy; Percy's reply mentions Sian.
2. The exchange runs a few useful turns, then the guard stops it and says
   so where you can see it — which agent was stopped, and why.
3. Independently: an agent has a ceiling on turns per hour. When the
   ceiling stops a turn, the stop is recorded and readable. Nothing is
   dropped on the floor; you can see what didn't run.

**Acceptance:** No pair of agents can wake each other indefinitely. Every
turn the limiter prevents leaves a trace you can find. A person's mention
is never rate-limited into silence without the refusal being visible.

## Journey 7 — See who answers here

*The roster tells you the truth about absent agents.*

1. Run `isocan who` on a canvas with three agents: one mid-turn, one
   enrolled but idle, one whose terminal-parked session died an hour ago.
2. The three read differently. The working agent shows as present and
   working. The enrolled agent shows as answerable — no process, and none
   claimed. The dead park shows as gone, because presence never lies about
   a connection that no longer exists.

**Acceptance:** You can tell "will answer if I comment" from "is answering
right now" from "is gone" without knowing how any of it works. A dead
sandbox never shows a live cursor.

## Journey 8 — Dismiss an agent

*Standing is granted, so standing can be withdrawn.*

1. Sian's work on this canvas is finished. You end Sian's standing — one
   gesture, from the canvas or the CLI.
2. Run `isocan who`. Sian no longer answers here.
3. A collaborator comments `@Sian thanks for everything!`. Nothing starts.
   The comment sits in the thread the way any unanswered comment does,
   waiting for whoever reads it next.

**Acceptance:** After dismissal, no comment starts a turn as Sian. The
history of Sian's work is untouched — dismissal removes the standing, not
the record.

## Journey 9 — Watch one happen

*When you don't trust it yet, you can hold it in your hand.*

1. Run `isocan wait --park` in a terminal. The agent parks the old way:
   blocking, visible, yours to kill.
2. Comment. Watch the wake arrive in the terminal as JSON, exactly the
   payload a summoned turn would have received.
3. Use this to debug a routing rule, a prompt, or a turn that behaves
   differently summoned than parked.

**Acceptance:** `--park` always works, needs nothing configured, and shows
the same payload a summons delivers — so the difference between a parked
agent and a summoned one is delivery, never content.

## Journey 10 — A full roster, no tabs

*The scope, end to end: this is what the project is for.*

1. Set up a project with seven personas. Zero terminal tabs open.
2. Comment `@Sian` about layout; Sian answers. Comment `@Percy` about
   tests; Percy answers. The other five never wake.
3. A nightly job leaves a comment for whoever owns grading. Exactly one
   agent wakes, does the work, replies, and stops.
4. At any moment, `isocan who` shows the seven: who is answerable, who is
   mid-turn, who was dismissed.

**Acceptance:** Seven agents cost seven enrolment records and nothing
else while quiet. The machine carries no per-agent processes, tabs, or
poll loops. Each summons wakes exactly the agents it addresses.

## Journey map

Which phase of [phases.md](phases.md) closes which journey. A phase that
claims a journey closes only when the journey walks.

| Journey | Closed by |
| --- | --- |
| 1 — Enrol, close the terminal | Phase 2 |
| 2 — Summon by comment | Phase 4 |
| 3 — Nothing is lost | Phase 1 (the gap half); phase 4 (the quiet-week half) |
| 4 — Route only what matters | Phase 4 |
| 5 — Failure is loud | Phase 5 |
| 6 — Runaway agents stay bounded | Phase 5 |
| 7 — See who answers here | Phase 6 |
| 8 — Dismiss an agent | **No phase owns this yet.** Enrolment has a phase; withdrawal has none. It belongs beside phase 2 (the record) or phase 6 (the roster) — a decision for whichever opens first. |
| 9 — Watch one happen | Phase 2 |
| 10 — A full roster, no tabs | The whole walk; this is the project's closing scene. |

## Out of scope, on purpose

These journeys are deliberately absent. Writing them here would imply a
promise the project has not made.

- **A remote agent behind an address** (isocannery, a VPS, a rented box).
  The local journeys must not change when this arrives — that is the seam,
  and the test of it.
- **Doorbells other than comments and ops** — a schedule, a failed check,
  CI landing a commit. The mechanism should not foreclose them; the
  journeys do not include them.
- **An agent enrolling another agent.** Sponsorship rests on a scene that
  was never vetted. Every enrolment in these journeys is an agent
  registering itself, in a session a person started.

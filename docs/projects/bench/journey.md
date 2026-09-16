---
status: built
since: 2026-09-14
issue: 309
see: bench, standing-agents, on-demand, agent-custody, sheep-harness, room, memory, inbox
note: DONE — journeys 1, 2 and 3 closed 15 Sep 2026, all four phases with them; phase 3 made enrolment write its own bench row so the registry stays true without curating, and withdrawal never takes a row off — phase 0 listed the agents a person has with reachability measured from three different facts, and phase 1 made `@Name` joinable from the agents panel with NO rc parked, which is the constraint that made an agent's fifth canvas as hard as its first. Journey 3 closed the same day: `@Name join` in the Chat, refusing in a sentence that takes the name and nothing else, so a stranger cannot tell a name on somebody's private bench from one that exists nowhere. Journey 4 stays out of scope. Designed 14 Sep from the bench research note; four journeys. The registry is the personal canvas — agents as items on it — so nothing new stores anything; joining is one op with provenance; and a bench row is honest about reachability before any socket is held. Journey 4 (the rc in a cell) is written here so phases 0–3 do not paint it into a corner, and is NOT in this project's phases.
---

# The bench — the journeys

**14 September 2026.** Four journeys, in the form
[on-demand's](../on-demand/journey.md) set: what you experience, with the
mechanism bending to it. [The research note](../../research/2026-09-14-the-bench.md)
argues the shape; [design.md](design.md) argues the mechanism;
[phases.md](phases.md) orders the work.

The bench is **the agents you can bring on**. Not the agents standing on this
canvas — that is the roster, and it already works. The bench is yours, it
follows you between canvases, and it is the first thing in isocan that is
attached to a *person* rather than to a canvas or a machine.

---

## Journey 1: I can see my agents

Dion has enrolled Percy on four canvases over three weeks. Today he wants to
know what he has.

He runs `isocan bench`. It prints a row per agent: the name, the harness it
runs, where it is standing, and — the part that does not exist today —
**whether anything could answer for it right now**.

```
Percy    claude-code   standing on 4 canvases    ready (this machine)
Sian     codex         standing on 1 canvas      its machine is not here
Wooly    sheep         standing on 2 canvases    ready (sheep-2)
```

On the web he opens his own face and picks **Your bench**. The same three
rows, the same three states, because it is the same derivation.

**What must be true.** The list is per *person*, not per machine: a second
machine that proves the same address shows the same three agents. The list
survives the laptop it was made on. "Its machine is not here" is said plainly
rather than inferred by the reader from a missing ring — today a summons into
silence is indistinguishable from an agent that is thinking.

**What must not be true.** The bench must not claim an agent is ready because
its row exists. A row is a record; readiness is measured.

---

## Journey 2: Have @Name join, from the panel

Theo opens Acme Onboarding. Percy has never worked on it. He opens the agents
panel and, above **Add an agent…**, sees **Your bench** — Percy, Sian, Wooly —
each with **Join**.

He clicks Join beside Percy. Percy appears in the roster, the facepile, and
the mention candidates. `@Percy` now resolves on this canvas.

**What must be true.** Joining requires no parked `isocan rc` on this canvas.
Naming an agent you already own is not the same act as introducing a stranger,
and today they are the same act — *"no rc, no button"* — which is why bringing
an agent to a fifth canvas is as hard as bringing it to its first.

**What must not be true.** Joining must not grant reach nobody asked for. It
enrols the agent on *this* canvas and nothing else; it does not start a turn,
does not widen who may summon, and does not touch the rules on any other
canvas. A bench row confers nothing by itself.

**The refusal that matters.** If Percy's machine is not present, Join still
succeeds — Percy is enrolled and will answer when its machine comes back — but
the panel says so in the same words Journey 1 uses, on the row, before the
click. An enrolment that cannot answer yet is legitimate; an enrolment that
*pretends* it can answer is the bug.

---

## Journey 3: Have @Name join, from chat

Dion is in the Chat on a canvas Sian has never seen. He types:

```
@Sian join
```

The line is a command chip, the way `/anatomy` is. Sian joins, and the thread
says so — one line, in the thread, because **the canvas is the only channel**.

**What must be true.** `@Sian` resolves in the composer *before* Sian is on
this canvas, because Sian is on Dion's bench. Mention candidates gain the
asker's bench beside the canvas's own actors, and a bench candidate is marked
as such so nobody thinks Sian is already here.

**What must not be true.** Somebody else's bench must never be reachable. Theo
typing `@Sian join` on the same canvas resolves nothing, because Sian is not
on Theo's bench — and the refusal says exactly that rather than "unknown
name", which would be a lie about somebody else's private canvas.

---

## Journey 4: The agent that answers at three in the morning

*Written here so phases 0–3 do not paint it into a corner. Walked end-to-end
(16 Sep 2026) once [`room`](../room/design.md) (`#294`), `@sheep/collie`,
replica liveness (`#306`) and immediate hold release (`#308`) landed — pinned
in `packages/cli/test/bench.test.ts`.*

Dion closes his laptop. At 03:00 a teammate in another timezone writes
`@Percy could you look at this?` on a shared canvas. Percy answers.

**What must be true.** Percy's bench row says **ready** while the laptop is
shut (`ready (sheep-2)`), and the reason it can is that Percy is not running on
the laptop — it is a room (`runRoom(deps)`) in a Durable Object (`collie`) that
holds its sockets at the home and wakes the container cell only for active
turns. When the room turns off (`collie off`), `POST /api/rc/release` drops the
hold immediately so the row returns to `elsewhere` without waiting out `waitMs`.

**Why it is written now.** Three things in phases 0–3 would otherwise be built
in a shape that forbids this: the reachability state must be a *measurement*
with room for a third answer, not a boolean about this machine; the join
refusal copy must not say "your machine"; and the bench row must be able to
carry where an agent runs without assuming it is a laptop.

---

## What this project does not do

- **It does not move `agent-secret`.** A second machine reaching the same
  bench sees the same agents and still cannot claim their actors. The bench
  makes that visible; `standing-agents` left it deliberately, and it stays
  left.
- **It does not host anything.** No cell, no worker, no credential that
  outlives a laptop. Journey 4 is the argument for the next project.
- **It does not change custody.** Owner-only summons, the fence, and
  `writtenBy` all hold exactly as they are.

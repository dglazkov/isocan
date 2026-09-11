# The sheep harness — the walk

**10 September 2026.** The order of work for [design.md](design.md). Each
phase ends with **Trajectory**: only what the phase discovered that
changes the project's course.

**Where we are: phase 0 closed the day it was written. Phases 1 to 3
designed and not built.** Three steps below wait on the sheep side and
are marked ⇢ with the journey filed there. Three more journeys are filed
for findings phase 1 works around rather than waits on:
[sheep#4](https://github.com/dglazkov/sheep/issues/4) (setup visible to
the dog), [sheep#5](https://github.com/dglazkov/sheep/issues/5) (a
secret per sheep) and [sheep#6](https://github.com/dglazkov/sheep/issues/6)
(a home directory that survives the container). ⚑ marks a step that
needs the shepherd's permission or account.

## Phase 0 — The spike

**Status: CLOSED (2026-09-10).** `packages/cli/src/sheep.ts`, the branch
in `adapterFor`, the two spawn sites in `main.ts`, and `sheepBirth`.
Config by hand: a `sheep` block in `config.json` naming the command, the
kennel, and what a loopback home is called from a container.

**Outcome:** an agent enrolled with `--harness sheep` answers summonses
from a cell. Four turns on the deployed station against dev.isocan.io:
one hand-driven birth, three summonses from a parked rc, one of them in
a fresh container after the idle period, all on one badge.

**Proof:** the walk itself, recorded in design.md's table. No test: the
spike's job was to find out whether the seam existed.

**Trajectory:** the identity question that standing-agents left open and
#210 planned a phase for was answered by `isocan pass` unchanged, minted
for the agent's actor, so no new credential is designed. The spike ran on
the deployed station rather than the local home planned, because the
configured checkout had no kennel that day; which home an agent's sheep
live at becomes a fact the enrolment carries (phase 1) instead of one
the filesystem decides. #210's D7, a new word chosen first, is answered
with no new word.

## Phase 1 — The harness proper

**Outcome:** `sheep` is a harness like the others. `isocan harness` finds
it by scan: the command on PATH, and the kennel above the rc's directory
or `~/.sheep`, printing the home the kennel names. The `sheep` config
block goes away; `homeAs` survives as the one thing a scan cannot know,
under a name that says what it is. The rc row carries the sheep home's
address beside the sheep id, so a summons from a different directory
resumes the same sheep. The birth narrates each step it takes and what
it costs, and the first summons after a quiet period says setup is
running while it waits. The summoned face gets tool beats: `prompt`
reads `sheep attach --json` and turns pi's tool-call entries into the
inferred statuses the ACP path already produces.

**Proof:** `packages/cli/test/rc.test.ts` gains the sheep harness against
a fake `sheep` on PATH that records its arguments and answers from a
script: enrol, birth, summons, resume, the row's home and id. The scan's
kennel walk is a pure function with a table test.

**Door:** whether `--harness sheep` on a canvas that lives on a laptop
daemon, from a deployed station, is refused at enrolment or at the first
summons. Enrolment is an offer and the machine that honours it may be
another; the design says refuse at the summons, in one sentence naming
both homes. Decide at the door.

## Phase 2 — Withdrawal, and the cost of a cold turn

**Outcome:** `agent.withdraw` for a sheep-harnessed agent aborts a
running turn, ends the sheep for good, removes its pasture, and narrates
each. `isocan badges` on the rc's machine lists a cell's badge as the
agent's surface and ends it with the sheep. A cold turn's install goes
away: the pasture's setup finds the CLI already there.

⇢ Ending a sheep for good needs a sheep verb
([sheep#1](https://github.com/dglazkov/sheep/issues/1)). Until it lands,
withdrawal aborts, drops the secret, and says what remains.

⇢ Installing once needs a sheep mechanism
([sheep#2](https://github.com/dglazkov/sheep/issues/2)). Until it lands,
the brief says a cold turn is slow.

⇢ A birth without a spent turn needs `sheep new` to mint without a
prompt ([sheep#3](https://github.com/dglazkov/sheep/issues/3)).
Until it lands, the opening prompt stays and `--wait` queues the first
summons behind it.

**Proof:** the rc test's withdraw case against the fake `sheep`: abort
then end, pasture removed, badge ended; and a birth case asserting no
opening prompt once the verb exists.

**Trajectory:** to be written at close.

## Phase 3 — The walk, with the bill

**Outcome:** journeys 1 to 5 walked on the deployed station with a real
model, by the shepherd, over a week on one canvas with two agents on the
sheep harness and one on a local one. `GET /home` on the station read
before and after: container minutes, and the model spend from the
transcripts, written into design.md as the number #210 asked for.

⚑ The shepherd's station and Anthropic key, for the week.

**Proof:** the journeys' acceptance lines, checked against the rc's
narration and `sheep log`, and the two numbers.

**Trajectory:** to be written at close.

## Later, and not here

The rc in a cell, which is #210's shape 2 and the on-demand sketch's
isocannery in full. A pasture per canvas once secrets can be per sheep.
The web dialog offering a harness. Each is a project of its own; this
one ends when an agent on the sheep harness can be enrolled, summoned,
resumed and withdrawn with nothing left behind, and its cost is known.

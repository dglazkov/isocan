# Agents on demand — the walk

**30 August 2026.** The order of work for [design.md](design.md), with the
open decisions from the 30 Aug review parked at the door of the phase that
forces each one. The rule is the multiuser walk's: a decision at a door is
made when the phase opens, out loud, with Dimitri driving — not before, and
not by accident inside a commit. Status lines move as phases close; a clean
session starts by believing them.

**Where we are: nothing built.** One thing landed ahead of the walk, 30 Aug:
the routing predicate is `reasonFor` in `packages/core/src/inbox.ts` — one
function, shared by `wait` and the inbox — so phase 4 imports the rule
instead of becoming its third copy.

Phases 1 and 2 are worth building whether or not the rest happens; the
design says so and this walk keeps it true — each closes useful under
`wait` alone.

## Phase 1 — Durable cursors

**Status: NOT STARTED.**

**Work:** Move the park's cursor out of the parked process (`let cursors`
in `main.ts`) and into the daemon, per actor per canvas, advancing only
when a turn completes. Nothing else changes; `--since` becomes something
nobody has to know about.

**At this door — which daemon (review #6, first half).** A thin agent's
`wait` parks at the HOME with no local daemon; the multiuser walk's phase
11 closed on exactly that. "The daemon" in the design quietly means "the
local daemon," and the cursor must live wherever the park actually points —
the daemon the canvas's home names. Decide the wording and the storage
before writing it, and correct the design doc in the same change.

**At this door — one cursor, two doors (review #7).** An actor parked via
`wait` twice, or parked and later also enrolled, shares one per-actor
per-canvas cursor row; advance-on-completion from two readers skips or
double-fires. Decide: a single-reader rule (the second park refuses, or
adopts the row), or a cursor per registration rather than per actor.

**Outcome:** `kill -9` a parked agent mid-gap, park again: nothing in the
gap is missed, and `--since` was never typed.

**Proof:** vitest — a wake advances the cursor only on completion; a killed
park resumes from its stored cursor; two parks on one actor behave as the
door decision says.

**Findings:** *none yet.*

## Phase 2 — The enrolment record

**Status: NOT STARTED.**

**Work:** The record `{ canvasId, actorId, harness, hook, sessionId, cwd,
rules, cursor }`, written by `wait` when the environment says the agent can
be reached without a process; exit 3 and the `next` line; `--park` to force
blocking anyway.

**At this door — who sets `ISOCAN_HOOK`, and what it holds (review #3).**
The variable has no natural setter in the case that matters: a
terminal-run session's harness sets `CLAUDE_CODE_SESSION_ID`, and nothing
sets `ISOCAN_HOOK`; the daemon could set it for agents it spawns, but those
are already enrolled. And for stdio the record's own `harness` +
`sessionId` + `cwd` is already the whole "how to reach me," which makes the
variable's local value either derived or redundant. Candidates: an explicit
gesture (`isocan wait --enroll`, or a config key) instead of an environment
variable; the daemon exporting it only for sessions it starts; or the hook
being computed from what the record already holds, with the variable
reserved for the remote shape. Decide before the flag ships — an
environment variable nobody sets is dead surface on day one.

**At this door — where the record lives (review #6, second half).** Same
answer as phase 1's cursor, stated once: the enrolment belongs to the
daemon the park would have pointed at, which for a thin agent is the home.

**Outcome:** In a reachable environment, `wait` registers and exits 3 with
the documented `next` line; a shell loop terminates on its own; `--park`
still blocks.

**Proof:** vitest for the record's write, exit 3, and `--park`; the record
survives a daemon restart.

**Findings:** *none yet.*

## Phase 3 — The ACP client, stdio, spawning locally

**Status: NOT STARTED.**

**Work:** An ACP client in the daemon, stdio only, spawning the agent
locally. `fs` and `terminal` omitted from client capabilities — the spec
treats omitted as unsupported — so the agent keeps its own disk and shell
and does canvas work through the CLI it already knows.

**At this door — cross-launcher resume is a hypothesis; spike it (review
#5).** `claude-agent-acp` wraps the SDK, not the CLI. Whether a session
born in a terminal can be `session/load`ed through the adapter has never
been checked, and the design's "resume handle filed under the wrong idea"
framing rests on it. The spike: start a terminal session, note its id, try
`session/load` through the adapter, write down what happens — including the
adapter's known restart bugs if they bite. Either answer feeds back into
phase 2's record: `sessionId` as a real resume handle, or as identity only
with resume meaning a fresh session. A design that reasons about a vendor
is a hypothesis.

**Outcome:** The daemon can start a turn in a named agent on this machine
and read its `stopReason`.

**Proof:** The spike's answer written into design.md; an integration test
that spawns a real adapter and completes one turn.

**Findings:** *none yet.*

## Phase 4 — Dispatch

**Status: NOT STARTED.**

**Work:** On an op that `reasonFor` matches for an enrolled agent —
imported from core, never copied — start a turn carrying what `wait` would
have returned. The self-wake guard holds; the summoned agent's turn ends
and the cursor advances per phase 1.

**At this door — what a summons delivers (review #4).** The design says
two things: "the payload `wait` would have returned, same JSON" and "isocan
composes the prompt — the ~1,045-token brief or the ~15,000-token guide."
They are different claims about the same moment. Decide the shape: the JSON
verbatim as the prompt; a composed brief that carries the JSON; or the
guide for a fresh session and the brief for a resumed one. The cold-arrival
risk named in "What would make this fail" — an agent that does not re-orient
— is the other half of this decision, and the auto-upgrade window (the
design's open question about `considerUpgrade` losing its park) can be
settled here too: the daemon sees `end_turn` and knows the idle moment
exactly.

**Outcome:** A comment addressed to an enrolled, not-running agent produces
a reply in the thread with no terminal open anywhere.

**Proof:** The scene, played on a real canvas; vitest for the
dispatch-on-match path and the self-wake guard.

**Findings:** *none yet.*

## Phase 5 — A limit and a reason

**Status: NOT STARTED.**

**Work:** A ceiling on turns per agent per hour, a record of what the
ceiling stopped, and a cycle guard — the per-actor self-wake rule does not
stop A waking B waking A. Silence surfaced: a turn that fails to start
reaches the thread, because an agent that quietly stops answering looks
exactly like an agent with nothing to say.

**Outcome:** Two agents set to wake each other stop at the guard with the
stop visible; a failed start is readable in the thread it failed for.

**Proof:** vitest for the guard and the ceiling; a driven failure whose
message lands in the thread.

**Findings:** *none yet.*

## Phase 6 — The roster

**Status: NOT STARTED.**

**Work:** What `isocan who` says about an agent that is not running.
Presence stays ephemeral; this is a second, durable fact read alongside it.

**At this door — the word.** The design's own open: there is no good word
yet for enrolled-but-not-running, and it may be that the first version has
two states rather than three. The presence grammar (ring, dim, spark) was
Scene 7's and Scene 7 was never vetted — nothing here inherits it without a
fresh look.

**Outcome:** `isocan who` distinguishes a running agent, an answerable
agent, and an absent one — or deliberately collapses two of those, recorded
here as the decision.

**Proof:** vitest for `who`'s output in all states.

**Findings:** *none yet.*

## Deliberately not in the walk

- **Sponsorship** — an agent making another agent answerable. Rests on
  Scene 7, which is not vetted; the first version registers only itself,
  and `wait` already covers that.
- **The remote transport** (WebSocket, isocannery). The seam is phase 3's
  client; building the far side is another project. The one thing that
  holds regardless: isocan stores an address and must never learn what is
  behind it.

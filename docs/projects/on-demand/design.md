# Agents on demand

**30 August 2026.** Design; built the same day (every phase closed — see [phases.md](phases.md)). The project's status lives in
[journey.md](journey.md)'s front matter — the journeys are the acceptance
suite, this doc is the argument, [phases.md](phases.md) the walk.

The thesis in one line: **an agent is not a process, and isocan currently
requires it to be one.**

Today a persona exists on a canvas only while a terminal somewhere holds a
process open. `scripts/new-project.sh --agents claude,codex --launch` says so
plainly — it "opens a terminal tab per agent." Seven personas would be seven
tabs, seven harness sessions, and seven `isocan wait` calls blocking inside
seven tool calls.

This project separates the two. **An agent becomes a durable record; a session
becomes an instance created when there is something to say.** The first version
does this entirely on one machine, with no service, no account and no network
beyond what the daemon already uses.

---

## What already exists, because most of the design is already here

Read from the code, and this is the argument for the whole thing being smaller
than it sounds.

**The resume handle is already stored, filed under the wrong idea.**
`cli/src/identity.ts` maps `<harness>:<session id>` to the actor speaking
through it, and says why that key is stable:

> The id is durable across resume — every harness names the CONVERSATION, not
> the process — so a returning agent presents the same key.

That is a handle for starting a conversation again. It is kept as an answer to
*who is this?* rather than *how do I reach them?* Adding the working directory
and how the agent is launched turns it into the second thing.

**The routing rules are already written, in the wrong process.** `isocan wait`
decides which ops are for whom: the is-this-for-me predicate, the main-thread
rule, thread membership, and the `--item` / `--op` filters. All of it runs
once per agent, inside that agent's own blocked process, against a log the
daemon already holds. *(Since 30 Aug the predicate itself is `reasonFor` in
`packages/core/src/inbox.ts`, one function shared by `wait` and the inbox —
so the rc imports the rule rather than growing a third copy. What
still runs in the blocked process is the loop around it.)*

**The cursor is the bug.** In `cli/src/main.ts` the park keeps
`let cursors: Record<string, number>` in memory. When the process dies the
cursor dies, and the next park starts from *now* — silently missing everything
in the gap. `--since <seq>` exists as the manual repair for exactly this hole.

**Presence is deliberately not durable.** `server/presence.ts` opens with the
rule and `SESSION_TTL_MS` is five minutes:

> The ephemeral plane. Presence lives in daemon memory and WS fan-out only —
> never the oplog, never storage, never undo. Sessions expire on TTL so a
> crashed agent's cursor evaporates instead of haunting the canvas.

That rule is right and this project does not change it. What it adds is a
second, durable fact that sits beside presence rather than inside it.

**An agent needs no checkout.** `core/src/backing.ts` keeps two facts apart and
calls the split the whole design: where a file belongs is a canvas fact and
replicates; whether it is written is a fact about one machine. "The same canvas
on a laptop with no checkout has no disk to be written to." So an agent that
works on canvas items needs the CLI, the network and nothing else.

**And isocan already refuses to build a meta harness.** `cli/src/harness.ts`
ships four harnesses it knows and a `config.json` hook for the rest, so "a
harness isocan has never heard of works the day it ships, not the day isocan
ships." That posture is the constraint this design has to satisfy, not a
detail.

---

## The measurement that decides the design

`isocan wait` is a long poll in thirty-second windows against the local daemon.
The cost is not CPU. It is stated in `cli/src/agent-guide.md`:

> **Size the timeout to your harness.** Set `--timeout` a little under the
> longest tool call your harness allows... `--timeout 3600` where calls can run
> an hour, `--timeout 570` under a ten-minute limit.

Every expiry costs a full model turn — read exit 2, decide, park again. At the
guide's own 570-second example an eight-hour quiet night is roughly fifty
wake-ups, fifty inferences and fifty laps of transcript, to conclude that
nothing happened.

Two other costs come with it. `--timeout` forces isocan to know each harness's
tool-call ceiling, which is a second instance of the coupling `harness.ts`
already works to avoid. And a park is a process, so anything that kills the
process ends the agent's presence with no way back.

---

## The rule

> **isocan holds a standing record of which agents answer on a canvas. When an
> op arrives that one of them should see, isocan starts a turn. Nothing has to
> be running in between.**

Three consequences worth stating separately.

**A session is an instance, not an identity.** "Sian" is a record. A Sian
session is created when there is something for Sian to do and ends when the
turn ends. Several sessions of Sian over a week are still Sian, which
`protocol.ts` already asserts: *"the same agent resumed under another harness
is still that agent."*

**Waking stops being expensive, and that changes what the filters mean.** The
`--item` and `--op` flags exist, in the help's own words, "so a watcher does
not spend a turn deciding it does not care." Once waking costs nothing, they
stop being a turn-budget optimisation and become a routing table — which wants
to live in one place rather than in N blocked processes.

**Anything can ring the doorbell.** A comment is one reason to start a turn. A
schedule, a failed check, a regressed grade or another agent finishing are all
the same mechanism. This project does not build those, but it should not
foreclose them.

---

## The mechanism: `isocan rc` vends sessions

**Revised 2026-08-30, in review with Dimitri.** The first draft of this
section inverted `isocan wait`: an agent's own park would write the
registration when an `ISOCAN_HOOK` variable said the agent was reachable,
a new exit code would tell the loop to stop, and the daemon would spawn
the turns. Three review questions killed it. Nothing sets the variable in
the session that matters. "The session ends cleanly" described nothing —
a harness conversation does not end when a tool call exits. And the
daemon has never spawned anything, deliberately: a process that serves
and stores every canvas on the machine is the wrong process to start
executing as a person. The draft stands here as the record of the shape
that was withdrawn; what follows replaces it.

**`isocan rc`** — named 2026-08-30, with the CLI's user/agent divide
drawn in the vocabulary itself: `isocan rc` is what a person types,
`isocan agent` is the same machinery spoken by an agent, so who may do
what is legible in what they type — is a long-running command the user
starts. One process, in a terminal or under launchd, the shape of
`claude rc` — and bare like it: started in a project directory it takes
no arguments, because the canvas comes from the directory's binding and
the roster is the agents already enrolled there. Agents are enrolled by
explicit gesture — a dialog on the canvas, an ask to an agent you have —
with personas as the templates those gestures offer, never as standing
entries the repo pre-declares (that was a first reading, corrected
2026-08-30: a persona is assigned when an agent is created). You can see
the `rc`, read it narrate, and kill it, and everything it does follows
from the fact that you started it. No agent is ever spawned at a distance by
machinery nobody launched.

The rc parks against the home the way `wait` parks today — the same
`watchLog` long poll, the same cursors, the same `reasonFor` — on behalf
of every agent enrolled with it. When an op matches an enrolled agent,
the rc starts that agent's turn over ACP stdio: its subprocess, its
custody, the person's credentials because it runs as the person. When
the turn ends (`stopReason: end_turn`), the session rests. Nothing runs
in between but the rc itself.

**The summons delivers the payload `wait` would have returned.** Same
JSON, same `entries`, same `reason`. The contract survives the revision:
a summoned turn and a parked wake carry identical content, so the
difference between them is delivery, never information.

**`isocan wait` does not change at all.** No new flag, no new exit code,
no environment variable. The lap and its park remain the single-agent,
in-session shape — still the right tool in a terminal, still how you
debug a routing rule by hand. Enrolment is not something a session does
to itself; it is something the person does at the rc.

**What is stored, and where.** One durable record per enrolled agent per
canvas, split along custody:

```
home:    { canvasId, actorId, rules, cursor }
rc: { actorId, harness, cwd, sessionId }
```

The home holds what routing needs; the rc holds what running the
agent needs, because only the rc's machine can honor it. The cursor
is the important field and must advance only when a turn *completes*, so
an rc that dies mid-dispatch does not double-fire. (Which side of
the split the cursor truly belongs to was the walk's phase 1 door,
closed 2026-08-30: it lives with the daemon the park polls — the home
itself when the canvas is local, the replica when it is not — see the
door record in phases.md and `server/src/park.ts`.)

*Built, phase 2 (2026-08-30): the home half is canvas state, written by
`agent.enroll` / `agent.withdraw` — in canvas state and not a side table
because mention candidates derive from canvas state, so any other home
would leave an enrolled-but-never-spoken agent unmentionable and
unsummonable. The rc half is `~/.isocan/rc-agents.json`. Phases.md's
phase 2 doors carry the full argument.*

**"Answerable" is a derivation, not a field.** Neither half of the
record stores it, because a record cannot know its rc died. The
home says an agent is answerable when the durable enrolment exists AND a
live rc is parked claiming it — the same connection-shaped truth
presence already tells, which is `server/presence.ts`'s rule paying off a
second time. Journey 7 pins the hard half: "answerable" is never
claimed while the rc that would answer is dead — so rc liveness binds to
the connection, not the clock. That is a real build obligation, not a
default: CLI presence today is TTL-based (the multiuser walk's phase 11
measured a killed agent's ring lingering up to five minutes), and the
walk's phase 6 owes the connection-bound path it lacks.

---

## Why local first, and why local is not the lesser version

The same program drives an agent on this laptop and an agent in a rented
box. **The rc runs where the agents should run** — beside your
checkout against your local daemon, on your laptop against isocan.io, or
in a rented box against either. Nothing about it branches on which.

That makes the local version the honest first step rather than a demo. It
also happens to dodge every hard question at once:

- **Credentials.** The rc runs as you, in your environment. An agent
  it starts has exactly the access you would have given it by typing
  `claude` yourself. isocan holds nothing it did not already hold.
- **Filesystem.** Your directory, already bound, already the right one.
- **Custody.** You started the rc, so you own everything it runs.
  There is no spawning at a distance to reason about, because there is no
  distance: the parent of every agent process is a program with your name
  on it.
- **Cost.** A local agent costs what it costs today, plus one idle
  process.

And what it buys is immediately visible: seven personas on a canvas, one
rc, no agent tabs. Comment, and one of them wakes in your project
directory, does the work through the CLI it already knows, and stops.

**The rc is also why the home never grows a spawner.** The daemon —
local or isocan.io — keeps doing exactly what it does: serve, store,
forward. The rc is a client like any CLI; the summons needs no new
server-side mechanism at all. On isocan.io the question "how does the
home reach an agent?" answers itself: it doesn't — an rc somewhere is
parked against it, exactly the way a thin agent's `wait` already parks
against it today.

---

## Why ACP and not something isocan maintains

The constraint from `harness.ts` is that isocan must not own an adapter per
harness. Checked against the alternatives:

- **A command per harness** (`claude -p --resume`, `codex exec`, whatever Pi
  does) is exactly the meta harness the constraint forbids. It grows with the
  harness count and breaks on flag changes.
- **MCP** cannot do it. Every harness is an MCP client, but the 2026-07-28 spec
  permits server-initiated requests only while the server is handling a client
  request — deliberately, so nobody is prompted out of nowhere.
- **A2A** is the right shape and no coding CLI speaks it; adoption is in
  frameworks.
- **ACP** has adapters for about forty agents, maintained by the ACP
  organisation and by vendors, including Claude Code, Codex, Pi, Gemini,
  Copilot CLI, Cursor, Goose and OpenCode. isocan writes one client against a
  settled spec and gains harnesses it never hears about.

Two things to know before starting. `claude-agent-acp` wraps the Claude Agent
SDK rather than the CLI, so skills and `CLAUDE.md` loading should be checked
rather than assumed. And its restart path has open bugs worth reading first,
notably subprocess death leaving a session unusable.

### The spike's answers (phase 3, run 2026-08-30 against `@zed-industries/claude-code-acp` 0.16.2)

The phase-3 door said session persistence was a hypothesis. Measured:

- **`session/load` is a real resume handle.** A fresh adapter process
  loaded a session created by a dead one, replayed the whole history as
  `session/update` notifications during the load, and the resumed
  conversation remembered what it had been told. The rc row's `sessionId`
  is a resume handle, not bookkeeping.
- **A session killed mid-turn survives — with a transient scar.** `kill
  -9` mid-inference, then load from a fresh process: the FIRST load can
  fail ("Query closed before response received"); a retry moments later
  loaded cleanly, transcript intact up to the kill, memory intact. So the
  client retries a failed load once and falls back to `session/new`, which
  is always available — the handle is best-effort by design.
- **Identity travels by environment injection, and only that way.** The
  adapter's shells inherit the adapter process's environment;
  `CLAUDE_CODE_SESSION_ID` is NOT set inside them. So the rc launches one
  adapter per agent with `ISOCAN_HARNESS=agent` and
  `ISOCAN_SESSION_ID=<canvasId>:<name>` — which makes the CLI inside
  present exactly the session key the enrolment claim minted
  (`agent:<canvasId>:<name>`): the mint claim IS the session binding. A
  CLI-added agent needs no rebinding ever; a web-added one needs a single
  idempotent `actor.claim { as }` on the machine badge, which the turn
  makes.
- **Wire facts**: newline-delimited JSON-RPC 2.0; `protocolVersion` is
  the integer `1`; a finished turn is `stopReason: "end_turn"`;
  permission requests arrive as `session/request_permission` with options
  answered by `optionId`; `loadSession: true` is advertised. The adapter
  refuses to start inside a Claude Code session (`CLAUDECODE` must be
  scrubbed — the rc scrubs every harness variable before injecting).

---

## Relationship to `launch/`

[`launch/design.md`](../launch/design.md) is the operational half of the same
registration idea, written a day earlier, and it picks a different hook: a
GitHub `workflow_dispatch`. It was the gate on the multiuser walk's phase 12
until that phase retired into this project (2026-08-30), and is now
superseded — the decision is at the end of this section — but its spike ran
and its measurements stand. The two hooks differ on one property that doc
measures better than this one could:

> **204, and no run id.** `workflow_dispatch` answers `204 No Content`. It does
> not say which run started, and there is no field that could carry one. The
> home therefore learns *the request was accepted*, which is not the same as
> *something is running*, and it cannot learn the second by asking.

Everything hard in that doc follows from it — observing failure through a
pass-redemption deadline, the spark that lies, the re-run button that can never
work.

An address does not have that problem. You open the socket and you are either
talking to something or you are not, immediately, and the turn's outcome
arrives as `stopReason`. There is nothing to poll and no gap to reason about.

The price is symmetrical and worth stating plainly. A dispatch hook needs
nothing to be running, and works with infrastructure every repo already has. An
address needs something to be listening — the rc on your own machine,
a service somewhere else. So:

- **A dispatch hook creates an agent per summons.** Cold start, fresh
  onboarding, zero idle cost, weak observability.
- **An address wakes an agent that exists.** Warm session, no re-onboarding,
  some idle cost, exact observability.

They are not competitors so much as the two ends of the same registration, and
a home that stores "a hook" could hold either.

**Decided 2026-08-30, by Dimitri: the ACP address shape is authoritative.**
launch/design.md is superseded and stands as the measured record of the
dispatch alternative. A home that stores "a hook" still could hold either —
the record's shape does not foreclose a dispatch hook returning one day — but
the design of record is the address, locally and everywhere else.

## isocannery, sketched

Not this project. Kept in view so the seam is real when it arrives.

**What it is.** A service that hands you a `wss://` ACP endpoint with your
agent, your credentials and optionally your repo behind it, and sleeps it when
nobody is talking to it.

**The one thing isocan must never learn.** isocan holds an address. It must
work identically against isocannery, a `stdio-to-ws` on someone's VPS, and a
process on the same laptop. If isocan ever branches on which, the two products
have become one with a confusing bill.

**Requirements, loosely:**

- Speak ACP over WebSocket at a stable address, with reconnect that survives
  the endpoint going away and coming back.
- Sleep on `stopReason: end_turn` and wake on connect. This is the product.
  e2b pauses with memory and filesystem intact, resumes in about a second and
  stops billing while paused; exe.dev gives persistent VMs a public hostname.
  At published e2b rates a small box is roughly $0.0666/hour, so seven agents
  awake twenty minutes a day is about five dollars a month and seven agents
  left running is about three hundred and thirty.
- Two-tier recovery. A resumed pause needs no protocol help at all. A destroyed
  box falls back to `session/load` against the transcript on the persistent
  disk, which costs a full history replay.
- Hold credentials so isocan does not. Anthropic's vault pattern — secrets
  substituted at egress, never visible inside the sandbox — is the shape to
  copy.
- Default to no repo. Canvas work needs no checkout, and asking which branch is
  the question that stalls the first five minutes.
- Bound creation. isocan bounds authority; spend is the harness account's, so
  the cap on how many agents exist has to live here.
- Accept a release message. When isocan revokes an agent's standing, isocannery
  has to hear about it or bill for boxes belonging to agents with no standing
  anywhere.

**Where the pieces click.** isocannery is isocan rc, hosted: the ACP
client, the enrolment record, the prompt composition, the routing rules
and the cursor are all the same program running in somebody else's box
instead of your terminal. Build the local rc and the remote one is a
deployment, not a design.

---

## What to build, smallest first

1. **Durable cursors.** Move the park's cursor out of the parked process,
   per actor per canvas, advancing on completion. Useful today under
   `wait` alone, with no protocol involved and nothing else changed.
2. **The rc and its enrolments**: the long-running program, the
   record split between home and rc, and the gestures that create
   and withdraw an enrolment. The walk takes this in two phases: the
   records and verbs, then the web doors (the tray and dialog that
   journeys 1 and 8 walk through).
3. **The ACP client in the rc**, stdio only, spawning locally. Omit
   `fs` and `terminal` from client capabilities so the agent uses its own
   disk and shell — the spec treats omitted capabilities as unsupported —
   and let the agent keep doing canvas work through the CLI it already
   knows.
4. **Dispatch**: on an op the routing rule matches, start a turn with the
   payload `wait` would have returned.
5. **A limit and a reason.** A ceiling on turns per agent per hour, and a
   record of what the ceiling stopped. A cycle guard, because the existing
   self-wake guard does not stop A waking B waking A.
6. **The roster.** Whatever `isocan who` should say about an agent that is not
   running. Open — see below.

Step 1 is worth doing whether or not the rest happens — it closes useful
under `wait` alone, which is what journey.md's front matter and phases.md
both say of phase 1.

The walk is [phases.md](phases.md) — the same steps as phases (step 2
split in two there), with this doc's open decisions parked at the door of
the phase that forces each one, to be made when the phase opens and not
before.

---

## What would make this fail

**An agent that arrives cold and does not re-orient.** Under `wait` an agent
parked on purpose and knows why it is awake. Under a summons the turn arrives
unrequested, with the session's last memory being some other piece of work.
Whether it re-reads the canvas or assumes the comment relates to what it was
last doing is a prompt-design question, and no amount of plumbing answers it.
This is the risk that only shows up in use.

**Agents waking each other.** The existing guard is per-actor: "Your own ops
never wake you — otherwise an agent that writes what it was watching for wakes
itself, forever." Nothing stops two agents doing it to each other, and under
`wait` the loop was bounded by timeouts and human patience.

**Silence.** If a turn fails to start, that must reach the thread. An agent
that quietly stops answering looks exactly like an agent with nothing to say.

**Two doors disagreeing.** CLI agents and summoned agents on one canvas at once
is fine as long as everything lands as ops. Presence is where it could go
wrong: cursors and status text are modelled on the park-and-wake lifecycle, and
a summoned agent never parks. Closed (#80) by making the summoned turn use the
same presence machinery rather than a parallel one: the rc writes the face's
session id into the actor's session pointer for the length of the turn, so the
CLI inside narrates and moves that cursor exactly as a direct agent's does; the
adapter's event stream turns tool calls into inferred statuses on the same
face; and a heartbeat keeps the face under the TTL for turns longer than five
minutes. The pointer is removed with the face when the turn ends.

---

## Open

- **What `isocan who` says about an agent that is not running.** *Settled at
  phase 6's door (2026-08-30): `answerable` when a live rc holds a
  connection claiming the agent (POST /api/rc/hold — the fact dies with the
  socket), `enrolled` with "nobody is listening right now" when the record
  stands alone. Three readings, connection-bound, per journey 7.*
- **Whether an agent may make *another* agent answerable unasked.** Everything
  about sponsorship and standing mints currently rests on Scene 7, which is
  not vetted. (The bullet's old closing line — a first version where an agent
  registers *itself* — described the withdrawn `ISOCAN_HOOK` mechanism; under
  the `rc`, no agent registers anything on its own. Journey 1's comment door
  is a person asking, with the agent as the interface, and phase 2's door owes
  the decision on where the person's word is checked.)
- **Where the auto-upgrade window goes.** *Settled at phase 4's door
  (2026-08-30): the rc is the parked process, and its quiet laps run the
  same idle-point consideration `wait`'s park does.*
- **Whether the prompt is the short brief or the full guide.** *Settled at
  phase 4's door (2026-08-30): a fixed brief around the wait-shaped
  payload — orientation and the guide pointer carry cold arrival; the
  15k onboarding is never inlined. The wrapper is identical for fresh
  and loaded sessions, per journey 9's bound.*

---

## Sources

- `packages/cli/src/main.ts` — the `wait` command, its filters, cursors and
  exit codes
- `packages/cli/src/agent-guide.md` — the documented lap, and sizing the
  timeout
- `packages/cli/src/harness.ts` — built-in harnesses and the `harnessVars`
  hook
- `packages/cli/src/identity.ts` — the registry, durable across resume
- `packages/core/src/protocol.ts` — the same agent under another harness is
  still that agent
- `packages/server/src/presence.ts` — the ephemeral plane and its TTL
- `packages/core/src/backing.ts` — canvas facts and machine facts
- `docs/research/2026-08-24-local-agents.md` — onboarding measured in tokens
- `docs/projects/multiuser/journey.md` — Scene 6, built; Scene 7, not vetted
- `docs/projects/launch/design.md` — the other hook shape, and the `204`
  finding that separates them
- [Agent Client Protocol](https://agentclientprotocol.com) — spec, SDKs, agent
  registry

---
status: designed
since: 2026-08-30
see: on-demand, launch
note: inverts isocan wait — the daemon summons instead of the agent parking; local first over ACP stdio. Steps 1–2 (durable cursors, the enrolment record) are worth building alone.
---
# Agents on demand

**30 August 2026.** Design. Nothing built.

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
decides which ops are for whom: `addressesMe`, `isForMe`, the main-thread rule,
thread membership, and the `--item` / `--op` filters. All of it runs once per
agent, inside that agent's own blocked process, against a log the daemon
already holds.

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

## The mechanism: `isocan wait`, inverted

**No new verb.** The lap's step 6 stays `isocan wait --json --timeout <sec>`.
What changes is what the command does when the environment says the agent can
be reached without holding a process open.

```
ISOCAN_HOOK=<how to reach me>
```

Read from the environment, the way `harness.ts` already reads session ids, and
overridable in `config.json` for a host isocan has never heard of. When it is
absent, `wait` blocks exactly as it does today. When it is present, `wait`
records the registration and returns immediately.

**The summons delivers the payload `wait` would have returned.** This is the
property that keeps the agent's code unchanged: same JSON, same `entries`, same
`reason`, same `next`. Only the delivery differs.

**Exit 3 means stop.** Today every `wait` outcome means keep going — 0 with
feedback, 2 on timeout and the guide saying park again. Registering means the
opposite, and an agent that misses that will call `wait` again immediately and
spin at full speed. A distinct exit code makes a shell loop terminate on its
own and lets an agent get it right without parsing JSON.

```
$ isocan wait --json --timeout 900
{"state":"oncall","hook":"…","next":"exit — a summons starts you again
 with the payload this call would have returned"}
# exit 3
# stderr: registered instead of parking — nothing needs to hold a process
#         open here, so --timeout is moot.
```

`--park` forces the blocking behaviour anyway, for debugging and for a summons
path that is not yet trusted.

**What the daemon stores.** One durable record per agent per canvas:

```
{ canvasId, actorId, harness, hook, sessionId, cwd, rules, cursor }
```

The cursor is the important field and it is the one that must advance only when
a turn *completes*, so a daemon that dies mid-dispatch does not double-fire.
Moving the cursor out of the parked process is worth doing on its own merits —
it turns `--since` from a manual repair into something nobody has to know
about.

---

## Why local first, and why local is not the lesser version

The same client drives an agent on this laptop and an agent in a rented box.
The only thing that differs is one line: whether the daemon spawns a subprocess
or dials an address.

That makes the local version the honest first step rather than a demo. It also
happens to dodge every hard question at once:

- **Credentials.** The daemon runs as you, in your environment. An agent it
  starts has exactly the access you would have given it by typing `claude`
  yourself. isocan holds nothing it did not already hold.
- **Filesystem.** Your directory, already bound, already the right one.
- **Custody.** There is none to argue about. It is your machine.
- **Cost.** A local agent costs what it costs today.

And what it buys is immediately visible: seven personas on a canvas and no
terminal tabs. Comment, and one of them wakes in your project directory, does
the work through the CLI it already knows, and stops.

**The transport is the who-is-on-top decision.** Over stdio the client spawns
the agent as a subprocess, so isocan is the parent — which is correct on your
own machine and wrong on isocan.io. Over WebSocket the agent listens and isocan
dials, so whoever started the agent still owns it. Choosing stdio locally and
WebSocket remotely is not two designs; it is the same design placing custody
where it belongs in each case.

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

---

## Relationship to `launch/`

[`launch/design.md`](../launch/design.md) is the operational half of the same
registration idea, written a day earlier, and it picks a different hook: a
GitHub `workflow_dispatch`. It was the gate on the multiuser walk's phase 12
until that phase retired into this project (2026-08-30); it stands on its own
now, more detailed than this doc and spiked. This is not a replacement for
it. It is a second hook shape, and the two differ on one property that doc
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
address needs something to be listening — which is free on your own machine,
where the daemon can spawn it, and is a service somewhere else. So:

- **A dispatch hook creates an agent per summons.** Cold start, fresh
  onboarding, zero idle cost, weak observability.
- **An address wakes an agent that exists.** Warm session, no re-onboarding,
  some idle cost, exact observability.

They are not competitors so much as the two ends of the same registration, and
a home that stores "a hook" could hold either. Deciding between them is a real
choice and this doc does not make it — it argues only that the address shape is
the one that works locally, and that local is where to start.

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

**Where the pieces click.** The daemon's ACP client, the enrolment record, the
prompt composition, the routing rules and the cursor are all identical. Local
spawns; remote dials. Build the local one and the remote one is a transport and
a URL.

---

## What to build, smallest first

1. **Durable cursors.** Move the park's cursor into the daemon, per actor per
   canvas, advancing on completion. Useful today under `wait` alone, with no
   protocol involved and nothing else changed.
2. **The enrolment record**, written by `wait` when `ISOCAN_HOOK` is set, plus
   exit 3 and the `next` line.
3. **The ACP client in the daemon**, stdio only, spawning locally. Omit `fs`
   and `terminal` from client capabilities so the agent uses its own disk and
   shell — the spec treats omitted capabilities as unsupported — and let the
   agent keep doing canvas work through the CLI it already knows.
4. **Dispatch**: on an op that `isForMe` matches, start a turn with the payload
   `wait` would have returned.
5. **A limit and a reason.** A ceiling on turns per agent per hour, and a
   record of what the ceiling stopped. A cycle guard, because the existing
   self-wake guard does not stop A waking B waking A.
6. **The roster.** Whatever `isocan who` should say about an agent that is not
   running. Open — see below.

Steps 1 and 2 are worth doing whether or not the rest happens.

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
a summoned agent never parks.

---

## Open

- **What `isocan who` says about an agent that is not running.** Presence stays
  ephemeral, so this is a second fact read alongside it. The word matters and
  there is not a good one yet. It may also be that a first version has two
  states and not three.
- **Whether an agent may make *another* agent answerable.** Everything about
  sponsorship and standing mints currently rests on Scene 7, which is not
  vetted. A first version where an agent only registers itself is much smaller
  and `wait` already covers it.
- **Where the auto-upgrade window goes.** `considerUpgrade()` uses the park as
  "the first idle point." With no park there is no window — though a daemon
  that sees `end_turn` knows the moment precisely, which is better than
  inferring it.
- **Whether the prompt is the short brief or the full guide.** isocan composes
  it now, so it owns the cost that agents currently pay themselves: about
  15,000 tokens for the documented onboarding, about 1,045 for the six-command
  brief.

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

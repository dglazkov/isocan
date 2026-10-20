---
status: designed
since: 2026-10-17
see: sheep-harness, critique, on-demand, agent-custody, harnesses, personas, standing-agents
note: specified 17 Oct 2026, nothing built. The form "running an agent off the laptop" was expected to come back in when the sheep harness was removed (18 Sep 2026). An agent that only needs to read a canvas and leave notes — a critic, a persona, a reviewer — runs as a Pi Durable session on Cloudflare (one Durable Object per agent, a durable inbox, hibernation between turns) with an isocan tool that speaks to the home's API, so a turn has no container and no CLI install. The rc on the laptop still starts every turn; a runner in the cloud is a later phase, gated on a custody decision. Built from what survived sheep's removal — the rc's `RoomAdapter`, `isocan pass --agent`, critique's ceiling — and from Earendil's Pi Durable sample.
---

# Durable agents

This is the **ideal**: a critic you add to a canvas should answer in
seconds, cost nothing while nobody asks it anything, and never need a
machine of yours to be the one doing its thinking.

The mechanism is [`design.md`](design.md); the walk is
[`phases.md`](phases.md). What came before is
[`sheep-harness`](../sheep-harness/), built, walked and removed; read its
measurements before arguing with this one.

## The sentence

> **An agent that only points and explains needs no machine of its own —
> only a place to remember, and a way to be woken.**

---

## Scene 1 — A critic that answers in seconds

Maya has *Inevitable* and *Form Follows Emotion* on her canvas as critics
([critique](../critique/)). Today each critique starts an adapter process on
her laptop. She enrols them again with `--harness durable`.

**She asks** *Critique with… both* on the checkout screen.

**She sees** both critics' pins arrive within a minute: the same notes, the
same colours, the same read, as before. Her laptop ran the rc and nothing
else. Asked again ten minutes later, after both have hibernated, they answer
just as fast. There is no container to start and no CLI to install.

**The point**: for an agent that only reads and leaves notes, the slow part
of a remote turn (the 2 to 3½ minutes the sheep spike measured, nearly all
of it `npm install`) has nothing left to do.

## Scene 2 — What it cost, said

After the critique, the thread says *Inevitable: 4 turns, $0.11 ·
Form Follows Emotion: 5 turns, $0.14*. A third critic asked to go further
stops at its $0.40 cap mid-turn, and says so.

**The point**: critique's dollar cap, unproven because no local harness
reported cost, is proven by a harness that does.

## Scene 3 — The laptop can close (later, and only if decided)

Maya closes her laptop. Overnight, Jun comments on the canvas and mentions
*Inevitable*. In the morning there is a reply.

**The point**: this is the runner in the cloud, the last laptop process
gone. It is phase 4 and gated: it changes who started the turn, which is
the custody rule ([agent-custody](../agent-custody/design.md)), and that is
a decision before it is a build.

## What is not here

- **Builders.** An agent that writes code, runs builds or needs a shell
  stays on a local harness (`claude-code`, `pi`, `codex`). This project is
  for agents whose whole job is reading and replying.
- **A new identity model.** The agent arrives as itself with a pass the rc
  mints, the way sheep did; the badge never enters a prompt.
- **Anyone's account but the person's.** The Durable Objects run in the
  person's own Cloudflare account, on the person's own model key.

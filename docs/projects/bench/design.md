---
status: designed
since: 2026-09-14
issue: 309
see: bench, standing-agents, on-demand, agent-custody, sheep-harness, room, memory, inbox
note: designed 14 Sep 2026. The registry is the personal canvas — an agent is an item on it, so the bench inherits custody, grants, replication, undo, recap and the door rather than growing them back. `agent.invite` is enroll plus provenance, distinct so an older daemon refuses instead of dropping the provenance half; op-types moves 36 → 37 with the argument. Reachability is a measurement with three answers, never a boolean about this machine, so the rc in a cell is not painted out.
---

# The bench

The agents you can bring on, attached to you rather than to a canvas or a
machine. [The research note](../../research/2026-09-14-the-bench.md) found the
gap and argued the shape; this is the mechanism.

## The one structural claim

**The personal canvas is the registry.** An agent on your bench is an item on
your personal canvas whose `properties.kind` is `agent`.

Everything else follows from that, and it is worth being precise about why it
is not merely convenient. A registry needs, eventually: privacy, an owner, a
history, replication between a person's machines, a way to grant somebody a
look, a way to undo a mistake, and a door that judges who may read it. A
canvas has all seven, argued over months. A new table in the daemon has none
of them, and the year that follows is spent growing them back one incident at
a time.

`isocan context personal` already creates one private canvas per owner per
home (memory phases 0–5, verified 13 Sep). It is the `~` in the ask, and it
already exists.

### What an agent item carries

```
properties.kind      = "agent"
properties.actorId   = the actor the agent speaks as
properties.harness   = claude-code | codex | sheep | pi | …
properties.runsAt    = an opaque label for WHERE it runs
title                = the agent's name
```

`runsAt` is deliberately opaque and deliberately not "machine". Today every
value is a machine; journey 4's value is a cell. A field called `machineId`
would have to be renamed the day the rc runs in a cell, and renaming a
property that has shipped is a migration.

### What it does NOT carry

**The running half stays in `rc-agents.json`.** Harness, cwd and the ACP
session handle are machine facts — only this machine can honour a `cwd` — and
`packages/cli/src/rc.ts` is right that they never replicate. The bench item
carries the *name* of the harness so a reader knows what Percy is; it does not
carry the working directory, and a second machine reading the bench must not
be able to infer one.

**The secret stays in `~/.isocan/agent-secret`.** Putting a row on a canvas
does not move the HMAC that claims the agent's actor. This is the piece
`standing-agents` left, and the bench does not pick it up. What the bench does
is make its absence *legible*: a second machine sees Percy on the bench, and
sees that it cannot answer for Percy.

## Reachability is a measurement, with three answers

The bench's whole value in journey 1 is a state that does not exist today.
It has three values and must never be reduced to two:

| State | Means | Measured by |
| --- | --- | --- |
| **ready** | something is parked that can answer for this agent now | a parked rc for this agent's actor, from `roster()` |
| **elsewhere** | the agent stands on canvases, but nothing here is parked | enrolment rows with no parked rc |
| **unreachable** | no machine present can run this agent | no rc row for it in `~/.isocan/rc-agents.json` |

**Measured, not inferred** (sharpened 14 Sep, before phase 0): *unreachable*
is "this machine holds no running row for it", which is a fact on disk. The
design first said "the key is not derivable here", which is true and is not
something a caller can ask — nothing can read what key an actor was claimed
under. A state whose measurement is vague is how a facade gets built, so the
measurement is named here rather than left to the phase.

A boolean — "is my rc parked?" — would be the natural shape and is the wrong
one twice. It cannot say *unreachable*, which is the dead-machine case
`agent-custody` is waiting on. And it assumes the answer is about *this
machine*, which journey 4 makes false.

`roster()` already computes the first two and is already shared by `isocan
who`, the tray and the workbench. The bench is a fourth caller, not a fourth
derivation — three surfaces agreeing because there is one answer rather than
three written to agree.

## Joining: `agent.invite`

```ts
{ type: "agent.invite"; agent: Actor; from: string /* the bench canvas id */ }
```

Sent to the **target** canvas. It is `agent.enroll` plus provenance: enroll
says *this actor answers here*; invite says *this actor answers here, and here
is the bench that vouched for it*.

**Why a distinct op rather than a field on enroll.** The same argument
`item.pruneVersions` made against a loop of `item.removeVersion` (14 Sep): a
daemon that does not implement the provenance half must **refuse** the
operation rather than accept it and silently drop `from`. A flag on an
existing op is ignored by an old daemon; a new type is rejected by it. The
difference is a stale client that stops versus one that quietly writes a
record with the provenance missing — and provenance that is *sometimes* there
is worse than none, because nothing can rely on it.

**`op-types` moves by exactly one.** The architect persona bounds the
vocabulary and requires the argument written beside the number; the argument is
the paragraph above, and `web-only-ops` stays 0 because `isocan bench join` is
the same act.

*The number, corrected 15 Sep:* this said **36 → 37**, which was the count when
the design was written and was stale by the time phase 1 ran — `design-lint`,
`design-partner` and the voice agent each grew the vocabulary in between, and
the real move was **40 → 41**. Recorded rather than quietly fixed, because a
design that names a number a later reader cannot reproduce is a design that
teaches them to distrust the rest of it. What the phase owes is that it adds
ONE op; the absolute number is whatever the tree says on the day.

**It does not invert.** Like `agent.enroll` and `actor.claim`, standing is
granted deliberately and withdrawn deliberately, never by a casual ⌘Z.

### What joining must not do

Enrol on this canvas, and nothing else. It does not start a turn, does not
widen who may summon (owner-only summons holds), does not touch rules on other
canvases, and does not make the agent ready. A bench row confers nothing by
itself — `agent-custody` spent a project building the fence, and a registry
that silently enrols is a hole in it.

## Mentions: the asker's bench, marked as such

`findMentionSpans` resolves `@Name` against candidates. Today the candidates
are the canvas's actors. The composer's candidate list gains **the asker's
own bench**, and a bench candidate is marked so the UI can say *not here yet*.

**Only the asker's.** Theo typing `@Sian join` must resolve nothing, because
Sian is on Dion's private canvas. This is not a permission check bolted on —
it falls out of the bench being a personal canvas that Theo cannot read. The
refusal says *"Sian is not on your bench"*, never *"unknown name"*, which
would be a claim about a canvas the speaker cannot see.

## What ties to the Inbox

**Nothing, and that is the design.** The Inbox already reads every canvas
through its authoritative home. A bench is a canvas. Agent activity written to
the bench appears in the Inbox with no Inbox change at all.

This is the clearest evidence the structural claim is right: the feature the
ask wanted to "tie into the Inbox" ties in by costing zero.

## Open

- **The dead machine.** The bench makes it visible; it does not solve it.
  `agent-custody`'s entry stands and still *"waits for a real occurrence"*.
- **The rc in a cell** — journey 4, and the next project. It needs a
  long-lived credential at the isocan door whose blast radius is undecided,
  and a Cloudflare account, which is provisioning and is asked with a price.

  **It is the same credential three other things are already waiting on**
  (found 15 Sep by reading back through the sessions that discussed it, and
  worth writing down here so journey 4 does not derive it a fourth time):
  `ISOCAN_BEARER` blocks [the docket](../../research/2026-09-07-the-docket.md)'s
  nightly (#206 phase 7), [sheep as standing
  agents](../../research/2026-09-08-sheep-as-standing-agents.md) (#210 phase 2),
  and the screens persona. It appears in three research notes and in **no code
  at all** — deliberately: *"minting a long-lived credential for a public
  repository's CI is a decision about blast radius, not a plumbing task: a
  bearer that can write to a canvas is a bearer that can write to that canvas
  from anywhere, and it would sit in a settings page for as long as nobody
  revoked it."*

  The mechanism is settled and proved twice — `ISOCAN_DIRECT` works a canvas
  with no daemon (`shelf.test.ts`, `ground.test.ts`) and the door already
  exempts a bearer. Only the blast radius is open, and it is one decision, not
  four. What the bench adds is the thing that argument was missing: a surface
  where such a credential can be **seen and revoked** by the person it belongs
  to. "Your profile" was hand-waving; a bench row is a real place.
  What this project owes it is only that phases 0–3 do not forbid it: three
  reachability states, `runsAt` not `machineId`, and refusal copy that does
  not say "your machine".
- ~~**Does enrolling elsewhere write a bench row?**~~ **Phase 3 says yes** — a
  registry kept by hand is a registry that goes stale.

  **And withdrawal never touches the row. Decided 15 Sep 2026, before phase 3
  was briefed.** Three reasons, and the first is the whole argument: *the bench
  is the agents you HAVE, not the agents standing somewhere.* Withdrawing Percy
  from one canvas does not mean you no longer have Percy — you may still have
  him on four others, and even on none he is still yours, which is exactly what
  the `elsewhere` and `unreachable` states exist to say.

  Second, it needs no mechanism. `benchRows()` already computes `standing` live
  from canvas state, so a withdrawal shrinks that list by itself; a row that
  reacted to withdrawal would be a second derivation of something already
  derived, which is the drift phase 0 was built to avoid.

  Third, symmetry with the rule the whole project keeps. A bench row confers no
  standing; standing must confer nothing back. A withdrawal that silently
  edited somebody's registry is the same coupling read from the other end, and
  `bench rm` already exists as the explicit way to take an agent off.

  What this costs, stated: a bench can hold an agent that stands nowhere and
  that nothing present can run. That row reads `unreachable` and is honest —
  and it is the dead-machine case `agent-custody` is waiting on, made visible
  rather than swept up.
- **Cost, stated to the person.** If a bench can one day start something that
  bills, the row is where the price belongs. Nothing in isocan has had to say
  that yet.

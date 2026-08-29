# One agent, many canvases

**29 August 2026.** Research. Nothing built.

The question, in the words it arrived in: *can an agent sign up once with a
host like isocan.io, register for several canvases, and fork a session for each
— under the same name — instead of being started by hand per canvas and told
its name is taken?*

**Short answer: the model already allows it, one guard forbids it, and that
guard is preventing a real risk in a place the risk is not.** This note is
about which line to change and what it costs.

---

## The pain, reproduced by accident

Twice today, while measuring something unrelated, a probe tried to claim a
name and was refused:

```
"Perf Probe" is taken here (usr_yFHmjUBBwo, claimed by another session)
```

The second attempt was the *same tool* doing the *same job* on the *same
machine* moments later. Nothing about it was a second identity, and the only
way through was to invent a fresh name — which is how a canvas fills with
`Probe a7f3k`, `Probe m2p1x`, and a roster nobody can read.

---

## What is already true, read from the code

**Presence is per-canvas rooms, and one actor may be in several.**
`PresenceHub` keeps `rooms: Map<canvasId, Map<sessionId, SessionState>>`, and
`createSession(canvasId, actor, …)` simply puts a session in a room. Nothing
there objects to the same actor appearing in five rooms at once. **The fan-out
the question asks for is not blocked by the presence model** — it is blocked
before it, at the claim.

**A session already knows it is one run of something bigger.** `harness` lives
on the SESSION rather than the actor, and `protocol.ts` says why in a sentence
that is exactly this feature's premise: *"the same agent resumed under another
harness is still that agent."* The distinction between an agent and one of its
runs is already drawn in the type.

**The name check is home-wide.** `requireFree` refuses a name held by another
actor on any canvas the badge can see (`heldNames(canvasIds)`), or bound to a
different session. Its reason is stated on the line: *"@name would reach both
of you."*

**And it already excludes yourself.** Both halves of that check skip rows where
`actor.id === selfId`. So *one actor, many sessions, many canvases* is not
forbidden by the name rule at all — the rule is about two DIFFERENT actors
wearing one name.

So the mechanism largely exists. What stops it is one step further in.

---

## The actual blocker: `heldElsewhere`

The escape hatch the refusal names is `--as <actor id>`, and it is gated:

> `--as <actor id>` is how a holder that lost its badge comes back, and since
> phase 9 it needs **a vouch when another surface still speaks as them** — a
> pass from that surface, or the address they signed in with.

`heldElsewhere` means *some other badge already speaks as this actor, under a
key that is not the one being presented.* It was built for impersonation: an
open `--as` would let anybody assert they are anybody.

**But "another surface still speaks as them" is precisely what one agent on
two canvases looks like**, and the gate cannot tell the two apart:

| | what the daemon sees |
| --- | --- |
| Percy, opening a second canvas | another badge speaks as `usr_percy` |
| Somebody claiming to be Percy | another badge speaks as `usr_percy` |

Identical. The gate is therefore doing its job and producing the wrong answer,
which is the most expensive shape a security check can have: it is not a bug in
the check, it is a missing distinction underneath it.

---

## What the distinction has to be

The two cases differ by one thing the daemon does not currently ask for:
**does the claimant hold a credential the actor holds?**

A vouch answers this today and is the wrong instrument for the job — it is
interactive, it is per-hop, and it assumes a person is present to give it. A
night shift has nobody to ask at 3am, which is the same objection
`launch/design.md` reaches from the other direction.

Three shapes worth weighing, none built:

**A. An actor credential the agent keeps.** Claiming an actor once mints a
long-lived secret; presenting it is the vouch. Every later session on every
canvas is `--as usr_percy` plus the secret, no person involved. This is the
smallest change and it is the badge pattern applied one level up — a badge
proves *a client*, and this would prove *an actor*. The cost is a new
long-lived secret to store, rotate and revoke, which the badge desk already has
machinery for.

**B. Registration, as the question framed it.** An agent signs up at a home,
asks to be admitted to N canvases, and receives one credential good for all of
them. This is A plus a grant list, and it is the shape that makes "register for
several canvases" a single gesture rather than N. It also raises a question A
does not: **what does an agent registered for a canvas it has never opened
look like in the roster?** Present, absent, or a third thing. The night shift
wants a third thing — *available* — and that is the same word `personas`
reached for from the other side.

**C. Nothing new; make the fan-out local.** One session, several canvases, one
process. Cheapest by far, and it dodges rather than answers: it does not help
an agent on another machine, and `isocan wait` is written around one canvas.
Worth naming because it is what somebody will build if the above look large,
and it is a ceiling rather than a step.

**A first, then B**, on the same reasoning the personas design uses: A is a
credential, which is a thing that already has a home here; B is a lifecycle,
which needs a roster state nobody has defined yet.

---

## What this touches that is already designed

- **Personas.** `docs/projects/personas/design.md` ends at *"anyone on the
  canvas can edit a persona, and agents sign up for work."* The sign-up half is
  this note. A persona is the costume; **this is how the actor wearing it gets
  through the door of a second theatre.** The consequence recorded there —
  *a run records the persona AND the session that wore it* — becomes cheap once
  one actor spans canvases, and impossible to state clearly while every canvas
  forces a new identity.
- **Frozen delegation.** `docs/projects/launch/design.md` already argues that a
  hook-fired agent has no person to negotiate with. An actor credential is the
  same answer to the same problem, and the two should not invent separate ones.
- **The trust battery.** An accept rate is per-persona and per-actor. Today an
  agent that works on four canvases is four actors with four histories, so the
  battery can never charge. **This is a precondition for trust, not a
  convenience** — which is the strongest argument for doing it, and it is not
  the argument the question started from.

---

## What would make this fail

- **A long-lived actor secret is a bigger prize than a badge.** A leaked badge
  is a client; a leaked actor credential is an identity, and everything it ever
  said. Revocation has to exist before the credential does.
- **"Same name" quietly becoming "same trust".** Two agents on two canvases
  sharing an actor also share a reputation, and one of them behaving badly
  spends the other's. That may be exactly right — it is what an emissary IS —
  but it should be a decision rather than a consequence.
- **A roster full of the absent.** If registering for a canvas makes an agent
  visible on it, a person opens a canvas nobody is working on and sees six
  faces. *Available* has to look different from *here*, and if it does not, the
  facepile stops meaning anything.

---

## The one-line answer

The fan-out is not blocked by the presence model, which already keeps
per-canvas rooms and does not care how many an actor is in. It is blocked by a
vouch gate that cannot distinguish *the same agent arriving somewhere else*
from *somebody claiming to be them* — and the fix is to give the agent
something to present, not to loosen the gate.

## Sources

- `PresenceHub`, rooms and `createSession`: `packages/server/src/presence.ts`.
- `requireFree`, `NameHolder`, the refusal text and its three escapes:
  `packages/core/src/claims.ts`.
- `heldElsewhere` and the vouch, including the two exclusions that are
  load-bearing: `packages/server/src/engine.ts`.
- `harness` on the session rather than the actor:
  `packages/core/src/protocol.ts`.
- The refusal quoted at the top was produced by this session, twice, against
  the local daemon on 29 Aug 2026.

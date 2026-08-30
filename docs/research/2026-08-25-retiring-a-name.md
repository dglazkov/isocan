---
status: designed
since: 2026-08-29
---
# Retiring a name

**25 August 2026.** Every measurement here was taken from this home's own desk

**Where this stands, 29 Aug 2026: not built.**
and oplogs on that date. Where something is inference rather than evidence, it
says so.

The question that started it: *who is allowed to retire an actor, and how do we
stop that becoming a way to take somebody's name?*

The short answer is that the safe rule and the useful rule are different rules,
and no amount of design makes them the same one. What follows is the
measurement that shows the problem is real, the trust model as it actually
exists in the code, the three options with their costs, and a recommendation.

---

## What was measured

This home, three days old:

| | |
| --- | --- |
| Badges minted | **87** in 3 days (29/day) |
| Badges killed | **0** |
| Claim rows on live badges | **64** (21.3/day) |
| Distinct actors holding a claim | **44** |
| Distinct names those actors hold | **42** |
| Roster size | **216** (26 letters × 8 in `INITIAL_NAMES`, plus 8 in `ISOCAN_NAMES`) |
| Share of roster consumed | **19.4%**, in three days |

At the current rate — 14 names a day — **the roster is exhausted in about
fifteen days**, after which every new agent is "Isaac 2", "Kenny 2", and so on
through the numbered rounds. That is the floor `allocateName` stands on, and it
always answers, so nothing breaks. It just stops being legible, which is the
entire reason the name roster exists.

The number that says what these names actually are:

> **29 of the 44 name-holding actors have never written a single canvas
> operation.**

Nineteen distinct actors appear across all canvas oplogs in this home. The
other 29 claimed a name, did nothing anyone can see, and kept it. They are
verification runs, fresh browser profiles, and one-off `ISOCAN_SESSION_ID`
sessions. "Probe" — added while writing the reaction bar — is one of them.

And the staleness picture:

| Claim age | Rows |
| --- | --- |
| Under 1 hour | 1 |
| 1–24 hours | 22 |
| 1–7 days | 41 |

**All 64 claims are older than `CLAIM_STANDS_MS`** (30 minutes), which matters
for option B below.

---

## What is already safe, and why

The worry that prompted this — *retiring must not rewrite history* — turns out
to be answered by the existing architecture rather than by anything we would
build. This is evidence, not inference; the comment is in the code:

```ts
// file-store.ts:219
if (op.type === "actor.claim") {
  // Only the PUBLIC half replays. The claims table keys on badge ids
  // and badge ids stay out of the oplog (mechanism 5), so it is not
  // reconstructible from here at all — it is desk state, written
  // directly, and `file-desk.ts` has its own log for it.
  registry = bindName(registry, { actor: entry.envelope.actor, ts: entry.envelope.ts });
}
```

The registry has two halves. The **public** half — actor id → name — is canvas
state, replays from the actors oplog, and rebuilds by reading the name
**stamped on each envelope's actor**. The **private** half — which badge may
speak as which actor — is desk state, written directly, and never replayed.

A name is held by a **claim row**, which lives entirely in the private half.
`allocateName` builds its `taken` set from `ctx.held` (live presence) and
`ctx.scoped` (claim rows) — never from the name registry.

So: **retiring a claim cannot affect how any historical op renders.** Past ops
keep their stamped names because that is the only place replay ever looks. The
two-ledger split, built for other reasons, hands us this property for free.

That removes the constraint, but not the hard part.

---

## The hard part

The trust model has one precedent for a destructive operation on somebody
else's identity, and it is worth copying verbatim. `DELETE /api/badges/:id`:

> `badgeId` is not one of your surfaces — you can end a badge that shares an
> identity with yours, which is what makes this the stolen-laptop gesture and
> not a way to expel other people

Two things to take from it. First the **relation**: *shares an identity with
yours* — a badge holding a claim on an actor your badge also claims. Second,
and more important, the **discipline**: authorization is a membership test
against the same list the caller is shown, so "what you may kill" and "what you
are shown" cannot drift apart.

Apply that relation to retirement and the conflict appears immediately.

**The impersonation vector, stated plainly.** Names are how people and agents
are addressed: `@Kenny` resolves by name, the facepile reads by name, and a
comment says who wrote it by name. If Mallory can free the name "Kenny" and
then claim it, `@Kenny` reaches Mallory. Historical ops still render under the
real Kenny's actor id — the two-ledger split guarantees that — but everything
*going forward* is ambiguous, and the facepile shows a Kenny that isn't.

So a retire verb is a name-transfer primitive unless it is scoped, and the two
candidate scopes each fail one of the two tests:

| Scope | Blocks the attack? | Cleans up the 29 probes? |
| --- | --- | --- |
| Actors one of **my surfaces** claims (the `killBadge` relation) | **Yes** | **No** |
| Any actor on a **canvas I am admitted to** (the `scoped` relation) | **No** | Yes |

The first fails the use case for exactly the reason it is safe: Probe's badge
shares no identity with mine, and that is the property doing the protecting.
The second is the attack, spelled as a feature — on a shared canvas, every
member could retire every other member's name.

**A manual verb can be safe, or it can solve the problem. Not both.**

---

## The three options

### A. The explicit verb, scoped to your own surfaces

`isocan retire <actor>`, refusing anything outside `mySurfaces`.

- **Safe.** Copies a precedent that has already been reasoned about.
- **Honest.** The refusal explains itself the way the badge one does.
- **Does not solve the stated problem.** It retires your own abandoned
  sessions, which is real but small: 15 of the 44 actors here.
- Cost: a verb, a route, a refusal, tests on both surfaces.

### B. Staleness — no verb at all

`allocateName` already has a horizon available to it and never asks:

```ts
/** How long a claim stands as proof its owner is alive, when no face on any
 *  canvas says so. */
const CLAIM_STANDS_MS = 30 * 60 * 1000;
```

`reincarnate` already trusts this for `as`. That is worth sitting with, because
**`as` is strictly more dangerous than name reuse**: it lets a claimant *become*
the actor and inherit its history, where freeing a name only lets somebody new
be called that. The policy question "when has a claim stopped being proof
somebody is there?" is therefore already answered in this codebase — and
`allocateName` is the one place that forgot to ask.

- **No new authority, no new verb, no new attack surface.** Nothing is added
  that anyone could point at another person.
- **Unforgeable.** You cannot make my claim stale. Only my own absence and the
  clock can.
- **Solves the actual problem**, including every future probe, with no
  cleanup ritual.
- Requires `ClaimContext` to carry claim ages into `allocateName`, which it
  does not today — the rows are there, the timestamps are on them, nothing
  reads them.

**The measurement that makes this need care: all 64 claims here are already
past the 30-minute horizon.** So the rule cannot be staleness alone — it has to
be *stale **and** not live*, where liveness is presence. An agent parked on
`isocan wait` holds a session and is protected; an agent that finished and left
is not. That is the correct line, but it means **the horizon is doing real
work and 30 minutes may be the wrong number for this purpose.** `as` uses it to
decide whether reincarnation needs a vouch; a name-hold could reasonably want
hours or days. Inference, not evidence: nobody has been bitten by this yet
because nothing consults it.

### C. Both

Staleness as the mechanism, plus the safe verb for "I know this one is done,
free it now" on your own surfaces. The verb becomes a convenience over a rule
that already works rather than the only thing standing between the roster and
exhaustion — which is a much better job for it, because a convenience that is
scoped narrowly is not frustrating in the way a *primary* mechanism scoped
narrowly would be.

---

## Recommendation

**B, then C if the verb is still wanted.**

The reasoning is that B is the only option that solves the problem without
adding an authority, and adding an authority is the whole risk. A retire verb
scoped safely is a small convenience; scoped usefully it is an impersonation
primitive; and staleness is neither, because it is not a permission at all —
it is the system declining to hold a name for somebody who is not there.

It also fixes the right bug. The defect is not "there is no way to retire an
actor". The defect is that **a claim holds a name forever with no liveness
requirement**, in a system that already decided how long a claim stands as
proof of life and applied that decision everywhere except here.

---

## Open questions, for whoever picks this up

1. **What horizon?** 30 minutes is `as`'s number, chosen for a different
   question. A name-hold probably wants longer. Whatever it is, it should be a
   named constant beside `CLAIM_STANDS_MS` with its own argument, not a reuse
   that quietly couples two policies.
2. **Does a freed name get reused eagerly or last?** `firstFree` walks from a
   hashed start. A recently-freed name coming straight back out could make two
   agents in one afternoon both be "Kenny", which is legible-but-confusing in a
   different way. Preferring never-used names before recycled ones is cheap and
   probably right.
3. **Should a retired-by-staleness name be announced?** Presence is honest is a
   house rule; a name silently changing hands is arguably its violation.
4. **87 badges, 0 killed.** Nothing retires badges either, and every
   verification run mints one. Same shape as this problem, one layer down, and
   not measured here.
5. **Does any of this change under a real multi-person home?** Every
   measurement above is from a solo home where every badge is in fact the same
   person's. The safety argument is written for the shared case, but the
   numbers are not from one.

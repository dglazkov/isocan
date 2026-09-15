---
status: designed
since: 2026-09-15
issue: 309
see: bench, sheep-harness, standing-agents, on-demand, agent-custody, room, embed
note: measured AND DECIDED 15 Sep 2026 — the decision: yes for a cell holding a badge that claims a DEDICATED AGENT's actor in the owner's own secrets store, never the person's own badge; not yet for a public repository's CI, which is a different risk that had been bundled with it. Measured — `ISOCAN_BEARER` has been described in three research notes as an unbuilt credential whose blast radius nobody has decided, and it is blocking four things. It is mostly built. `askTheDoor()` already mints with `carrier: "bearer"` and that is the CLI's ORDINARY path, so every `isocan` on every machine already holds the thing: a long-lived bearer badge with no expiry. Revocation exists too — `isocan badges` lists surfaces and `--kill` ends one at the home, and `surfaceKind()` already says "browser" or "machine". What is missing is narrow: a badge minted deliberately for a headless holder and labelled as one, and a decision about scope. The door's per-address mint meter is the real constraint and it argues FOR the long-lived shape.
---

# The bearer is mostly built

**15 September 2026.** Research, in the form
[sheep-as-standing-agents](2026-09-08-sheep-as-standing-agents.md) used.
Nothing built; this note is a measurement and a correction.

> Asked by Dion after [the bench](2026-09-14-the-bench.md) closed with journey 4
> deliberately out of scope: *"How do we move the ball on this one?"*

## The claim this note corrects

Three notes now describe `ISOCAN_BEARER` as a credential that does not exist,
whose shape is settled but whose **blast radius** is an open decision. [The
docket](2026-09-07-the-docket.md) put it best and is the sentence everyone has
been quoting since:

> *"minting a long-lived credential for a public repository's CI is a decision
> about blast radius, not a plumbing task: a bearer that can write to a canvas
> is a bearer that can write to that canvas from anywhere, and it would sit in
> a settings page for as long as nobody revoked it."*

That was true when it was written and it has been repeated, by me among
others, without anybody going to look. Going to look changes the size of the
question by a lot.

## What is actually there, with the files

**A bearer is not a new kind of credential. It is a badge in a header.**
`packages/server/src/badges.ts` reads `Authorization: Bearer <token>` and
returns the same parsed badge a cookie would give, with `carrier: "bearer"`.
The only behavioural difference is the Origin check, which bearer-carried
requests are exempt from *because an attacker's page cannot read a bearer
token* — the comment says so at the line.

**The CLI already mints one, on the ordinary path.** `askTheDoor()` in
`packages/core/src/badge.ts` posts `{ carrier: "bearer" }`. That is not a
special mode; it is what `isocan` does. **Every machine with the CLI installed
is already holding a long-lived bearer badge with no expiry**, in `~/.isocan`.
The thing three notes describe as unbuilt is the thing this laptop has been
using all day.

**There is no expiry, deliberately and in writing.** `badge.ts` says an expiry
is *"a policy nothing has chosen"* and records `at` so a later phase can apply
a freshness rule at the door. So "long-lived" is not a new property to grant;
it is the existing one.

**Revocation is built, including the gesture.** `isocan badges` lists your
surfaces — badges holding a claim on an actor your badge also claims — and
`--kill` ends one **at the home**, which is what actually stops a machine
(its ops are refused and replication goes stale). The verb's own comment calls
it *"the stolen-laptop case"*. And `surfaceKind()` in `main.ts` already
reports each surface as **`browser`** or **`machine`**.

So the docket's worry — *"it would sit in a settings page for as long as nobody
revoked it"* — describes a settings page that exists, a listing that exists,
and a kill that exists.

## What is genuinely missing

Three things, and only one of them is a decision:

1. **A badge minted deliberately for a headless holder, and labelled as one.**
   Today the listing says `machine`, which does not tell your laptop from a
   cell. A person looking at that list should be able to see *"this one is the
   thing that runs while I sleep"* and end it without wondering what else
   stops working.
2. **A scope narrower than a whole badge, or the argument that none is needed.**
   This is the real design question and it is the only one worth a meeting. A
   badge is an identity, not a capability; a cell that only ever answers on
   canvases its agent stands on wants less than a person's badge carries.
3. **The decision, which is now much smaller.** Not *"what is the blast radius
   of an invented credential"* but: **is a labelled, listable, killable bearer
   badge — the same kind every CLI already holds — acceptable in a secrets
   store?**

## The constraint nobody has written down

**The door is metered, per address, and both mint paths share the bucket**
(`packages/server/src/http.ts`, phase 13.7 — `POST /api/door` and the SPA
fallback draw from one meter *because they spend the same resource, a desk
row*). A cell that mints a badge on every wake will trip it, and the symptom
is a silent 401 — a door that just stays shut.

This is worth stating because it **argues for** the long-lived shape rather
than against it. A credential that is minted once and kept is not a convenience
for the cell; it is the only thing the meter permits. A design that tried to be
careful by minting per-wake would fail closed, intermittently, in production,
at three in the morning.

## What this unblocks, and what it does not

Four things have been waiting on this decision: [the
docket](2026-09-07-the-docket.md)'s nightly (#206 phase 7), [sheep as standing
agents](2026-09-08-sheep-as-standing-agents.md) (#210 phase 2), the screens
persona, and [the bench](2026-09-14-the-bench.md)'s journey 4. Each was
waiting on a question smaller than its author believed.

**It does not make the rc-in-a-cell free.** That still needs a Cloudflare
account, which is provisioning and is asked with a price. What it removes is
the sense that a credential has to be invented first.

**And the bench supplies the piece the original argument was missing.** The
docket's objection ended at *"a settings page"* because there was nowhere good
to show such a thing. A bench row is a real surface a person already looks at,
on their own canvas, and an agent that runs in a cell has a row there by
construction.

## What to do, cheapest first

1. **This note.** It converts a four-way blocker into a one-line decision.
2. **Label the headless badge.** Mint-and-label so `isocan badges` tells a cell
   from a laptop, and `--kill` is safe to use on it. No cell, no cloud account,
   no spend, and it is useful on its own — anyone with a CI runner or a second
   machine benefits.
3. **Then the rc in a cell**, as its own project, with the price asked before
   anything is provisioned.

## The decision, 15 September 2026

**Decided by Dion, the day this note was written.**

**Yes for a cell, with a dedicated agent actor. Not yet for a public
repository's CI.**

A cell may hold a long-lived bearer badge in its owner's own secrets store,
and that badge must claim **only a dedicated agent's actor**, admitted only
where that agent is enrolled. **Never the person's own badge.** Then the worst
case is "that agent misbehaves on the canvases it already stands on", which is
the blast radius [agent-custody](../projects/agent-custody/design.md) was built
around, and `isocan badges --kill` ends exactly that and nothing of the
person's.

### Why the two cases split

They had been one decision, and that is most of why this stalled. They are not
the same risk:

- **A cell** — a secret in the owner's own Cloudflare Workers store — is much
  closer to *a second machine you own* than to a published credential. isocan's
  model already accommodates a second machine; what it lacked was a way to say
  which machine, and §"What is genuinely missing" is that gap.
- **A public repository's CI** — the docket's nightly (#206 phase 7) and the
  screens persona — is the genuinely dangerous one. Repository secrets are
  reachable by anyone with write access and by misconfigured workflow triggers,
  which is a well-known exfiltration path and has nothing to do with isocan.

One question blocked both. Only one of them is answered here, and the other is
not weakened by being left: whoever wants the nightly badly enough should argue
it on its own evidence.

### What follows from the yes, and is not optional

1. **A dedicated actor, never the person's.** If the cell's badge claims the
   person, every mitigation in this note is decoration: killing it logs the
   person out of their own life, so nobody will, so it never gets killed.
2. **Labelled at the mint.** `isocan badges` must tell a cell from a laptop
   before somebody ends one. Today `surfaceKind()` says only `machine`, and
   "which machine" is the whole question a person has at that moment.
3. **Minted once and kept.** The door's per-address meter refuses a caller that
   mints on every wake, and the symptom is a silent 401. This is a constraint,
   not a preference.
4. **Killing it ends the agent, not the person.** That is the test of whether
   §1 was really done, and it is worth asserting rather than assuming.

### What is still open after this

The scope question in §"What is genuinely missing" is **answered by
construction rather than by new code**: a badge already carries `admittedTo`
and `claims` (`packages/server/src/desk.ts`), so a badge that claims one
agent's actor and is admitted where that agent stands already has exactly the
narrow reach wanted. No capability model is needed for this.

What remains is the label (§2 above), and then the cell itself — its own
project, with a Cloudflare account, asked with a price before anything is
provisioned.

## What this note does not claim

It does not claim a bearer badge is *safe enough* for a public repository's CI.
That is the decision in §3 above and it belongs to Dion. What it claims is
narrower and checkable: the credential exists, the listing exists, the kill
exists, and the shape everyone has been asking for is the shape the CLI has
been using since the door was built.

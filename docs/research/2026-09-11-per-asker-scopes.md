---
status: designed
since: 2026-09-11
see: agent-custody, roles
issue: 273
note: Recommends NOT building per-asker powers yet, and says what would change that. The mockup's two extra toggles are not one thing — "read and reply, no editing" is the Commenter rung the roles project already refused, and "no shell" turns the agent off, because an agent's hands are the CLI. The one power a per-asker grant could honestly hold is REACH (the fence), which is the owner's machine's and no canvas can promise. Cheapest first step, zero ops: the summons prompt tells the agent who woke it and whose bill it is.
---

# A capability that travels with the summons

**11 September 2026.** Research. Nothing built.

Owner-only summons shipped this afternoon (`0a3e9e7a`, #238/#269): a parked
agent answers its owner alone until its owner widens the gate. Within the
hour the refusal had happened for real, Dion asked for a UI instead of a
command line, and Lamb mocked one up — *Grant Lamb Access*, a who / what /
how-long panel. #272 is building the **who** and the **how long**. This note
is about the **what**: two toggles in that mockup, *create and edit items*
and *run shell / container commands*, both off for a fresh grantee.

The shape is real and it is new. Nothing today is per-asker: an agent's rung
is its own, and the fence on its owner's machine is its own. *"Lamb, when
Dion wakes it, may read and reply but not edit, and may not run commands"*
cannot be said anywhere.

**The recommendation is: do not build it yet.** Not because it is hard — one
part of it is easy — but because two of the three things the toggles promise
are things this project has already refused or cannot honestly keep, and the
third is not per-asker at all. What is worth doing today is one sentence and
zero ops.

## First, two corrections

**The ladder has no comment rung.** #272 and #273 both write it as *view /
comment / edit / own*. The rungs are `view`, `read`, `edit`, `own`
(`packages/core/src/grants.ts:142`, `:146`). A Commenter rung was considered
by the roles project and left out on purpose
(`docs/projects/roles/design.md:508`), with the reason that matters most
here: *"A comment reaches agents and can start work."*

**So "read and reply" is not a rung — it is that refused rung.** Every
non-GET below `edit` is turned away at one hook
(`packages/server/src/http.ts:849`, `capabilityIn` at
`packages/server/src/grants.ts:455`), and a reply is a write. The mockup's
default state — reply yes, edit items no — is the Commenter rung wearing the
word *reply*. It has to be refused again, and harder than on 2 September:
on a canvas where a comment is a summons, an actor who may comment
but not edit can still start turns on somebody's machine and spend their
tokens. That is the thing the gate was built to control, not a smaller
version of it.

## The only two places that enforce anything

**The door — rungs, and the canvas owns it.** A request's rung is read off
the badge's admission for that canvas (`capabilityIn`,
`packages/server/src/grants.ts:455`; the owner routes add a creator floor via
`heldRung`, `:337`). An agent holds what the badge that enrolled it holds
(`docs/projects/roles/design.md:494`), and the sweep recomputes every
admission's rung from its minter whenever anything is disturbed
(`packages/server/src/sweep.ts:202`, `:365`). **Nothing in that path knows
who woke the agent.** There is one rung per agent per canvas, and the sweep
is its author.

**The rc — who may start a turn, and what the turn may reach. The owner's
machine owns it.** `answerPolicy` turns the stored gate into the policy the
rc applies and announces (`packages/core/src/inbox.ts:290`); `mayWake`
(`:322`) is the comparison; dispatch applies it per agent per batch
(`packages/cli/src/main.ts:13387`) and answers a turned-away mention in its
thread (`turnedAwayLine`, `packages/core/src/inbox.ts:442`, called at
`main.ts:13412`). The fence is separate and orthogonal: `fenceSpec`
(`main.ts:12146`) derives an srt policy from the enrolment's directory and
harness (`packages/cli/src/sandbox.ts`) and wraps the adapter spawn. Both are
per agent. Neither is per asker.

## Where a per-asker capability could live

**On the summons.** Refused. A summons is a comment, and the payload is ops
(`dispatchReason`, `packages/core/src/inbox.ts:481`). Putting powers on the
ask means the asker declares what they may do on somebody else's machine,
which is the inversion owner-only summons just closed: *the canvas may
narrow; it may never spend* (`inbox.ts`, `answerPolicy`'s doc).

**As a narrowed rung the turn runs under.** The tempting one — the door is
the only enforcer a canvas owns — and mechanically the most expensive. The
rung sits on a badge's admission per canvas; the rc holds **one** badge for
an agent across every asker; and the sweep rewrites admissions' rungs from
their minters on every disturbance (`sweep.ts:202`, `:372`). A rung narrowed
for one turn would narrow the agent for everybody while it stood, and would
be overwritten the next time anything moved. Doing it properly means a second,
short-lived badge per scope — and a pass carries no rung today
(`packages/server/src/passes.ts` has none; a pass-rooted badge adopts its
minter's, `sweep.ts:365`) — plus an agent CLI that holds two badges and picks
one per turn. That is a real mechanism, and a large one, for a harm nobody
has yet recorded.

**On the gate entry.** The recommendation, if anything is built. It is the
one record where *who*, *what* and *how long* sit together under a writer
rule that already exists — only the owner's word widens, enforced by
`writtenBy` (`answerPolicy`, `inbox.ts:290`; `gateSetAside`, `:310`) — and
`AgentRules` is deliberately opaque on the wire (`inbox.ts:137`: unknown keys
are ignored, never errors), so it costs no op. It is also the record #272 is
already teaching the web to write.

But its enforcer is the rc, not the door. So a gate entry can honestly carry
only what the rc can hold, which is: **whether the turn runs at all**, and
**what the turn may reach**. It cannot carry "may not edit items", because
that is the door's word and the door has one rung per agent.

## What a canvas can and cannot promise, and what that does to the toggles

This is the part the mockup has to survive.

- ***Create and edit items* → refuse the toggle.** It is the Commenter rung,
  and it needs a per-scope badge the system does not have. Shipping it as a
  switch would either do nothing or narrow the agent for everyone.
- ***Run shell / container commands* → refuse the toggle, for a sharper
  reason: it turns the agent off.** An agent's hands are the CLI — the
  summons prompt itself tells it to run `isocan comment reply`
  (`main.ts:12869`) — so an agent that may not run commands may not answer.
  There is also no channel to enforce it: srt's policy is filesystem and
  network, not "no exec", and the permission channel cannot cover it either —
  codex asks no permission for a shell command in its default mode
  (`packages/cli/src/acp.ts:71`), and the client only answers what it is
  asked (`acp.ts:371`, allow-once by kind).
- **What survives is *reach*.** "When Dion wakes it, Lamb may not touch this
  repo and may not reach anything but the daemon and its vendor" is
  expressible: `fenceSpec` already runs **per turn** (`main.ts:13043`) and
  `writeSandboxSettings` already keys a policy file per canvas and actor, so
  the key growing an asker is a small change. And it is a narrowing of the
  owner's own fence, never a widening — a grantee must never be able to widen
  what the owner's machine allows.

So the honest panel says one true thing and declines to say two false ones:
*this grant lets Dion wake Lamb until Friday. What Lamb may do on the canvas
is Lamb's rung, and what it may touch on this machine is Dimitri's fence.*
A control that silently does nothing is worse than a sentence that explains
whose question it is — which is #272's own argument for putting the buttons
under the refusal.

## What the agent sees mid-turn

Today, nothing. The summons prompt names the canvas and the payload
(`main.ts:12869`); who asked is buried in `entries[].envelope.actor.name`,
and the agent is never told that its standing this turn differs from its
standing generally. So a refusal from the door arrives as `ViewOnlyError`
(`packages/server/src/grants.ts:429`) — *"you may read this canvas but not
change it — ask whoever shared it"* — which is the right sentence for a
viewer and the wrong one here: it names a remedy that is not the remedy, and
a model that has just been told to reply will read it as a broken tool and
retry.

The fix is not a new error type. It is that **the turn is told its own
standing before it acts**, in the brief it already gets, and the refusal
repeats the same words. Two sentences, one string each:

> You were woken by Dion, who is not your owner. Dimitri's machine is running
> this turn and paying for it, and Dion's grant covers replying on this
> thread.

and, at the refusal:

> That was refused because Dion's grant does not cover it — not because the
> command is wrong. Say so on the thread; Dimitri can widen the grant.

A refusal an agent can explain to the person who asked is a working tool. A
refusal it can only retry is a broken one.

## What the asker sees before asking

Most of this already exists and is worth saying, because it means the
surprise is already half-solved. `summonsState` returns `refused` with the
policy the moment the ask is made rather than after the 45-second bound
(`packages/core/src/summons.ts:71`, `:114`), and `policyWords`
(`inbox.ts:372`) is the one phrasing the tray, `isocan who` and the
thread-side refusal all share. The rc announces its owner and each agent's
policy with its hold, so the web holds them before anyone types.

What is missing is the same sentence *before* the ask rather than after it —
the roster saying *listens to Dimitri and you* where it says *standing by*.
That is #272's phase 2 panel read backwards, and it is where a powers word
would surface too if one ever existed. One vocabulary, one map, as
`capabilityWord` already does for rungs.

## Does it compose with `--sandbox`, or replace it?

**Composes, and may only narrow.** They answer different questions and are
already sequenced at dispatch: `mayWake` decides whether a turn starts, then
`fenceSpec` decides what it reaches. `--sandbox` stays the owner's standing
posture for every turn; a per-asker reach would be a second policy file
derived from the first, for one asker's turns. A grant that could *widen* the
fence would let a stranger loosen the owner's machine — exactly what this
afternoon's work closed — so the rule is one line: **a grant narrows the
fence or does nothing to it.**

## Is it the same object as #272 phase 3's expiring gate entry?

**Yes, and that is the practical finding.** Both are per-name fields on the
same gate: phase 3 gives each name an expiry, this would give each name a
scope. `listen` is a `string[]` today (`inbox.ts:168`). The moment it stops
being one, it should stop being one **once** — an entry per name, not a
second parallel list keyed by name, which is the drift this repo keeps paying
for (three copies of the roadmap, the hand-kept review index). So the only
ask this note makes of #272 is a shape, not a field: whoever builds phase 3
owns it, and an entry with room is free where a second list is not.

## Should this exist at all yet

**No.** The measured harm was *a stranger can spend your tokens on your
laptop*, and that is closed. The harm these toggles name — a grantee's turn
doing something on the canvas the owner would have refused — has not happened
once, and the two most-wanted toggles are, respectively, a rung this project
refused on argument and a switch that would disable the agent. Building a
policy engine for it now would also spend the thing the roles research spent
a whole note protecting: *a ladder is one comparison, a matrix is a policy
engine* (`docs/research/2026-09-01-roles.md:18`;
`docs/projects/roles/design.md:523` leaves per-action toggles out by name).

**Two triggers would change that, and both are nameable now.**

1. **An op somebody can point at.** The first time an agent woken by a
   non-owner writes something its owner would have refused, and the owner can
   name the op. That is a real scene, it will say which of the three homes it
   needs, and until it happens every design here is guessing which toggle
   mattered.
2. **A turn that does not run on anybody's laptop.** The sheep harness
   already runs its turn in a cell at a sheep home, and `fenceSpec` steps
   aside for it — *the cell is holding it* (`main.ts:12163`). If a cell's
   boundary is ever described by the canvas rather than by the owner's
   machine, then "what this turn may reach" becomes something a canvas *can*
   promise, and the whole argument above about honesty inverts. Lamb is a
   sheep. That is not a coincidence, and it is the likelier of the two.

## The cheapest first step

**Tell the turn who woke it and whose bill it is** — one sentence added to
`summonsPrompt` (`main.ts:12869`), built from values the rc already holds:
the asker is in the batch, the owner is in `answerPolicy`'s result, and
`shared.origins` already computes whose word a turn carries
(`main.ts:12921`, `speakersFor` at `inbox.ts:352`). Pair it with the refusal
wording above.

It is worth doing on its own merits — an agent that knows it is answering a
guest writes a better reply than one that thinks it is answering its owner —
and it is the one thing every later option needs regardless of which home
wins.

**Cost in the op vocabulary: zero.** The vocabulary stays at 33. The gate
lives in the enrolment's opaque `rules` field, written by the enrolment op
that already exists; the summons brief is a string; and what the asker sees
is derived rather than stored, which `summons.ts` argues for at length — *a
receipt is what the person who asked can see, not a fact the canvas holds.*

## Open decisions

- **Dion.** Does the #272 panel show a *what* section at all? The
  recommendation is no section and one explanatory line — but a panel that
  mentions the fence at all is a product call about how much of the owner's
  machine a grantee should be told about.
- **Dion.** Do #272 and #273 get their rung wording corrected to
  *view / read / edit / own*, and does phase 2's people-panel copy get the
  same pass? A comment rung that does not exist appears twice in the issues
  and once in the mockup.
- **Dion.** Is the summons-brief sentence in scope for #272's phase 1, or its
  own small change? It is zero ops either way; it is a question of whether
  the *who* work ships with the agent knowing.
- **Dimitri.** Lamb is the sheep, so trigger 2 is his to see first: is a
  cell's boundary something the canvas should be able to describe? If yes,
  per-asker reach stops being the owner's machine's private business and this
  note's central argument needs re-running.

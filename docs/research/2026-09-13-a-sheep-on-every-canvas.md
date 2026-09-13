---
status: designed
since: 2026-09-13
issue: 210
see: sheep-harness, standing-agents, on-demand, agent-custody, personas
note: asked for a sheep that is always available and keeps adding itself to every canvas its owner can reach. Corrects the obvious shape — it is ONE sheep, not one per canvas, because `redeemPass` endows the PRESENTING badge (so a second pass is a second admission on one badge, not a second badge) and `isocan inbox` is already cross-canvas. So one cell, one badge, one memory, N admissions, and the only laptop left in the loop is whoever mints the passes. Two routes for that: a lap on a credential of yours (buildable today, blast radius is real), or derived admission at the door (one clause in `admittingGrant`, no credential at all) — the second is the load-bearing decision. And the price of always-on is not the model, it is the two-minute cold install: a cell polling faster than the install is a machine you are renting continuously, which is the exact property a cell exists to avoid, so the standing sheep's real prerequisite is killing the cold install and, past that, the wake
---
# A sheep on every canvas

**13 September 2026.** Design. Nothing built. Read from this repository and
from [`dglazkov/sheep`](https://github.com/dglazkov/sheep) at `main`, 13 Sep.

> The ask, in the words it arrived in: *"I kinda want a sheep to always be
> hanging out with me available on every canvas"* — and then: *"how would you
> set up a sheep that is automatically always available and keeps adding
> itself to every canvas a user has access to"*.

This is the [sheepdog](2026-09-04-sheepdog.md) note's pet, re-priced now that
[sheep-harness](../projects/sheep-harness/design.md) is built and a cell is a
thing this repository actually talks to. Most of it turns out to exist. What
does not is smaller and differently shaped than the sheepdog note guessed,
because a Durable Object answers two of its four questions outright.

## The correction that decides the shape

The obvious design — *one sheep per canvas, all wearing one actor* — is
wrong for a pet, and the reason is one comment in `packages/server/src/passes.ts:119`:

> **Redemption endows the PRESENTING badge.** It does not mint a new one.

So a sheep that already holds a badge and redeems a second pass does not
become two identities. It gains an **admission** — one more row on the badge
it already has (`BadgeRecord.admissions`, `packages/server/src/desk.ts:213`).
N canvases is N admissions on one badge, not N badges and not N cells.

And the read side is already cross-canvas. `isocan inbox` is described, in
its own `--help`, as *"Comments addressed to you, across every canvas here"*,
with `--new` reading the seen-mark (`packages/cli/src/main.ts:9323`). One
call, every canvas the badge is admitted to, cursor included.

Put together: **one sheep, one badge, one transcript, N admissions.** That is
also the thing the ask actually describes — a pet that *hangs out with you*
has one memory and knows you across rooms, which N cells with N transcripts
explicitly do not. One sheep per canvas remains right for the other case, a
*worker* summoned by an rc on many canvases, where the spike's finding
applies (*"one agent on two canvases shares one sheep bound to the first"*).
Two shapes, two jobs; this note is about the pet.

## Four questions, and which are already answered

| | What it needs | Where it stands |
| --- | --- | --- |
| **Who runs the turn** | a machine that is not your laptop | **done.** `SheepAgent` in `packages/cli/src/sheep.ts`; a cell is a Durable Object, hibernating when idle, resuming itself through an alarm after eviction |
| **Who it is, on canvas forty** | one actor, several surfaces | **done.** A claim is plural on purpose (`desk.ts:214`), two badges holding one claim is *"the home already saying they are the same person's"* (`http.ts:6151`), and a pass is the vouch (`isocan pass`, `main.ts:3671`) |
| **Which canvases** | a set that follows your access | **half.** `GET /api/projects` already answers *"every canvas whose grants would admit this badge"* (`http.ts:1941`, `?reach=admitted`). Nothing keeps a pet's admissions level with it |
| **Who hears the canvas** | something parked when your lid is shut | **missing.** `isocan rc --all` is *"every canvas this machine's enrolments name"* (`main.ts:13461`) — a laptop process, and the enrolments' list, not your reach |

The first two were the hard ones a year of design worried about, and they are
finished. What is left is a bookkeeping loop and a heartbeat.

## The mechanism, end to end

### One badge, admissions kept level

A lap, run by something of yours, on an interval:

1. `GET /api/projects` — every canvas this owner is admitted to.
2. Subtract what the pet's badge is already admitted to.
3. For each new canvas: mint a pass for `(canvas, Percy)` and hand it to the
   cell, which redeems it. One admission, one HTTP call, no op on the canvas.
4. For each canvas the owner has lost: nothing to do if admission is derived
   (below); one sweep if it is not.

### Enrolment on first act, not on discovery

Do **not** write `agent.enroll` on forty canvases at discovery. The sheepdog
note settled this and it still holds: the offer lands *the first time the pet
acts there*, so the record on any canvas is indistinguishable from CLI
enrolment, and a canvas nobody ever asks the pet about never grows a row.
Presence already draws the distinction: the facepile's three states are
`here`, `available`, `away` (`packages/web/src/lib/facepile.ts`), and an
admitted-but-quiet pet is `available` — *present as a possibility and absent
as a person*. A pile of forty faces on a canvas nobody is working on is the
failure this was built to prevent.

### The gate is already right

Since 11 September an agent answers **its owner alone** until widened
(`isocan rc listen <name> --to …`). A pet standing on a canvas you share with
six other people therefore costs them nothing and answers them nothing, which
is the only honest default for a thing spending your tokens. The one rule the
sheepdog note is emphatic about — *a silent gate is the failure* — is already
honoured: a mention from outside the gate is answered in-thread, naming whose
word the agent takes.

### The switch, and where the three facts live

Unchanged from the sheepdog note, and worth not relitigating: `{ owner,
listen, on, canvases }` in a **kennel record at the home**, keyed by actor —
not on the enrolments, because a switch flipped from a phone must not be N ops
with a failure in the middle; not in `rc-agents.json`, because the laptop is
the thing we are removing. `listen` and `on` are *narrowings*: the canvas can
only ever make the pet do less, so on-demand's rule survives intact.

## The one decision that is load-bearing: who mints the passes

Minting is not self-service, and this is a feature. `redeemPass` roots the new
admission in the **minter's own admission** to that canvas
(`packages/server/src/passes.ts:247`), so the pet cannot admit itself
anywhere it has not already been: somebody admitted there has to vouch. That
leaves exactly two routes.

**Route A — a credential of yours, running the lap.** Buildable today with no
change to the desk. The cost is the blast radius: a credential that may mint
passes for your actors, on every canvas you can reach, living in a cell
forever. That is [#206 phase 7's `ISOCAN_BEARER`](2026-08-29-one-agent-many-canvases.md)
and the sheepdog note's D5, and its rule — *revocation built before the
credential* — is not optional. Scope it to the narrowest thing that works: a
credential that may mint passes **for one actor**, and do nothing else. Not a
bearer of your badge.

**Route B — derived admission.** The sheepdog note's choice, and the reading
of `admittingGrant` (`packages/server/src/grants.ts:205`) says why it is the
better one: the door already merges the canvas's grants, its space's grants
and the creator floor into one answer. One more clause — *a badge claiming an
actor whose kennel record names this owner is admitted wherever that owner is,
capped one rung below* — and there is **no lap, no pass, and no credential at
all**. Admission follows your access in both directions with nothing written,
and the exclusion list in the kennel record is the only thing a person edits.

Route B is the answer to the literal ask (*"keeps adding itself"*), because
under it the pet never adds itself to anything: it is simply admitted, the way
a derived fact is. Route A is the walk you can do this week to find out
whether you want the pet at all.

## What "always available" costs, and why the poll is the hard part

Here is the number that decides the architecture, from the harness spike's own
table: a **cold container is about two minutes**, almost all of it `npm
install -g` of the isocan CLI; warm turns were 16 seconds and about 40; the
turn after the station's ten-minute idle period took 3m40s.

So a self-polling pet is priced by the cold start, not by the model:

- **A lap every 5 minutes** means a container spending two of every five
  minutes installing a CLI. That is not a hibernating cell, it is a rented
  machine with extra steps — precisely the property cells exist to avoid, and
  a bill nobody approved.
- **A lap every hour** is honest and cheap, and it buys a pet that answers
  within the hour. The sheepdog note already named the rule for that tier:
  say so. A thing that answers in an hour must never render as *standing by*.
- **No lap at all** — the home calls the cell when something actually arrives
  — is the only shape that is both instant and idle-free, and it is exactly
  what a Durable Object is for.

Which re-prices the sheepdog note's four ways. Its option B wanted a box that
pauses with memory intact and resumes in a second, and priced an e2b box at a
dollar a month awake, fifty left running. **A cell is already that box**, at no
provisioning cost and with no second vendor. Its option C, the cron tier, no
longer needs a cron: the cell has an alarm as its own heartbeat
(`packages/cell/src/cell.ts:660`, in the sheep repo). And its option A — the
home spawning harnesses — stays crossed out.

So the endgame is the note's own shape 3, and the reason it is now cheap is
that the thing being woken hibernates natively. Two rules from that note carry
over unchanged and are the whole of its safety: **the wake carries canvas, seq
and reason and nothing else** — the moment a payload can say *what to do*,
anyone who can post on a shared canvas chooses what runs in your cell — and
**nothing inbound is trusted**: the home calls out, and the cell then connects
back in with its own badge.

There is also a third option that needs nothing from isocan at all and dodges
the custody argument entirely: **the cell wakes itself.** A self-polling cell
is not *called* by anyone; it is a thing you started that wakes on its own
alarm and asks the home whether anything arrived. That is the same act as an
rc's long poll, minus the socket — and it is the reconciliation on-demand's
principle has always allowed, because custody is *who started it and whose
credentials it uses*. It is gated only on the cold install above, and on one
small thing sheep does not have.

## The one thing this asks of sheep

`sheep`'s verbs are `ls`, `new`, `attach`, `status`, `wait`, `abort`, `rm`,
`log`, `pasture`, `export`. There is no standing wake: the alarm is internal,
the heartbeat of a turn already running. What this design wants is one verb —

```sh
sheep alarm <id> --every 30m -- "<the lap prompt>"
```

— a sheep that re-prompts itself on its own schedule until told not to. It is
a small thing on top of machinery that is already there (the cell re-arms an
alarm at every transition), and it is the difference between a pet and a
cron job on somebody's laptop. Filed there, in the shape sheep#1–#7 were.

The second ask is the cold install, and it is the same one the harness design
left open: sheep#2's pasture cache is never kept from a setup whose
environment held a sheep's own secret, and the pass is one. Until that is
resolved — a secretless warm-up, or a sheep-side split of setup into a cached
half and a secret half — every cold lap pays two minutes. **A standing pet
makes that finding expensive rather than annoying**, which is the strongest
argument yet for fixing it.

## How you would set it up

The gestures, in the vocabulary that already exists — #210's D7 asked for a
new word before anything is named, and the harness answered by not needing
one. Same here: the pet is an enrolled agent whose harness is `sheep` and
whose standing is *everywhere*, and the record is the kennel record.

```sh
isocan rc add Percy --harness sheep --stands everywhere
isocan rc listen Percy --to me          # already the default
isocan rc off Percy                     # the switch, one write at the home
isocan rc stands Percy --except <ref>   # the exclusion list
```

What that sets up, once:

1. **The actor.** `agent:Percy` on your machine badge — the enrolment key is
   the name, with no canvas in it (standing-agents mechanism 1), so the same
   Percy resumes on every canvas.
2. **The cell.** One sheep in Percy's pasture, minted idle, holding
   `BRIEF.md`, the collab skill, and its own `ISOCAN_PASS` as a secret the
   model's own shell cannot read.
3. **The badge.** The cell redeems the first pass; the badge is Percy's, and
   it is the badge every later admission lands on.
4. **The record.** `{ owner, listen: "owner", on: true, canvases: "all" }` at
   the home.

And then, per lap: list your canvases, mint-and-redeem for what is new, read
one cross-canvas `isocan inbox --new`, answer what is for Percy and within the
gate, write `agent.enroll` on any canvas it acts on for the first time, sleep.

## Phases

1. **One sheep, three canvases, by hand, from your laptop.** The lap as a
   script beside the rc; no kennel record, no credential, no alarm. *Proof:*
   one cell, one badge with three admissions, `isocan inbox` inside the cell
   listing all three, and a comment on the third answered by the same cell on
   the same badge — and `isocan history Percy` leading with a row per canvas.
2. **The kennel record and the switch.** The three facts at the home, read by
   the rc as its rules; `off` drops the holds and the facepile changes before
   the dialog closes. *Proof:* flipped from a phone, gone from the facepile
   in one round trip, and the offers still standing.
3. **Derived admission** (route B), retiring the lap. *Proof:* a canvas
   created with no pass minted and no op written; Percy admitted the moment
   it is asked something, and gone from the pet's reach the moment the owner's
   grant is revoked.
4. **The laptop closes.** The sheep-side standing alarm, the cold install
   fixed or the lap interval stated honestly. *Proof:* lid shut, a comment at
   3am, an answer within the stated interval — and the bill, read from the
   station's `GET /home` container minutes before and after a week, which is
   the number the harness spike deferred and this design cannot defer.
5. **The wake**, if the interval turns out to be too slow to be a pet. The
   home calls the cell's address with canvas, seq and reason; the cell
   connects back with its own badge.

Phase 1 is worth doing whether or not the rest happens: it is the whole
mechanism except the heartbeat, walked against a real day before anything is
rented.

## What would make this fail

- **A pet that rents a machine continuously.** The cold install times the
  poll. Any interval shorter than the install is a lie about hibernation.
- **Forty faces on a canvas nobody is working on.** Enrol on first act;
  `available` is not `here`.
- **A credential with no revocation.** Route A's credential must be revocable
  by deleting the record, built before the credential, not after.
- **The wake becoming a command.** Canvas, seq and reason. Nothing else, ever.
- **Two things answering as Percy.** The rc's dispatch already guards it — a
  second `wait` park as the same actor displaces the first
  (`packages/cli/src/main.ts:13794`) — but a cell polling and an rc parking
  are two different code paths, and the guard must be stated in both.
- **A pet in somebody else's roster, answering them.** The gate is owner-only
  and the facepile must say so where a stranger would otherwise wonder.
- **A ceiling per canvas.** It stays per agent, as standing-agents ruled; a
  pet on forty canvases with forty budgets is forty budgets nobody approved.
- **A silent cell.** The harness spike found that a cell which cannot rent a
  container ends its turn in silence, which from the canvas looks like an
  agent that chose not to reply. A pet that does that at 3am is worse than no
  pet; the lap should say so in the thread it was answering.

## Decisions

**D1. One sheep, not one per canvas.** Redemption endows the presenting badge,
and `isocan inbox` is cross-canvas, so N canvases is N admissions on one badge
— one cell, one transcript, one memory. One sheep *per canvas* stays right for
rc-summoned workers, where the binding finding applies.

**D2. Enrolment on first act.** Admission is bookkeeping; the offer is a
statement. Never write forty of them at discovery.

**D3. Derived admission over a minting lap.** Route B needs no credential at
all, cannot go stale, and cannot be tampered with. Route A is the walk, not
the destination.

**D4. If a credential is minted anyway, it mints passes for one actor and does
nothing else** — and its revocation ships before it does.

**D5. The poll is priced by the cold install.** State the interval honestly,
or fix the install. A pet that answers in an hour is a fine thing; a pet that
claims to be standing by and is not is not.

**D6. The wake, when it comes, carries canvas, seq and reason.** Nothing
inbound is trusted; the cell connects back with its own badge.

**D7. No new word.** A pet is an enrolled agent with the `sheep` harness and a
kennel record. `sheepdog` is already taken — in sheep's own vocabulary it is
the agent holding the terminal — and this repository has paid twice in a week
for a word meaning two things.

## Sources

- [sheep-harness](../projects/sheep-harness/design.md) — the three verbs over
  `sheep`, the pasture, the pass as the sheep's own secret, the spike's timing
  table, and the open door this note walks through.
- [`2026-09-04-sheepdog.md`](2026-09-04-sheepdog.md) — the three facts, the
  kennel record, derived admission, the four ways to home a pet, and the
  failure modes, most of which are inherited verbatim.
- [`2026-09-08-sheep-as-standing-agents.md`](2026-09-08-sheep-as-standing-agents.md)
  — the custody reconciliation (D1 there), and the cost of parking (D4 there).
- [standing-agents](../projects/standing-agents/design.md) — the enrolment key
  is the name; the ceiling is per agent.
- [on-demand](../projects/on-demand/design.md) — *no agent is ever spawned at
  a distance by machinery nobody launched.*
- `packages/server/src/passes.ts` (redemption endows the presenting badge, and
  roots the admission in the minter's), `packages/server/src/desk.ts` (claims
  and admissions, both plural), `packages/server/src/grants.ts:205`
  (`admittingGrant`, where a derived clause would land),
  `packages/server/src/http.ts:1941` (`/api/projects`, `?reach=admitted`),
  `packages/cli/src/main.ts` (`inbox`, `rc --all`, the dispatch cursor),
  `packages/web/src/lib/facepile.ts` (one entry per actor; three states).
- `dglazkov/sheep` at `main`: `packages/cell/src/cell.ts` (the alarm as the
  cell's heartbeat), `packages/cli/src/cli.ts` (the verb list, which has no
  standing wake).

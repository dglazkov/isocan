---
status: partial
since: 2026-09-08
issue: 210
see: standing-agents, on-demand, personas, agent-custody
note: phases 2 and 3 DONE (15–16 Sep 2026) — phase 2 (the badge) via sheep-harness, and phase 3 (a parked rc in a cell, with the bill measured) via @sheep/collie running runRoom in a Durable Object rather than a container cell (~$0.13/night list price or $0 incremental under Workers Paid plan included 400k GB-s duration; 0 container minutes idle), with replica liveness (#306) and immediate hold release on stop (#308). Phase 4 (the roster across enrolments) is now the first unbuilt phase.
---

# Sheep as standing agents

**8 September 2026.** Research. Nothing built.

> "How best can I use sheep as standing agents?"

Sources: this repository, and [`dglazkov/sheep`](https://github.com/dglazkov/sheep)
read 7–8 Sep 2026.

## The fit, in one line

**A standing agent's one structural weakness is that `isocan rc` is a process
on a machine.** Laptop shut, agents gone. A sheep is a session in a **cell** —
one SQLite database with an address, constructed on first request and on every
wake, hibernating with its sockets when idle and resuming itself after eviction
through an alarm.

That is precisely the missing half, and it is worth being exact about which
half. isocan already solved *"where is everybody"* by being a canvas: presence
is per-canvas, `rc --all` stands one name on every canvas a machine's
enrolments name, and `isocan history <actor>` is a row per canvas. What it
never solved is *"where does the agent RUN"*, and the answer has always been
"on somebody's laptop, while it is open".

## The obvious join is a shape this project already refused

The tempting design is: a summons calls the sheep's cell address. A cell wakes
on a request, so it is the perfect callee, and idle costs nothing.

**`docs/projects/on-demand/design.md` already had that and killed it.** The
first draft let an agent advertise itself as reachable through an
`ISOCAN_HOOK` variable and had the daemon spawn the turns. Three review
questions ended it, and the principle that replaced it is stated plainly:

> No agent is ever spawned at a distance by machinery nobody launched.

The rc parks, **runs as the person, with the person's credentials, in their
custody** — you start it, you watch it narrate, you kill it. So "just call the
cell" is not a gap to be filled. It is a decision to be re-argued, and it
should be argued on its own merits rather than slipped in as plumbing.

### The reconciliation

**Custody is about who started it and whose credentials it uses — not which
computer it is on.** A sheep is a process a person started, listed by
`sheep ls`, endable with `sheep abort`, running as itself rather than as them.
Nothing about it is "machinery nobody launched"; it simply does not live on a
laptop.

That reading is what makes shapes 1 and 2 below available today without
touching the principle, and it is also why shape 3 still needs the argument
reopened: being *called* is a different act from being *started*.

## Three shapes, and the order to take them

### 1. Sheep as the cheap tier for personas — first

`docs/research/2026-09-07-small-personas.md` (#205) found that the cheap tier
#197 describes **does not exist**: all nine personas are `model: opus`,
`effort: xhigh`, and there is one tier, run nine times a night.

A persona run is short, unattended, bounded, and ends in a written page. That
is a sheep's natural shape exactly — and it needs **no parking, no summons and
no custody question at all**, because nothing is standing anywhere. It is the
one use with a gap that is real today rather than a capability that would be
nice.

It also lands #205's own phase 1 ("one small persona, by hand") on a machine
that is not anybody's laptop, which is the half that note could not answer.

### 2. The sheep is the rc's machine — when overnight matters

`sheep new -- "run isocan rc against this home, parked on these canvases"`.

**No change to isocan at all.** `rc` resolves its context through `ctxOf` like
every other command, so `ISOCAN_DIRECT=<home>` applies to it: an rc can park
against a remote home with no local daemon and no replica. That is proved twice
in this repository already, by `packages/cli/test/shelf.test.ts` and
`ground.test.ts`, which work a canvas exactly that way.

**The cost is the honest part, and it is the thing to say out loud: a parked
long-poll is not idle.** The cell's zero-cost hibernation is exactly the
property parking gives up — you are renting a machine to hold a socket, which
is the thing cells were built to stop needing. It buys agents that answer at
three in the morning, and that is a real thing to want; it is not free, and a
design that pretends otherwise will be surprising on the bill.

### 3. The summons calls the cell — last, and only after the argument

Zero idle cost, which is what a cell is *for*. It needs the withdrawn address
hook reopened, and the review questions that killed it answered rather than
routed around: what sets the address, what "the session ends" means, and who is
executing as whom.

Worth doing eventually. Not worth doing first, and not worth doing quietly.

## The plumbing already exists on both sides

| What it needs | What already provides it |
| --- | --- |
| What every sheep on this repo should know | **`pasture`** — *"the place a dog puts what every sheep on a repository should know"*: a read-only tree mounted at `/pasture`, a repository cloned at birth, secrets the setup reads |
| Somewhere to run `isocan` | **`pen`**'s container — node, pnpm, git and tests over a checkout synced from the workspace rows |
| Reaching a home with no daemon | **`ISOCAN_DIRECT=<url>`**, proved in two CLI suites here |
| The command itself | `npx github:dglazkov/sheep#release setup`, and `npx github:dglazkov/isocan#release setup` inside the sheep |

So the work is not mechanism. It is an identity, a brief, and a decision about
cost.

## The one decision that unlocks all three

**Measured and DECIDED 15 Sep 2026 — this case is unblocked** — see [the bearer
is mostly built](2026-09-15-the-bearer-is-mostly-built.md). `askTheDoor()`
mints with `carrier: "bearer"` on the CLI's ordinary path, and `isocan badges
--kill` already ends one at the home, so the question below was smaller than
this paragraph makes it sound. Dion's answer: a cell may hold a long-lived
bearer badge in its owner's own secrets store, claiming a DEDICATED AGENT's
actor and never the person's own, admitted only where that agent is enrolled.
The worst case is then the blast radius `agent-custody` already built its fence
around. Shape 2 and shape 3 below both proceed on that basis.

**A sheep needs a badge at the isocan door**, and it is the same question as
#206 phase 7's `ISOCAN_BEARER`: a long-lived credential that can write to a
canvas from anywhere, living somewhere until somebody revokes it. The door
judges badge-less `/api/` requests and exempts a `bearer`, so the shape is
settled; what is not settled is the blast radius.

Decide it once and both land. Deciding it differently in two places is how a
credential ends up in two settings pages with two revocation stories.

## Two things to hold onto

**The canvas is the only channel.** The `isocan-collab` skill's one rule, and
it bites here specifically: a sheep's own surface is `sheep attach` and pi's
terminal, which is not somewhere Dion reads. Everything a standing sheep says
has to be an `isocan` comment, or it is said to nobody.

**`herd` would mean three things.** herdr herds machines; a sheepdog herds
sheep; and a sheep standing on a canvas would be herded by an rc. One metaphor,
three layers. This codebase has paid for a word meaning two things twice in a
week — `archive` when the shelf wanted it, and a `fold.test.ts` overwritten by
a second feature that also called itself folding. Whatever bridges these two
projects needs its own word on the first day, not the day after.

## Decisions

**D1. Custody is about who started it and whose credentials it uses, not which
machine it runs on.** A sheep the person started, running as itself, listed and
killable, does not violate on-demand's principle.

**D2. Personas first.** The only use with no unresolved principle and a gap
that exists today. It is also #205's phase 1, on a machine that is not a
laptop.

**D3. `ISOCAN_DIRECT`, not a daemon in a cell.** A sheep reaches the home the
way the CLI tests already do. Running a daemon inside a cell would put a
process that serves and stores every canvas somewhere nobody can see it.

**D4. Say the cost of parking.** Shape 2 gives up the cell's zero-idle
property, deliberately, in exchange for an agent that answers overnight. Any
document that offers it must say so.

**D5. One credential decision, shared with #206 phase 7.** Same door, same
blast radius, same revocation story.

**D6. Everything a standing sheep says is an `isocan` comment.** Its terminal
goes nowhere a person reads.

**D7. A new word for the bridge**, chosen before anything is named.

**D8. A sheep shows up on the canvas.** Decided by Dion, 9 Sep 2026: *"I think
the sheep should show up... it's an agent that can do things."*

This was the note's own first open question, and the argument against was that
"a Cloudflare cell" is not a name anybody wants in the facepile. That argument
was about a NAME, and it answered a question about identity with an objection
about presentation — which is backwards. The test is the one the sentence
gives: a thing that can do things on this canvas is somebody you should be able
to see, address and stand down. Plumbing you cannot see is plumbing you cannot
stop.

So a sheep enrols like any other agent, wears a name a person chose, and its
being a cell rather than a laptop is an implementation detail nobody in the
facepile needs to read. What that leaves is not "should it appear" but "what is
it called", which is D7's question and was always the real one.

## Phases

1. **One persona in a sheep.** #205's dependency checker, `model: haiku`, tight
   tools, writing a page into `docs/reviews/` the way `persona-run.mjs` does.
   Proves the pasture, the credential and the write path in one go, with
   nothing standing anywhere.
2. ~~**The badge.**~~ **DONE — built by sheep-harness in September, found on
   15 Sep 2026 while looking for what to build next.** Not "mostly there":
   walked, and satisfying all four obligations the 15 Sep decision attached to
   its yes. `bornPassOf` (`packages/cli/src/main.ts`) mints a pass at the
   SHEEP'S BIRTH, scoped to that agent, and the cell redeems it — so the badge
   claims the agent's actor and never the person's. It is held on the rc row as
   `cellPass: {canvasId, passId}` (`packages/rc/src/rows.ts`), minted once
   rather than per wake, which is what the door's meter requires. `isocan
   badges` labels it **`cell (<agent>'s sheep)`** through `cellBadges()`, so a
   person can tell it from their laptop before ending one. And withdrawal ends
   it: *"the sheep is ended at its home (`endSheep`), then the badge its cell
   redeemed is ended at the isocan home"* — reached by `rc remove`, `agent
   remove`, a parked rc seeing the withdraw op, and a summons racing a
   withdrawal.

   The half of D5 that is NOT done is the one this phase bundled in: "the same
   decision written down for #206 phase 7". The 15 Sep decision deliberately
   split them, and a public repository's CI is still unanswered.
3. **A parked rc in a sheep**, on one canvas, with the cost measured rather
   than estimated: what a night of long-polling actually bills. **DONE (16 Sep
   2026) — by moving the room out of the container (`isocan#294`, `@sheep/collie`).**
   Parking `isocan rc` inside a container cell would keep the container awake
   24/7 and burn container minutes on idle HTTP long-polls. Instead, `collie`
   runs `runRoom(deps)` (`@isocan/rc`) inside a Cloudflare Durable Object beside
   the sheep station while the container cell sleeps at zero cost between turns,
   waking only when `collie` dispatches a turn (~16–40s warm, ~2m cold).

   **The measured overnight bill:**
   - **Idle / overnight long-polling (`collie` Durable Object holding `/api/rc/hold` + `/api/park` 24/7):** ~11,059 GB-seconds/day (128 MB memory tier × 86,400s) ≈ **$0.13 / night** ($4.00/month) at Cloudflare's list price ($12.50 / million GB-s), or **$0.00 incremental** inside the Cloudflare Workers Paid plan's included 400,000 GB-seconds monthly duration allowance. Container cells spend **0 container minutes** overnight while idle.
   - **Liveness across surfaces (`isocan#306`, `isocan#308`):** A replica daemon now queries the home's `/api/projects/:id/rc/answering` (`#306`), and `collie off` / `runRoom.stop()` calls `POST /api/rc/release` (`#308`) to drop the hold immediately rather than waiting up to 10s for `waitMs` to expire. With the laptop shut (`runsHere` empty), `isocan bench` reports `ready (<station>)` for the hosted sheep.
4. **The roster.** If (3) is worth it, `rc --all` across the enrolments, which
   is the shape that makes it a standing agent rather than one agent standing.
   **Now the first unbuilt phase.**
5. **Reopen the address hook**, or decide not to, with the three review
   questions answered.

## What this leaves open

- **What happens when the laptop comes back.** Two rcs parked for the same
   agent is the case `standing-agents` already handles — *"another park adopted
   Sian's cursor — standing down for it"* — and `collie off` + `POST /api/rc/release`
   (`#308`) now hands control back cleanly without a 10-second stale window.
- **Whether the cheap tier should write at all.** #205's D4 says a small
   persona may open a pull request only where a pre-existing guard would fail if
   the change were wrong. A sheep with a container and a git credential can do
   considerably more than write a page, and the gate should be decided before it
   can rather than after.
- **The bill (measured 16 Sep 2026).** Idle long-polling in `collie`'s Durable
   Object costs ~$0.13/night list ($0 incremental under the Workers Paid plan's
   included 400k GB-s allowance) and 0 container minutes; active turns bill only
   for the 16–40 seconds the container cell is awake.

---
status: designed
since: 2026-09-08
issue: 210
see: standing-agents, on-demand, personas, agent-custody
note: a standing agent's one structural weakness is that `isocan rc` is a process on a MACHINE, and a sheep is a session in a cell that is not. But the obvious join — the summons calling the cell's address — is a shape on-demand's design already withdrew on custody grounds, and the reconciliation is that custody is about who started it and whose credentials it uses, not which computer it is on. Start with personas as the cheap tier: no parking, no summons, no custody question, and a gap that is real today.
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

## Phases

1. **One persona in a sheep.** #205's dependency checker, `model: haiku`, tight
   tools, writing a page into `docs/reviews/` the way `persona-run.mjs` does.
   Proves the pasture, the credential and the write path in one go, with
   nothing standing anywhere.
2. **The badge.** D5 — minted once, held by the pasture, and the same decision
   written down for #206 phase 7.
3. **A parked rc in a sheep**, on one canvas, with the cost measured rather
   than estimated: what a night of long-polling actually bills.
4. **The roster.** If (3) is worth it, `rc --all` across the enrolments, which
   is the shape that makes it a standing agent rather than one agent standing.
5. **Reopen the address hook**, or decide not to, with the three review
   questions answered.

## What this leaves open

- **Whether a sheep should be an actor or a machine.** A parked rc answers *for*
  enrolled agents; it is not itself one. So does a sheep appear on the canvas
  at all, or is it invisible plumbing behind agents who do? The facepile says
  who is standing by, and "a Cloudflare cell" is not a name anybody wants to
  see there.
- **What happens when the laptop comes back.** Two rcs parked for the same
  agent is the case `standing-agents` already handles — *"another park adopted
  Sian's cursor — standing down for it"* — but it has never been exercised
  across two machines that both persist.
- **Whether the cheap tier should write at all.** #205's D4 says a small
  persona may open a pull request only where a pre-existing guard would fail if
  the change were wrong. A sheep with a container and a git credential can do
  considerably more than write a page, and the gate should be decided before it
  can rather than after.
- **The bill.** Nothing here has a number. Phase 3 exists to get one.

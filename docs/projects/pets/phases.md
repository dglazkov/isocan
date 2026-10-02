---
status: built
since: 2026-10-01
see: bench, standing-agents
note: "the walk: the rc hears invites, then pets that follow."
---

# Pets — the walk

**1 October 2026.** Held to [journey.md](journey.md); the ancestor is
[the sheepdog note](../../research/2026-09-04-sheepdog.md), the machinery is
the [bench](../bench/phases.md).

**Where we are, 1 Oct 2026: both phases are CLOSED — a running rc hears invites, and pets follow. What is left is the Open roster below.**

Two rules for every phase, on top of `AGENTS.md`:

- **No new op type.** `agent.invite`, `item.update` on a bench row, and the
  rc's own records. A phase that seems to need an op stops and says so.
- **Walked, not asserted.** Phase 1 ends with an rc test that invites an agent
  to a canvas the running rc never parked on and watches it start answering;
  phase 2 ends with a journey in `scripts/journeys.mjs`.

## Phase 1 — The rc hears invites

**Status: CLOSED, 1 October 2026.** A running `rc --all` invited onto a canvas it never parked on answers the owner's summons there within its 30 s look, with no restart, on the agent's own harness — proved against a real daemon and the spawned CLI, and the test fails with the look slowed to ten minutes.

**Outcome:** a running `isocan rc --all` periodically (and on the home's
roster change where it can see one) lists the canvases this machine can
reach and finds those where one of its agents — an actor it holds — is
enrolled or invited but no room is parked; it opens a room there and records
it in `rc-agents.json`, announcing *answering on "…"* the way startup does. A
withdrawal closes the room. Bounded: one listing per interval, named and
reasoned. `isocan bench` then reads `ready` for the agent on that canvas.

**Proof:**

1. `npm test`, `npm run typecheck`; an rc test (real daemon, real CLI) that
   starts `rc --all` on canvas A, invites the same agent to canvas B with
   `bench join`, and sees a summons on B answered without a restart.
2. Scene 1, by the conductor, against a local home.

### Trajectory

- **2026-10-01** — A running `rc --all` looks every 30 s (`RC_DISCOVER_MS`, `rc-discover.ts`) for canvases where an actor it holds stands; it reads only canvases whose `updatedAt` moved, so a quiet home costs one listing a look. No new route, no op. Withdrawal now closes the room, as a restart would.
- **2026-10-01** — Every adopted row used to be written with `harness: null` and the rc's cwd, so an invited agent ran on the machine's default harness — pets would have multiplied it. A room now copies harness, model and cwd from the agent's row on another canvas (a named harness wins, then file order).
- **2026-10-01** — `bench join` said "answers on" beside a `ready` that meant an rc parked elsewhere; it now says "stands on" and names what makes it answer. The web's matching copy moves in phase 2.

## Phase 2 — Pets follow

**Status: CLOSED, 1 October 2026.** A following agent joins the canvases its owner opens and can edit, with one line in the thread; it stays away from canvases it was removed from and from new ones once following is off — the `pet-follows` journey walked all of it in Chrome.

**Outcome:** a bench row carries `follows` (on/off, default off), set by
`isocan bench follow <name> [--off]` and a *Follows me* switch on the agent's
bench row in the web; `isocan bench` shows it. When the person arrives on a
canvas (after the snapshot, once per arrival) and can edit it, the web sends
`agent.invite` for each following agent not already on the canvas and never
withdrawn from it, then posts one thread line (*Scout came with Dion*), the
way `@Name join` does. View-only canvases and withdrawn agents are skipped in
silence. The agent guide and README say all of it.

**Proof:**

1. `npm test`, `npm run typecheck`; core tests of the follow decision (edit
   vs view, already there, withdrawn, off); CLI test of `bench follow`.
2. A journey `pet-follows`: mark an agent as following, open a second canvas,
   assert the roster gains it and the thread says so; reopen (no second
   line); turn it off, open a third canvas, assert it does not come.

### Trajectory

- **2026-10-01** — Withdrawal deleted the roster row and left no trace, so "never withdrawn from here" could not be read. The canvas now keeps `withdrawn` (actor → who withdrew), written by `agent.withdraw`, saved by all three stores like `groupCohorts`, read only by `petsToBring`. Withdrawals before today are not recorded.
- **2026-10-01** — A cached canvas reads `edit` until its snapshot lands, so `bringPets` waits for the live connection before deciding anything — otherwise a read-only canvas could be sent an invite from a stale capability.
- **2026-10-01** — The arrival rides the existing lazy `benchjoin` chunk and the switch is a hook, not a component: each new chunk or component put bytes in the entry. The chunk ends 15 under the ceiling, so the next eager change must pay its own way.
- **2026-10-01** — Open: the read-only case is proved in core and by the live-snapshot wait, not walked in a browser (it needs a second identity).
- **2026-10-01** — Open: the cloud store's `withdrawn` persistence runs under the Firestore emulator, which this machine cannot (no Java); CI's `test:ci` is its first run.

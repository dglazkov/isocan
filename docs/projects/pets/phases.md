---
status: designed
since: 2026-10-01
see: bench, standing-agents
note: "the walk: the rc hears invites, then pets that follow."
---

# Pets — the walk

**1 October 2026.** Held to [journey.md](journey.md); the ancestor is
[the sheepdog note](../../research/2026-09-04-sheepdog.md), the machinery is
the [bench](../bench/phases.md).

**Where we are, 1 Oct 2026: nothing built. Next: pets phase 1, the rc hears invites.**

Two rules for every phase, on top of `AGENTS.md`:

- **No new op type.** `agent.invite`, `item.update` on a bench row, and the
  rc's own records. A phase that seems to need an op stops and says so.
- **Walked, not asserted.** Phase 1 ends with an rc test that invites an agent
  to a canvas the running rc never parked on and watches it start answering;
  phase 2 ends with a journey in `scripts/journeys.mjs`.

## Phase 1 — The rc hears invites

**Status: NOT STARTED.**

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

## Phase 2 — Pets follow

**Status: NOT STARTED.**

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

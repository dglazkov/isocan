# Durable agents — the walk

[`journey.md`](journey.md) is the ideal and [`design.md`](design.md) the
mechanism. Each phase ends with something a person can do and undo.

**Ordered by what could kill it soonest.** First whether Pi Durable is
what the sample says, and what a turn costs in time and money, because
sheep's lesson is that the numbers decide. Then the harness, then the
critic that proves the dollar cap, then the runner in the cloud, which
waits on a decision.

**Phase citations name their project**: `durable-agents phase 1`.

**Where we are, 17 Oct 2026:** specified; nothing built. Phase 0 is next,
and needs a Cloudflare account and a model key of Dion's (spend: a few
dollars of Workers and model).

---

## Phase 0 — The sample, measured

**Status: NOT STARTED.**

- Deploy Earendil's Pi Durable sample to a scratch Cloudflare account.
  Confirm every name `design.md` §1 takes from the post (`submit`,
  `whenBusy`, `watchEvents`, `configure`, replay-safe tools), and record the
  real ones.
- Give it one tool: read a canvas's snapshot from a scratch daemon's home
  with a pass-redeemed badge.
- **Proof:** cold turn (after hibernation), warm turn, and a follow-up
  queued mid-turn answered in order, timed against sheep's table in
  `design.md` §0; whether Pi reports usage in dollars; one page rendered by
  each of §4's two ways, with the time each took. If a cold turn is not
  under 15 s, say so and stop.

## Phase 1 — The `durable` harness

**Status: NOT STARTED.**

- The `RoomAdapter` of `design.md` §2 in packages/rc; `durable` in the
  harness scan; a Worker template in the repo and `isocan durable
  deploy|status|remove`; the badge handed over once and kept in the
  object; `rc remove` deletes the object.
- **Proof:** `isocan rc add Kit --harness durable` on a scratch canvas;
  three summonses from a parked rc answered as Kit, the same as a local
  harness's (status lines, reply, presence), one of them after
  hibernation; the badge is absent from every transcript and tool result
  (a test greps for it).

## Phase 2 — Critics on it, and the dollar cap

**Status: NOT STARTED.**

- The note-only tool set (`design.md` §3), the screen-seeing way chosen in
  phase 0, and `isocan critic add <pack> --harness durable`.
- **Proof:** Scene 1 and Scene 2 on a scratch canvas: two durable critics'
  pins and read match a local run's shape. A critic capped at $0.10 is
  cancelled at the cap mid-turn and says so. This closes **critique phase
  1**'s dollar cap if it is still owed.

## Phase 3 — A person's walk

**Status: NOT STARTED.**

- A `docs/verify/` walk: a critique with durable critics in the browser,
  timed and costed by a person, with the laptop running only the rc.

## Phase 4 — The runner in the cloud

**Status: NOT STARTED.** Gated: no code before the custody decision in
`design.md` §6 is recorded in [`decisions.md`](../../decisions.md).

- The home's push of a summons to the agent's object, or a measured case
  for holding the watch route open instead; `isocan rc --cloud`, `rc ls`,
  `rc stop`; the home refusing a runner that has been stopped.
- **Proof:** Scene 3: a mention overnight with the laptop closed, answered;
  the runner listed and ended from the CLI; a week's Workers bill read
  before and after.

---
status: partial
since: 2026-09-01
see: standing-agents, on-demand, agent-custody
note: phase 1 built 1 Sep — one name on one machine stands on many canvases (the enrolment key is the name; the summons carries its canvas). The rc that parks on every canvas its rows name, `available` in the web roster, and `isocan history` are not built.
---
# Standing agents

One agent, one name, watching several canvases, woken into the one that
wants it. Opened from
[`research/2026-08-30-standing-agents.md`](../../research/2026-08-30-standing-agents.md),
which asked the question in four parts and found that the hinge — the
wake — did not exist. [on-demand](../on-demand/design.md) built the wake on
30 Aug: `isocan rc` parks, an op arrives, a session starts. This project
is what was left once the hinge was real, and it turned out to be smaller
and differently ordered than the research guessed.

**The rule this project inherits and does not touch**, in the research's
words: *what runs is configured locally and only locally; what arrives
from the canvas is the signal, never the command.* The rc is that split
made literal — the canvas holds the **offer** (`agent.enroll`, an op
everyone can read), the machine holds the **wiring** (`rc-agents.json`:
directory, harness, session handle, never replicated). Nothing below
moves anything from one side to the other.

## The debt, read from the code

The rc was one canvas wide, three times over:

1. Bare `isocan rc` takes the directory's binding; `resolveCanvas` is
   called once and `p.id` is threaded through seven hundred lines.
2. Every enrolment was keyed `agent:<canvasId>:<name>` on the machine
   badge. Enrolling Percy on a second canvas from the same machine was
   therefore a **second session key on the same badge asking for a name
   already worn** — refused by the desk's name rule (`requireFree`), and
   had that passed, every later rebind would have met `otherSession` for
   thirty minutes, which is [#89](https://github.com/dglazkov/isocan/issues/89)
   in another coat. The desk was right both times; the key was wrong.
3. A summons handed the agent no canvas. The adapter's shells resolved the
   canvas from the working directory's binding, so an agent enrolled from
   one directory on two canvases would have replied to the wrong one.

The research's recommended order began with `isocan history` because,
when it was written, nothing could be woken and a cross-canvas fold was
the only thing buildable. With the wake built, the first thing that
actually blocked a standing agent was identity, so it went first.

## Mechanism 1 — the enrolment key is the name *(built)*

`agent:<name>`, on the machine badge, with no canvas in it. The same key
presented on any canvas resumes the same actor — `applyClaim`'s `mine`
path, the ordinary resumption every session identity already gets — so
`isocan rc add --canvas <ref> <name>` on a second canvas hands the one
Percy back: no `as`, no vouch, and the name rule is never consulted
because the key is already this badge's own. What the desk sees is one
badge, one key, one actor, which is precisely what it has always allowed.

What this decides: an agent's identity on a machine is **per name, not
per (canvas, name)**. Two different Percys on one machine is no longer
expressible — and was never meant to be: that is the "one actor wearing
two faces" the desk forbids, wearing a canvas id as a disguise. A second
machine answering as Percy still needs a vouch, which is right, and is
the many-canvases note's actor credential — a different project.

**Upgrade note, accepted rather than engineered around.** Rows claimed
under the old key shape stay in the desk. An rc that upgrades
mid-conversation rebinds under the new key with `as`, and can meet
`otherSession` if the old row was bound within thirty minutes (every
turn rebinds). Worst case: one turn refused for up to thirty minutes, the
rc narrates it and retries in sixty seconds, and the window closes
itself. The feature is two days old and has two users; a migration path
would outlive the problem.

## Mechanism 2 — the summons carries its canvas *(built)*

`ISOCAN_CANVAS=<id>` in the adapter's environment, beside
`ISOCAN_SESSION_ID=<name>`. The CLI reads it exactly as it reads
`--canvas`: after the flags, before the directory's binding. So a
standing agent's shells act on the canvas the summons is *for*, whatever
directory they run in — one enrolment directory can serve many canvases.

The `agent add` containment ("no `--canvas` — the agent you add lives
where you already are") reads the **flags alone**. A summons's
environment is where the agent was put, not a pointer it chose; refusing
it would refuse every summons on a second canvas.

## Mechanism 3 — the rc parks everywhere its rows name *(not built)*

Dispatch state keyed by `(canvasId, actorId)` rather than by actor; one
`watchLog` lap with a cursor per canvas — the transport already takes a
record of cursors and an `only` list, so the lap loop changes shape but
not vocabulary; one hold per canvas, because `RcHoldRequest` is per
canvas and the home's answerability is too; narration prefixed by the
canvas title once there is more than one. Bare `isocan rc` in a bound
directory keeps meaning that canvas. The spelling for "every canvas this
machine answers for" is a door decision (phase 2).

Why it waits: the bare rc action is the one place the wake lives, the
refactor is mechanical but wide, and it should be walked against a real
two-canvas day rather than a fixture.

## Mechanism 4 — `available` *(not built)*

The roster state three notes reached for independently. `isocan who`
already tells `answerable` from `running` from `enrolled` (on-demand
phase 6, connection-bound). What is missing is the **web** facepile
treating an answerable agent as a third thing that looks different from
*here*. The research's warning is the whole spec: `available` that looks
like `here` makes presence dishonest, and presence being honest is one of
the few things this product has that others do not.

## Mechanism 5 — `isocan history <actor>` *(not built)*

The cross-canvas fold over what is already in the logs; the research's
first recommendation, and still worth building — it is what tells you
whether standing agents are earning their keep. No new state: a second
copy of the history would go stale in one place.

## What would make this fail

- **Two keys for one name.** Anything that re-introduces a canvas into
  the enrolment key brings the name-rule refusal back with it.
- **A summons that trusts the directory.** `ISOCAN_CANVAS` must win
  over the binding, or the second canvas's reply lands on the first.
- **`available` that looks like `here`.** See mechanism 4.
- **A wake with no backoff.** The rc's ceiling (twelve turns an hour) and
  cycle guard (three agent-to-agent turns) are per agent; parked on many
  canvases they must stay per agent, not become per canvas — or one Percy
  on six canvases is six times the budget nobody approved.

## Sources

- [`research/2026-08-30-standing-agents.md`](../../research/2026-08-30-standing-agents.md) — the four questions and the rule.
- [`research/2026-08-29-one-agent-many-canvases.md`](../../research/2026-08-29-one-agent-many-canvases.md) — the vouch gate, and why the cross-machine half is a credential.
- [on-demand](../on-demand/design.md) — the rc; [agent-custody](../agent-custody/design.md) — who answers for an enrolled agent.
- `packages/cli/src/acp.ts` (`enrolmentKey`, `adapterEnv`), `packages/cli/src/ctx.ts` (`canvasRefOf`), `packages/core/src/claims.ts` (`applyClaim`, `requireFree`, `otherSession`).

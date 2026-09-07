---
status: designed
since: 2026-09-07
issue: 205
see: personas, standing-agents, on-demand
note: the cheap tier #197 claims already exists does not — all nine personas are opus at xhigh. This is what a small persona would need: an idle trigger, a cost that is declared, permission to write where a guard already exists, and a registry of what to explore that is not the findings queue.
---

# Small personas: cheap agents, an idle trigger, and a registry of what to explore

**7 September 2026.** Research. Nothing built.

> "custom mini agent personas that small agents can take on… where you set the
> time and settings like 'when not active on the canvas'… for smaller
> models/agents to do useful work like a variety of performance work, a
> 'dependency checker' that watches for updated versions and runs the system
> with updated ones and has PRs… Sometimes you can DO the work, sometimes you
> can have the agents do research and add information to a registry for your
> main agent to check when it is asked 'What should I explore now?'"

## First, a correction to #197

`docs/research/2026-09-06-agents-you-can-trust.md` says, of the tiers:

> The nightly personas ARE the cheap tier.

**They are not.** All nine persona files declare `model: opus` and
`effort: xhigh`. There is one tier, it is the expensive one, and it runs nine
times a night. The handoff protocol #197 describes — cheap finds, expensive
decides — is a shape the files support and nothing uses.

That makes this request the missing half of #197 rather than a new direction,
and it is worth saying plainly because the note it corrects is a day old and
was written confidently.

## What already exists, and what it does not

**Exists:**

- A persona is a **markdown file with front matter** (`core/src/persona.ts`):
  `name`, `description`, `model`, `effort`, `tools`, `goal`, `runs`,
  `trigger`. Unknown keys are refused, so the format is a real contract.
- **Triggers** are `schedule` (cron), `push` (with `to` and `paths`), or
  `manual`.
- **A goal** is `(name, at most, measured by, baseline)`, and `measured by` is
  a command that prints one integer.
- **A queue that can fail** — findings sit `unanswered` and redden a commit
  after three days (`test/review-queue.test.ts`, #197 phase 3).
- **`isocan persona ls | show | runs`** — read-only.

**Does not exist:**

- **Any small model anywhere.** See above.
- **An idle trigger.** `readTrigger` knows cron, push and manual. "When not
  active on the canvas" is not expressible.
- **A way to make one.** No `isocan persona new`. A persona is a file you write
  by hand, which is fine for nine and wrong for the long tail this asks for.
- **Permission to write.** Every run reports `**Nothing was changed.**` — by
  design, and #197's D9 refuses cheap-tier code changes explicitly.
- **A registry of what to explore.** The reviews queue records what is *wrong*.
  Nothing records what might be *worth doing*.

## The four things a small persona needs

### 1. An idle trigger, which this app can actually answer

"When not active on the canvas" is a real trigger here and not in most systems,
because **isocan already knows who is present**. Presence is live, per canvas,
with a `lastSeen`, and `listeners()` already answers "is anybody parked".

So `trigger: { idle: 20m }` means: nobody has touched this canvas for twenty
minutes. That is checkable without inventing anything, and it is the trigger
that makes small agents polite — they work in the gaps rather than competing
for the machine while somebody is drawing.

**The subtlety worth writing down:** idle is per-canvas, and a persona that
reviews the *repository* is not on a canvas at all. Two different idlenesses —
"nobody is on this canvas" and "this machine is not busy" — and conflating them
would run a heavy dependency build while somebody is mid-sprint on an unrelated
canvas. The second is a machine fact (load, or simply "no rc turn in flight")
and is the one a repo-wide persona wants.

### 2. A declared cost, so "cheap" is a fact rather than an adjective

`model` and `effort` are already in the front matter and already honoured.
What is missing is that **nothing states what a persona may spend**, so "cheap
tier" is a description of intent rather than a bound — and this project's whole
method is that a bound nothing enforces is a comment.

The rc already has the machinery: `rcLimits` in `config.json` carries
`turnsPerHour` and `agentChain`, held **per agent**. A persona's budget belongs
in the same shape, not a second one.

### 3. Permission to write, where a guard already exists

#197's D9 refuses cheap-tier code changes, and states its own escape clause:

> The thing that would change the answer is a cheap tier whose changes arrive
> with guards that fail without them — at which point the review is reading a
> test, not a diff.

**The dependency checker is exactly that case, and it is the strongest argument
in the request.** A version bump's guard is the existing suite: the change is
mechanical, the verification already exists and is trusted, and the reviewer
reads a green run rather than a diff. The same is true of a lockfile refresh
and a formatter pass. It is *not* true of "a variety of performance work",
where the change is a judgement and the number moving does not prove the code
is right.

So the rule is not "cheap agents may write" or "may not" — it is:

> **A small persona may open a PR only where a pre-existing guard would fail if
> the change were wrong.** It never writes the guard it is judged by.

That is checkable at review time and it draws the line where the request's own
examples already fall on either side of it.

### 4. The registry, which is not the findings queue

This is the genuinely new artifact, and the distinction is worth being exact
about because the obvious move is to reuse the queue and it would be wrong:

| | The findings queue (exists) | The registry (asked for) |
| --- | --- | --- |
| Records | what **is wrong** | what **might be worth doing** |
| Item shape | number, bound, verdict | a thought, its evidence, its cost |
| Lifecycle | answered `accepted`/`rejected`, then dead | accumulates, is ranked, is consumed |
| Fails if ignored | yes — three days | **no, and it must not** |
| Read by | whoever answers findings | an agent asked *"what should I explore now?"* |

That last row is the important one. A queue that can fail is right for defects
and **wrong for ideas**: a backlog of explorations that reddens the build would
teach people to stop writing them down, which is the opposite of the point.

The registry's honest failure mode is going stale, and the guard for that is
not a test — it is that **entries carry the evidence and the date they were
found**, so a reader can see an idea is eighteen months old and priced from a
world that has moved.

**Where it lives:** `docs/research/` already holds thoughts, `ROADMAP.md` is
already derived from their front matter, and issues already hold work. The
registry should be *derived* the same way rather than a fifth place — probably
a generated index over short, dated entries with a cost and a confidence, the
same shape `reviews/README.md` has.

## Decisions

**D1. Small personas are the same file format.** `model: haiku`,
`effort: low`, a tighter `tools:` list. Nothing new to learn, and the format
already refuses unknown keys, so it will tell an author when they are wrong.

**D2. `trigger: { idle: … }`, and two idlenesses.** Per-canvas idle from
presence; machine idle for repo-wide work. Named separately from the start.

**D3. A persona declares what it may spend**, in the shape `rcLimits` already
uses. Cheap becomes a number.

**D4. A small persona may open a PR only where a pre-existing guard would fail
if the change were wrong**, and never writes that guard. Dependency bumps yes;
"performance work" no.

**D5. The registry is not the queue and must not fail a build.** Ideas that
redden a commit stop being written down.

**D6. `isocan persona new`.** Nine hand-written files is fine; the long tail
this asks for is not. Both surfaces, and the guide names it.

## Phases

1. **One small persona, by hand.** Pick the dependency checker, write it
   `model: haiku` with a tight tool list, on the existing cron. Learn what the
   format is missing before changing the format.
2. **The idle trigger**, per-canvas first, since presence already answers it.
3. **A declared budget**, in `rcLimits`' shape.
4. **The write rule** — D4, with the dependency checker as its first and
   narrowest case.
5. **The registry**, derived, with dates and evidence and no ability to fail a
   build.
6. **`isocan persona new`.**

Phase 1 first and deliberately unglamorous: **the cheap tier does not exist
yet, so everything else here is designing for a population of zero.** One real
small persona will say more about what the format needs than this note can.

## What this leaves open

- **Does a small model actually produce findings worth reading?** The whole
  design assumes yes and it is untested here. Phase 1 is partly an experiment,
  and it should be allowed to fail — a cheap tier that produces noise is worse
  than none, because somebody has to read it.
- **Who reviews the registry's entries for being wrong rather than stale?** A
  confident bad idea from a small model, sitting in a registry a larger one
  trusts, is a quiet way to steer a project.
- **Does an idle trigger fire on a laptop that is asleep?** Almost certainly
  not, and a persona that only runs when somebody happens to leave a machine on
  is not a schedule anybody can rely on.

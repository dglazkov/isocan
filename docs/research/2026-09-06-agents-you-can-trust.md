---
status: partial
since: 2026-09-06
issue: 197
see: standing-agents, on-demand, personas, evals
note: two halves of one question — whether an agent will actually answer (evidence with an age, and a receipt for every summons) and how a cheap tier and an expensive tier divide the work (findings, a queue that can fail, verdicts that become guards)
---

# Agents you can trust: liveness you can see, and tiers that hand off

**6 September 2026.** Research. **Phase 3 is built** (`test/review-queue.test.ts`);
the rest is designed and owed.

Two questions, asked together because they turn out to be the same question
asked at two scales:

1. *"It seems hard to know if an agent is actually around and able to wake and
   answer."*
2. *"Some agents are cheap and good at small tasks, others are expensive and
   good at planning. How do the small ones keep working and save their
   thinking, so a larger one can check in, validate, and be in charge?"*

The first is about trusting one agent for the next thirty seconds. The second
is about trusting a fleet of them overnight. **Both fail the same way, and this
project watched that failure happen on 6 September**: a thing that reports
healthy while doing nothing.

## Part one: what "around" currently means

More is built than the question suggests, and being precise about it decides
the work.

`lensStanding` and `roster()` already carry three states, ranked:

| state | what is true | what the app says |
| --- | --- | --- |
| `here` | a live session, on this canvas | "here now" |
| `answerable` | an rc holds a connection claiming this actor | "standing by — an rc answers here" |
| `enrolled` | a standing record; nobody listening | "enrolled — nobody is listening right now" |

And `answerable` is not a guess. `lib/answerable.ts` polls the daemon every
ten seconds for who an rc is actually answering for, shared across every
component on screen. The comment there records what it cost to get wrong:
before the hook existed, every standing agent read `enrolled`, so *"the app
told people nobody is listening while an agent sat ready to answer, and
`isocan who` on the same canvas said otherwise."*

So the model is right and the data is live. Four things are still missing, and
the fourth is the answer to the question as asked.

**The two states that matter look identical.** `AgentRow` draws `answerable`
and `enrolled` with the same hollow dot and the same `wb-row away enrolled`
class; the difference is a sub-line. The dot is what a person scans, so the
strongest fact ("a summons will land") and the weakest ("nobody home") read
the same at a glance.

**A promise with no latency.** "Answers if you comment" does not say whether
that is two seconds or five minutes, and that is exactly the difference
between asking an agent and doing it yourself.

**A held connection proves the plumbing, not the agent.** An rc can hold a
socket while wedged, out of budget, or pointed at a model that is down. The
hold is good evidence and it is evidence about the pipe.

**Nothing closes the loop after you ask.** This is the real question
underneath: *if I ask and nothing happens, will I find out?* Today the answer
is no — a comment naming an agent either produces a reply or produces silence,
and silence is indistinguishable from thinking.

### Why this is the same bug the day was spent on

On 6 September five hypotheses about a frozen browser died, and the common
thread in every one was an instrument reporting healthy while doing nothing:
a service worker cache that grew forever because its eviction keyed on a name
that never changed; six nightly reports that ran, passed, opened a pull
request and were never read; a bundle bound that was measured every night and
enforced never.

**A green dot that means "a connection is held" rather than "an agent will
answer" is that same bug, one level up.** It is worth naming because the fix
is the same in all of them: make the claim carry its evidence, and make
silence loud.

## Decisions, part one

**D1. Show evidence with an age, not a state.** "Standing by · heard from 8s
ago" is a categorically different claim from "standing by", and it degrades
honestly: at 8 seconds it reassures, at 4 minutes it warns without anybody
writing a warning. The poll already knows this number and throws it away.

**D2. Every summons gets a receipt.** Naming an agent in a comment should
produce a visible *asked Percy*, then either *Percy picked it up (4s)* or,
after a bounded wait, ***nothing answered — the rc is parked but did not
respond***. That last sentence is the whole feature: it converts a mystery
into a fact, and it is the only thing here that distinguishes "thinking" from
"broken".

**D3. Answerable and enrolled must not look alike.** A filled-but-hollow dot,
a dimmer name, something. The rule: *the difference a person acts on must be
visible without reading.*

**D4. Do not invent a heartbeat the rc does not already send.** The temptation
is a liveness ping proving the model behind the rc is healthy. Refused for
now: it doubles the protocol to answer a question the receipt (D2) answers
better, because a receipt tests the whole path — rc, dispatch, model, reply —
where a ping tests the first hop and reassures about the rest.

## Part two: the tiers

**The pattern already exists here, and 6 September demonstrated both halves of
it.**

The nightly personas ARE the cheap tier. Nine of them run on a cron, each
measuring a named number against a declared bound, each writing its thinking
to `docs/reviews/<date>-<persona>.md` as a table of findings. `lessons.md`
accumulates what they learned. The `unanswered` / `accepted` / `rejected`
column IS a handoff protocol to something more expensive.

And the failure was exact: **26 findings sat unanswered across six nights**
while the number one of them described went 600,420 → 768,993. Every report
was correct. Every report was written. Nothing made anybody read them, and the
reports piled up in unmerged pull requests where they were, functionally,
never written at all.

So the thing to build is not a new system. The schema is right; the
**escalation** is missing.

## Decisions, part two

**D5. Cheap agents produce findings, not prose.** A finding is *(number,
bound, verdict)* plus one sentence. That shape is what makes review cheap — an
expensive model reads twenty-six rows, not twenty-six essays — and the persona
format already enforces it. Anything a cheap tier wants to say that will not
fit that shape is a signal it is doing the wrong tier's work.

**D6. The queue must be able to fail.** `unanswered` was the right primitive
and it was ignorable, which made it decorative. The model to copy is the
bundle ratchet: *a number that can redden a commit*. A test asserting **no
finding older than N days is unanswered** turns escalation from a hope into a
structural fact. This is the single highest-value item in this document.

**D7. The expensive tier's output is a verdict and a guard, never a
re-derivation.** Its job is to convert evidence into a judgement and then make
the judgement permanent. On 6 September `copied-rules` and
`undocumented-exports` were both answered by reading and deciding, and each
decision was written into the test that measures it — so it never needs
deciding again, and the next cheap run is cheaper.

**D8. Trigger the expensive tier by the queue, not the clock.** A nightly
expensive run is mostly waste; a run when five findings are unanswered, or a
bound breaks, is not. The queue depth is the signal.

**D9. Bound the cheap tier to work where being wrong is cheap AND visible.**
Measuring, counting, reporting: ideal. Landing code: refused for now. A cheap
model's change that an expensive model must review costs more than it saves,
unless it arrives with guards the cheap model also wrote and somebody trusts.
6 September's cheap-tier value was entirely in NOTICING; every fix needed the
reading.

**D10. Saved thinking must be addressable and de-duplicating.** A finding that
reappears is the signal that it needs a guard rather than a third mention —
`docs/reviews/README.md` already says exactly this, and on 6 September the
same finding was on its sixth appearance. The queue should be able to say
"this is the Nth time" without a person noticing it.

## The phases

Ordered by what unblocks the rest. Each is small enough to land on its own.

### Phase 1 — The summons receipt

**Work:** a comment naming an agent shows *asked <name>*, and resolves to
*picked up (Ns)* or *nothing answered*. The rc already answers the doorbell
(`RcAskRequest` / `RcAskResponse` carry an `askId`); this is that id followed
to its end and rendered.

**Outcome:** silence becomes a fact instead of a mystery. A person who asks
and gets nothing knows within seconds that nothing heard them, and knows it
was the rc rather than the agent thinking.

**Proof:** ask with an rc parked and a healthy agent — a receipt with a
duration. Ask with an rc parked and its agent killed — *nothing answered*
within the bound, not a spinner forever.

### Phase 2 — Evidence with an age ✅ built 7 Sep

**Work:** D1 and D3, in `lib/answerable.ts` and `AgentRow.tsx`. The poll keeps
`at`; the row reads *"answers if you comment · heard 8s ago"*; and answerable
gets a filled centre in its dot, so the two states stop being told apart by a
sub-line nobody scans.

**Outcome:** the claim carries its own evidence, and it degrades without
anybody writing a warning — at eight seconds it reassures, at four minutes the
number is the warning.

**Two things worth keeping.** The age is shown BESIDE the promise rather than
instead of it: a row that said only "heard 8s ago" would be a timestamp, and a
timestamp says nothing about whether a summons lands. And it re-renders on the
shared one-second tick, because a moment rendered once and never again is the
same overstatement in slower motion.

**Proof:** `packages/web/test/answerable.test.ts` — the poll keeps the moment,
the row shows it beside the claim, falls back to the bare promise before the
first answer lands, and the two states differ by more than words.

### Phase 3 — The queue can fail ✅ built 6 Sep

**Work:** D6, in `test/review-queue.test.ts`. **N is 3 days**, chosen against
the failure it exists to prevent: the pile sat for six nights, so a bound the
failure would have passed is not a bound. It lives beside the parser in
`scripts/reviews.mjs` as `ANSWER_DAYS`, and the report template and the index
both interpolate it — the number a page promises is the number the guard
enforces.

**A bound, not a ratchet** — the one place this differs from the bundle. That
was only possible because the queue had been drained to zero hours earlier; the
next time findings pile up, the same test could only be added at whatever the
pile happened to be. *A guard is cheapest to install at the moment the thing it
guards is already true*, which is worth carrying into phases 1 and 2.

**Outcome:** the escalation stops depending on somebody remembering.

**Proof:** mutation — a real finding was back-dated and marked unanswered, and
the suite reddened naming the file, the age and the words of the finding.

**And the mutation found a hole while proving it.** The first run of that
mutation *passed*. `unanswered` was matched exactly, so
`unanswered — the metric was retired` was a plainly-open row that neither the
index nor the guard could see: **an exact match on the OPEN state fails open.**
It now tests for the CLOSED state — answered means the cell begins `accepted`
or `rejected`, and everything else, a typo included, stays in the queue. This
is the generalisable half: *a guard against neglect must fail closed, because
the failure it guards against is nobody looking.*

### Phase 4 — Repetition is visible

**Work:** D10. `scripts/reviews.mjs` counts how many runs carry each finding
and says so in the index: *"this is the 6th time"*.

**Outcome:** a finding that keeps returning argues for its own guard without
anybody noticing the pattern by hand.

**Proof:** the index names a repeat count that matches the reports.

### Phase 5 — The expensive tier is triggered by the queue

**Work:** D8. The persona workflow, or a companion, escalates when the queue
is deep or a bound breaks — rather than on a second cron.

**Outcome:** expensive attention arrives when there is something to decide.

**Proof:** a run that fires on a seeded queue and does not fire on an empty
one.

## What this leaves open

- **Whether a receipt belongs in the thread or beside it.** A receipt in the
  thread is durable and visible to everybody; it is also noise on a canvas
  where agents are asked constantly. Phase 1 should try the thread and be
  willing to move it.
- **What the receipt's timeout is.** The other half of this — "older than N
  days" — was settled at 3 by phase 3, and `ANSWER_DAYS` is the shape the
  receipt's bound should copy: one exported number that the thing announcing it
  and the thing enforcing it both read.
- **Whether the cheap tier should ever write code.** D9 refuses it for now on
  cost grounds, not principle. The thing that would change the answer is a
  cheap tier whose changes arrive with guards that fail without them — at
  which point the review is reading a test, not a diff.
- **Budget as a first-class fact.** "Cheap" and "expensive" are currently
  facts about which binary somebody launched. If tiers become a real
  structure, the rc's ceiling and the cycle guard are where that belongs, and
  neither knows about money today.

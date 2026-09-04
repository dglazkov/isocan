---
status: partial
since: 2026-08-29
see: evals
note: stages 1 and 2 are built, and stage 1's hand-labelling was done 3 Sep — it corrected the 1 Sep headline (73% of the corpus was agents' own prose; people's asks were 95% answered) and found a sixteen-fold cancel bug; a calibrated classifier ships in `isocan evals corpus`. Stage 3's twenty golden tasks are in `evals/golden/v1/`, weighted by that distribution and self-testing in both directions. Stage 5's harness `scripts/lift.mjs` measured `/sprint` (same result, a third of the cost) and `isocan-collab` (same result, fewer turns) on 3 Sep. Stage 4's harness `scripts/calibrate.mjs` gave its first reading 4 Sep — 30 comparisons, 63% agreement, κ 0.26, and the finding that over half the pairs were an agent's choice, not a person's; the converge lane is built
---
# Evals

How we find out whether isocan is any good at the thing it exists for — and
then keep finding out, as the models, the skills and the product all move.

[`../../evals.md`](../../evals.md) is the reader's map of this: what runs
today, what the numbers said, and how a finding becomes a better skill or
prompt. This document is the staged plan and the record of what each stage
measured.

This is a plan in stages. Each one is useful on its own and none of them
requires the next, which is deliberate: eval programmes die when the first
deliverable is nine months out.

The order matters more than the contents. **Observe, then measure, then judge,
then intervene.** Most eval work fails by starting at "pick a metric", which
is a hypothesis nobody tested about work nobody characterised.

---

## Stage 0 — The substrate we already have

Before building anything: isocan records more evaluation signal, by accident,
than most products collect on purpose. This is the plan's whole advantage and
it is worth being precise about.

**The oplog is a complete, ordered, replayable record.** Every mutation is an
`Operation` applied by one pure reducer, so canvas state at any `seq` is
reconstructible exactly. That means a session can be *replayed* — the same
starting state, the same request, a different model or skill, and the outputs
are comparable because the setup was identical. Most eval harnesses spend their
first month building this. We have it as a consequence of the isomorphism.

**Undo is a labelled failure, already written down.** `LogEntry` carries
`cause: { kind: "undo" }` and `undoneBy`. An operation a human reversed is an
agent action a human rejected — implicit negative feedback, timestamped, with
the actor on both sides. Nobody has to be surveyed for it.

**Version stacks are revealed preference.** `/variation` produces N
alternatives; `item.setCurrentVersion` records which one won. That is
human-labelled comparison data — the expensive kind — generated as a byproduct
of ordinary use.

**Measured, 23 Aug 2026, and this document overstated it.** Across every
canvas in one home: 20 threads, 63 replies, **16 ops reversed by an undo**, 39
versions across 14 items — and **2** deliberate version choices and **1** parent
with more than one child. The plumbing is real and the mine is empty. The
preference-pair harvest is not a standing asset we are ignoring; it is an asset
that begins to exist the first time anybody reaches for `/variation`, which so
far nobody has. Stage 4's calibration problem is **not** already solved.

**Re-measured 1 Sep 2026 by `isocan evals`, across 21 canvases at the same
home.** 384 asks — **259 answered, 31 cancelled, 94 silent**. 116 of them
named somebody; the other 268 reached everybody through the Chat and are an
upper bound, because on a canvas with nobody enrolled an agent's own receipt
in the Chat has the same shape as a question. 16,050 ops attributed, **35
later undone**. **11 preference pairs**, up from 2 — real growth, and still
two orders of magnitude short of a calibration set.

The number worth looking at is **94 silent, one ask in four**. Nothing else
this repo measures can see it.

**And a bug the harvest found in passing.** The first version of this counted
0 undone across every canvas, because it read `LogEntry.undoneBy` — a field
the server derives in memory and **never writes to the log or sends over the
wire**. It is the silent-zero shape from lesson #2, in a report whose whole
job is to be believed. `undoneSeqs` in core now derives it from the log's own
undo entries, `chooseRetained` in `gc.ts` uses the same fold instead of its
own copy of those four lines, and the corrected count reproduced this
document's hand-measured 16 exactly on the canvas it was taken from.

That has a product consequence worth naming: nothing generates preference pairs
until divergence is something people actually use, and divergence is not worth
using while [convergence](../atlas/convergence.md) is missing. The op is on the
critical path for the eval programme, not only for the canvas.

**Comments are the request corpus.** What people ask agents for, in their own
words, timestamped, with `@mentions` naming who was asked.

~~`onThread` is the join key the whole programme depends on.~~ **Wrong, and
corrected 1 Sep 2026 when Stage 1 was built against it.** `onThread` lives on
`SessionState`, which is the presence plane — `http.ts:2150` marks it
*ephemeral — no oplog, no storage*, and the agent guide promises agents the
same thing: claiming a thread "costs no op, leaves no trace in the history,
and vanishes when you stop." Nothing about who was answering what survives the
session that said it, so it cannot join anything after the fact.

The join that does exist is three weaker ones, and `evals.ts` labels which of
them produced every row: `anchor` (the thread is pinned to the item),
`reference` (the ask or its answer named it — `comment.items`, recorded at
authoring time), and `window` (the agent that was asked acted before anybody
spoke again). The first two are facts. **The third is a guess, and it is
labelled rather than dropped** — dropping it would report zero for most asks,
and folding it in unlabelled would make a guess indistinguishable from a
measurement. Measured over this home: 15,199 of 16,050 attributed ops came
from `anchor` or `reference`, so the guess is the small half.

**Outputs are files.** A screen is HTML and CSS on disk, not a chat message.
That is what makes Stage 2 possible at all.

**Nothing leaves the machine.** The daemon binds to 127.0.0.1. Every stage
below is local by default, and Stage 5 is where sharing becomes a choice
somebody makes rather than a default they discover.

---

## Stage 1 — Descriptive science: what are people actually asking?

**The mistake to avoid:** picking metrics first. A metric is a hypothesis about
what matters, and we have not yet observed what people do.

So the first stage produces no scores. It produces a **taxonomy of asks**,
built from real comments, with frequencies.

1. **Export the corpus.** Every comment addressed to an agent, with the ops
   that followed it on the same thread, and whether the thread ended in an
   answer, a `/cancel`, or silence. This is a report over the oplog — a new
   read path, no new writes.
2. **Hand-label a sample.** Two hundred asks, labelled by a person, into
   categories that emerge from the data rather than categories we brought.
   Expect surprises; the categories we would guess ("make me a screen") are
   probably not the ones that dominate.
3. **Then classify the rest**, with the hand labels as the calibration set —
   and report classifier agreement, not just output.
4. **Publish the distribution.** What fraction of asks are creation vs
   critique vs repair vs search vs orchestration? Which get cancelled? Which
   get redone? Where does the same person ask twice because the first answer
   missed?

**Deliverable:** a written distribution with the hypotheses it suggests, in
`docs/research/`. The hypotheses are the input to Stage 2, and until we have
them, every task suite is a guess about our own users.

**Success looks like** being able to finish this sentence with a number: "the
most common thing anybody asks an agent on a canvas is ___, and it is ___% of
all asks."

### Built, 3 September 2026 — the labelling, and what it corrected

Finished: *the most common thing anybody asks an agent on a canvas is to
change something that already exists — 21% — and edits of every kind are
39%, twice the 18% that ask for something new.* Every row at one home (414)
was read and labelled by hand; 304 were agents' own prose, 12 were probes,
and the 98 asks people made are the distribution in
[`research/2026-09-03-what-people-ask-agents-for.md`](../../research/2026-09-03-what-people-ask-agents-for.md):
revise, create, orchestrate, question, arrange, social, restyle, document,
critique, repair, variation, converge, ops, cancel.

Steps 3 and 4 of this stage as written: `categoriseAsk` in `core/evals.ts`
classifies the rest and agrees with the hand labels on 84%; it ships in
`isocan evals corpus` labelled as a reading, with the number. The
distribution and the hypotheses it suggests for Stage 2 are in the note.

**What the reading found that the report could not.** The 1 Sep headline —
one ask in four silent — was agents' receipts nobody replied to; people's
asks were 95% answered. And `buildCorpus` scored a `/cancel` against every
earlier ask by that person in the thread, which in the Chat is all of them:
16 cancels on one canvas were one. Fixed, with a test from the measured
shape. The Stage 0 note that broadcast is an upper bound was true and did
not help; a caveat on a number is not a correction to it.

---

## Stage 2 — Deterministic graders, before any judge

This is isocan's unfair advantage and it should be spent early.

Most eval programmes reach for an LLM judge immediately, because their outputs
are prose and prose resists measurement. Ours are not. A screen has a contrast
ratio, a spacing scale, a token set, a DOM you can query, and a build that
either succeeds or does not. **Measure everything measurable before asking a
model's opinion about anything.**

We already own most of the graders:

| Grader | Lives in | Answers |
| --- | --- | --- |
| Contrast | `packages/core/src/contrast.ts` | Does every text element pass 4.5:1 against what is actually painted behind it, in both themes? |
| Design-system conformance | `designcheck.ts`, `designmd.ts` | Are the values in the declared scale, or invented? |
| Tokens | `tokens.ts` | Literals where a token exists? |
| The tells | `slop.ts` | 23 checkable moves a generated interface reaches for, visual and copy alike |

Add, in rough order of value:

- **Does it render at all** — a build that fails is a zero and should be scored
  as one, not thrown out as an error.
- **Accessibility beyond contrast** — focus order, accessible names, target
  size. All mechanical, all currently unmeasured. The first design review found
  a focus ring failing SC 1.4.11 that nobody had noticed for weeks.
- **Responsive integrity** — no sideways scroll at 390, 768, 1440; nothing
  overflowing its container.
- **Aspect and asset integrity** — an image drawn to a ratio nobody chose is a
  defect a grader catches instantly and an eye misses. This has already shipped
  here once.
- **Isomorphism conformance**, for agent-authored features: did the change
  reach both surfaces?

**Why this ordering is the point:** a deterministic grader is reproducible,
costs nothing per run, cannot drift, and never needs calibrating. Every point
of quality it can score is a point a judge does not have to argue about. The
judges in Stage 4 should only ever be asked about what genuinely resists
measurement.

**Tooling note:** these are already vitest tests in shape and in culture. Write
them as tests. Do not adopt an eval framework at this stage — a framework
bought before there are twenty tasks is a dependency that arrives before its
job does.

### Built, 23 Aug 2026 — `scripts/grade.mjs`

Eight checks over a real screen, measured in a browser at 390/768/1440 and in
the source: renders, contrast against the actual painted background, stretched
images, sideways scroll, unnamed controls, target size, missing alt text, and
the handful of `slop.ts` rules that are a string match rather than a judgement.
It grades **files**, and reaches a canvas through `isocan get` — so it needs no
badge and measures the artifact somebody would actually receive.

It reports counts and pass/fail, deliberately **not** a weighted score. A
single number invites tuning the number, and each of these is independently
actionable.

**Wired to a schedule, 29 Aug 2026.** `scripts/grade-night.mjs` runs the
selftest as a GATE and then grades, filing a dated page in `docs/grades/` and
writing to no canvas; `.github/workflows/grade.yml` runs it nightly and opens
a pull request. `--canvases` points the same run at every HTML item in an
isocan home, which is the half no CI runner can reach.

**Run it against `--selftest` before believing it.** The first version of this
grader was theatre: the in-page probe carried a syntax error, and
`Runtime.evaluate` answers a malformed expression with `exceptionDetails`
rather than rejecting — so every reading came back `undefined`, every `?? []`
fell to empty, and a page with a stretched image scored 8/8. It was caught by
mutation-testing the grader against a bug we had actually shipped, not by
reading it.

The guard is now permanent: `test/fixtures/deliberately-bad.html` is a page
built to break all seven failable checks, and `--selftest` fails the run if any
check stays silent on it. **A grader that reports zeros when it breaks is worse
than no grader, because it is believed** — which is the same sentence as lesson
#2, arriving from a different direction on the same day.

---

## Stage 3 — Golden tasks, seeded from real failures

A task is: a **starting canvas** (a fixture, synthetic per the house rule), an
**ask** in natural language, and a **grader**.

Two sources, in this priority:

1. **The ask taxonomy from Stage 1**, weighted by real frequency. Tuning for
   what people actually do beats tuning for what is easy to score.
2. **Real failures.** The strongest guidance in the published work on skill
   evaluation is to build tasks from failures you have actually observed, and
   we keep a list: `docs/reviews/lessons.md` is a catalogue of things this
   codebase got wrong, each with its shape. Every lesson is a candidate task.

Because design is most of what happens here, the suite should be weighted
toward it — and toward the part that matters most: **design for software**.
A screen is not a poster. It has states (loading, empty, error), it has a
hierarchy that has to survive real content, it has copy that has to say what a
control does, and it has to be implementable. Tasks should include the
unglamorous ones: *make the empty state*, *make the error state say what
failed and what to do*, *make this work at 390px*, *make this match the design
system already on the canvas*.

**Version the suite.** A task suite that changes silently makes every
comparison across time meaningless.

### Built, 3 September 2026 — twenty tasks, `evals/golden/v1/`

Twenty tasks, weighted by the Stage 1 distribution rather than by what is
easy to score: six revise (one of them in the `orchestrate` shape — a bare
mention under a comment), five create (the empty state, the error state
that says what failed and what to do, a pricing screen and a checklist from
a shell that carries the design system, a greeting card), two restyle
(literals to tokens; a fixed-width dashboard made to work at 390), three
repair (contrast, a squashed photo, nameless toolbar buttons), and one each
of arrange, document (a README, in markdown), variation (three type
treatments) and converge (the best of two takes, as one screen).

Each is a synthetic fixture, an ask in plain words, and checks a machine can
make. `scripts/lib/golden.mjs` has the file checks — says / no longer says /
in this order / this element untouched / the same words rearranged / fewer
colour literals — and a task names which of `grade.mjs`'s screen checks it
wants (contrast, sideways scroll, named controls, target size, stretched
images) rather than re-deriving any. Counts and pass/fail; no score.

**The suite tests itself in both directions.** `scripts/golden.mjs
--selftest` requires every reference answer to pass every check and every
untouched fixture to fail at least one — a task whose fixture passes asks
for nothing, and a task whose answer fails asks for what its author could
not do. `test/golden.test.ts` runs the browser-free half of that on every
push, so a broken browser can never make the suite look like it measures
something it does not. `--task <id> --file <out>` grades one attempt;
`--dir <runs>` grades a directory of them, one file per task id — which is
the shape Stage 5's with-and-without runs will produce.

Not built: anything that runs an agent against the tasks. That is Stage 5,
and this suite is what it runs.

---

## Stage 4 — Autoraters, calibrated or not shipped

For what measurement cannot reach: hierarchy, whether the copy says anything,
whether a design is *good* rather than merely unembarrassing.

The discipline that separates a useful autorater from an expensive random
number generator:

- **Calibrate against human labels, and report the agreement.** A judge whose
  agreement with people has never been measured is a number with a decorative
  relationship to quality. Report it (Cohen's κ or similar), publish it beside
  every score the judge produces, and re-measure when the judge's model
  changes.
- **The human labels are already here.** The version stack records which
  alternative a person kept. That is a preference pair — chosen vs not-chosen,
  same ask, same starting state. Harvesting them costs a report, not a
  labelling budget. **This is the single highest-leverage thing in this
  document.**
- **A panel with distinct lenses beats one judge repeated.** The four review
  personas are already this shape: correctness, craft, structure, testability.
  A finding that survives three different lenses is worth more than one that
  survives the same lens three times.
- **Judges must cite.** The same bar `/design-audit` already holds: a finding
  names the selector, the value, the line. An autorater that returns a score
  and no evidence cannot be audited, and will not be believed the first time
  it disagrees with somebody.
- **Adversarial by default.** Ask the judge to refute rather than confirm.
  Default-to-fail on uncertainty.

### Built, 4 September 2026 — `scripts/calibrate.mjs`, and the first reading

The harness: `isocan evals pairs` per canvas, each kept version against each
it beat at that moment, the two files fetched with `isocan get --rev` and
shown to `claude -p` (Read only) as A and B in a shuffled order, asked to
argue against each before picking and to cite; agreement reported with
κ = 2·agreement − 1, because the shuffle makes chance a coin; a page in
`docs/calibration/` either way, dry or not, and nothing written to any
canvas. `test/calibrate.test.ts` pins the discipline.

**The first reading** ([page](../../calibration/2026-09-04.md)): 27
canvases, 12 pairs, 30 comparisons, **12/19 answered agreed (63%, κ 0.26
± 0.23), $11.77**. A first reading, not a calibration — and what it taught
matters more than the number. **Sixteen of the thirty comparisons were an
agent's choice, not a person's**: *Admiral One* keeping its own earlier take
while it worked. The harvest could not tell whose hand it was; now
`PreferencePair` carries `chosenById`, `isocan evals pairs` asks the
registry and says *(an agent)*, and the harness reads people only unless
`--include-agents`. With a caveat the run also found: the registry knows
an agent by the harness its claim came through, and an agent that drives
the CLI as itself wears a person's harness — Admiral One reads as a person.
`--exclude <actor>` names such a chooser on the page; a claim that says
which kind of hand holds the CLI is the standing-agents project's to add.
Several pairs were the same bytes, or differed by one line of quotation
marks — a coin flip at forty cents; a pair whose versions share a blob hash
is skipped now. Eleven comparisons got no answer, probably the largest
screens against an eight-turn judge; the page's run column will say next
time. Among a person's choices the judge answered, it agreed 7 of 9.

What this leaves: the calibration set is smaller than the eleven pairs the
1 September count suggested, because that count did not ask who chose.
Nothing generates human pairs until people reach for `/variation` and keep
one; the harness is ready for when they do, and a judge over screenshots
rather than source is the next thing to try, for cost and for fidelity to
what the person saw.

---

## Stage 5 — Skill evals: lift, not vibes

Skills are a first-class product surface here — `isocan command add --from` puts
a stranger's instructions in front of every future agent on the canvas — so
"is this skill any good" is a **user-facing question**, not just internal QA.
That is unusual, and it is an opportunity: we could be the product that tells
you whether the skill you just installed actually helps.

Three separate questions, commonly confused:

1. **Does it fire?** (*discoverability*) A skill that never triggers is worse
   than no skill, because it is believed to be working. Measure trigger rate
   against tasks it should fire on, and against tasks it should not.
2. **Does it help?** (*lift*) Run the same task with and without the skill, same
   fixture, same model, everything else held. The delta is the skill's value.
   This is the number that matters and it is the one nobody reports.
3. **What does it cost?** (*efficiency*) Tokens and turns. A skill with +3%
   quality and +80% cost is a bad trade that a quality-only score hides.

Report all three per skill, and re-run when the skill or the model changes. A
skill's lift is not a property of the skill alone.

### Built, 3 September 2026 — `scripts/lift.mjs`, and the first two readings

The harness holds everything equal but the skill: the same golden fixture
placed as an item on a fresh scratch canvas, the same ask posted as a comment
on it, the same prompt, model, tools (`Read`, `Write`, `Edit`, `Glob`,
`Grep`, `Bash` limited to `isocan …`) and turn budget, in a temp directory
bound to the canvas. For `isocan-collab` the treatment is the skill's
SKILL.md on the system prompt; for `sprint` it is the `/sprint` command's own
text against a plain sentence asking for the same thing. It grades what
reached the canvas with `golden.mjs`, records the model from the run's own
report, prints the three numbers side by side, and deletes the canvases.
Pages in `docs/lift/`.

**`/sprint`, one run each** ([page](../../lift/2026-09-03-sprint.md)). Both
conditions laid the board — eleven sheets, nine phases named, a brief. The
skill's lift is entirely cost: **10 turns, $0.36, 47 s, finished** against
**26 turns, $1.11, 169 s, out of turns**. Without the command's text the
agent found `isocan sprint board` by reading `--help` and got there; with it,
it went straight there. For a facilitation skill that is the right shape of
lift — the method is in the CLI, the skill is knowing to reach for it.

**`isocan-collab`, four golden tasks each way**
([page](../../lift/2026-09-03-isocan-collab.md)). *Fires:* 4/4 both — every
run landed a new version and replied, because the prompt names the canvas
and the item, and an agent told that much finds `isocan` unaided. *Helps:*
3/4 both; the same task failed both ways, and its two failures were the
task's fault (below). *Costs:* the skill saved turns — **17.8 against 21.8
on average** — and a little money, and lost time to one run that hit the
turn budget while checking its own work. On tasks this small, with a prompt
this specific, the collab skill's measurable value is a shorter lap, not a
better result. The reading that follows: **the skill earns its keep where
the prompt does not already say where the work is** — the standing agent
woken by a bare mention — and that is the fixture the next run needs, not a
better version of this one.

**Two things the first run taught the harness.**

- *The treatment ended differently from the control.* The collab skill's lap
  ends by parking on `isocan wait`; in a one-shot run the agent landed its
  work at minute two and waited out the whole fifteen-minute budget. Both
  conditions are now told it is a one-shot job. A control that ends one way
  and a treatment that ends another is a difference that is not the skill.
- *A check may only ask for what the ask asked for.* `create-empty-state`
  demanded a `[data-state=empty]` hook and an untouched header; two agents
  built a sound empty state — one disabled Filter, one removed it — and
  failed both. The suite is v2 for it, and `tasks.json` says why.

Not built: the trigger-rate half of *does it fire* — tasks the skill should
NOT fire on. And every number above is one run; a lift worth acting on is a
delta that survives three.

**Later the same day, blind, three runs per cell**
([page](../../lift/2026-09-03-isocan-collab-blind.md)). `lift.mjs --blind
--runs 3`: the prompt no longer names the canvas or the item — *something
on the canvas this directory belongs to needs you; find out what* — and
every cell ran three times. Two tasks, twelve runs. *Fires:* 6/6 both ways
again. Even blind, an agent with no skill finds the comment: the directory
is bound, `isocan --agent-help` is in the tool, and the tool is enough. So
the collab skill's discoverability value is nil on a machine where isocan
is installed, and that is a finding about the CLI, not a failure of the
skill. *Helps:* 6/6 both. *Costs:* **14.7 turns with the skill against
23.2 without**, every one of the six pairs in the same direction (14–16
against 21–26), and one skill-less run out of turns before it replied. The
dollars are the same because the skill's turns are longer. The delta that
survived three is the lap: the skill teaches the shape of a turn — read,
act, reply, stop — and an agent without it rediscovers that shape each
time, at a cost of eight or nine turns.

Read for the product: the thing to ship is not the skill's discoverability
but its lap, and the lap could live in `--agent-help` itself, where every
agent already reads it.

Two isocan-specific opportunities:

- **`/skill find` could report lift**, not just stars and licence. "This one
  measurably improves design audits on your canvas" is a recommendation no
  registry can make.
- **Skills authored *in* a project** — the thing we want to support — get the
  same treatment. `/skill new` should end by proposing the eval task that
  proves it does something, because a skill with no eval is a claim.

---

## Stage 6 — The loop: what we log, and what we never do

Everything above works on one machine with no telemetry at all. That is the
default and it should stay the default.

**What is worth learning from users, in order:**

1. **Ask taxonomy labels** — the *category* of what was asked, never the text.
2. **Outcome** — answered, cancelled, undone, redone, replaced by a version.
   `undoneBy` is already in the log.
3. **Which skills fired, and whether the result survived.**
4. **Deterministic grader scores** on agent-authored artifacts — numbers, not
   the artifact.

**What never leaves, on any setting:** canvas content, comment text, filenames,
titles, screenshots, blobs. Those are the user's work and their client's work.
The taxonomy label is the *point* of Stage 1 precisely because it is the
useful part with the content removed.

**How:**

- **Opt in, per home, with a plain sentence** saying what is sent and a command
  that prints exactly what would be sent. `isocan telemetry --dry-run` should
  print the payload. Nobody should have to trust a description.
- **Aggregate before sending**, not after. Counts and distributions, batched.
- **Local first**: the same report that would be sent is available as a
  `isocan evals report` anybody can run on their own data and keep. If it is
  only useful to us, it is telemetry; if it is useful to them, it is a feature.
- **Say what it bought.** Publish what the data changed. Telemetry that never
  visibly improves anything is a tax people eventually turn off.

---

## Stage 7 — Continuous, or it decays

Once Stages 2–4 exist, the suite runs like any other test: on a schedule, and
against every change to a prompt, a skill, or the design system. The changelog
workflow is the pattern to copy — a scheduled job that writes its findings into
the repo as a dated page and opens a PR.

Track **drift** as a first-class result. The interesting number is rarely the
absolute score; it is the score moving when nobody meant to move it. A model
update, a skill edit, a token change — each should produce a visible delta, and
an unexplained delta is a finding.

---

## On tooling

The landscape as of 2026, and the honest recommendation.

- **Promptfoo** — YAML-first, widely used, and **acquired by OpenAI in March
  2026**. For a product whose whole position is bring-your-own-agent, taking a
  hard dependency on a model vendor's eval tool is a strategic tie worth
  thinking about before it is worth adopting.
- **DeepEval** — pytest-native, 50+ metrics, agent-specific ones (task
  completion, tool correctness, step efficiency). The pytest shape is the
  closest fit to how this repo already thinks.
- **Inspect AI** — task-decorator style, model-agnostic, from a public-interest
  body rather than a vendor. The most neutral option, which matters here.
- **Braintrust / LangSmith / Arize** — platforms for annotation, regression
  tracking and dashboards. Real value, but at Stage 4+, and they are where the
  human-labelling workflow would live if the version-stack harvest is not
  enough.

**The recommendation is to adopt none of them yet.** Stages 1–3 are a report
over our own oplog and a set of graders that are already vitest tests in
everything but name. The framework earns its place at Stage 4, when there are
enough tasks that running them needs a harness and enough judges that
calibration needs a home — and at that point the choice should be re-made
against what exists then, not what exists now.

The division of labour the field has converged on — a lightweight harness for
CI gating, a platform for annotation and tracking — is the right end state.
Arriving there before Stage 1 has said what we are measuring is how eval
programmes end up with beautiful dashboards nobody reads.

---

## What to do first

Three things, in order, none of which needs a decision from anybody else:

1. ~~**`isocan evals corpus`**~~ **Done, 1 Sep 2026** — `packages/core/src/evals.ts`
   and `isocan evals corpus`. Not via `onThread`, which cannot do it (above);
   via the anchor, the references, and a labelled window. Read-only, local,
   writes nothing. The taxonomy step (§Stage 1.2, hand-labelling 200 asks) is
   the part still to do, and the corpus is what it reads.
2. ~~**Harvest the version stacks.**~~ **Done** — `isocan evals pairs`. A pair
   is somebody making an EARLIER version current while later ones existed;
   promoting the newest is a save, not a choice, and counting those would have
   inflated the harvest into looking like a solved calibration problem. **11
   across the home.** The answer is the one this document predicted: not
   solved, and it will not be until divergence is something people use.
3. ~~**Score one real canvas with the graders we own.**~~ **Done** —
   `scripts/grade.mjs`, above. The number was not worse than expected, which is
   its own finding: three hand-written screens and the marketing page all pass
   8/8. That is weak evidence, because everything graded so far was written by
   somebody being careful. The suite earns its keep on the first artifact an
   agent produced unsupervised, and that is the next thing to point it at.

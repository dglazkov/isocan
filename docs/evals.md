# Evals

How we find out whether isocan is any good at the thing it exists for — and
then keep finding out, as the models, the skills and the product all move.

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
project in one home: 20 threads, 63 replies, **16 ops reversed by an undo**, 39
versions across 14 items — and **2** deliberate version choices and **1** parent
with more than one child. The plumbing is real and the mine is empty. The
preference-pair harvest is not a standing asset we are ignoring; it is an asset
that begins to exist the first time anybody reaches for `/variation`, which so
far nobody has. Stage 4's calibration problem is **not** already solved.

That has a product consequence worth naming: nothing generates preference pairs
until divergence is something people actually use, and divergence is not worth
using while [convergence](design/convergence.md) is missing. The op is on the
critical path for the eval programme, not only for the canvas.

**Comments are the request corpus.** What people ask agents for, in their own
words, timestamped, with `@mentions` naming who was asked and `onThread`
joining the request to the work that answered it. `onThread` is the join key
the whole programme depends on: it is what makes "this ask produced these ops
and that answer" a query rather than a guess.

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

1. **`isocan evals corpus`** — a read-only report that joins comments to the
   ops that answered them via `onThread`, and dumps the result. Stage 1 cannot
   start without it, and it is a query over data we already have.
2. **Harvest the version stacks.** Every `item.setCurrentVersion` over a
   multi-child parent is a preference pair. Count them. If the number is large,
   Stage 4's calibration problem is already solved and we did not know it.
3. ~~**Score one real canvas with the graders we own.**~~ **Done** —
   `scripts/grade.mjs`, above. The number was not worse than expected, which is
   its own finding: three hand-written screens and the marketing page all pass
   8/8. That is weak evidence, because everything graded so far was written by
   somebody being careful. The suite earns its keep on the first artifact an
   agent produced unsupervised, and that is the next thing to point it at.

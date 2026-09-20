# Judge — the walk

**19 September 2026.** The order of work for [design.md](design.md). Each phase
ends with **Trajectory**: only what the phase discovered that changes the
project's course. A phase that went as planned leaves it empty.

**Where we are: nothing is built. Phase 0 is CLOSED — the reference has been
read and one classification run by hand, on a local machine with the key.
Phase 1 is next, and it is also local.** Phase 0 found the `Judgment`/`Judged`
sketch wrong in three places, all now corrected in [design.md](design.md): a
Choice returns the **whole probability distribution** rather than one `p`, the
request is one `state` plus a map of named questions rather than a flat field
map, and `spent` has to split input from output tokens because only input is
billed. It also found the judge **wrong on the one card it was asked about**,
in the exact parent-versus-child way this project exists to study.

**Which machine does what, recorded 20 Sep 2026 because it is not obvious and
costs a session to rediscover.** The cloud container cannot reach TypeSafe at
all — `api.typesafe.ai` resolves and the proxy refuses the tunnel
(`CONNECT tunnel failed, 403`), so a key alone would not help it. Everything
that touches the vendor therefore belongs on a machine with ordinary network,
and that is a LEG rather than a phase:

| | Where | Why there |
| --- | --- | --- |
| ~~judge phase 0~~ | local | **done 19 Sep 2026** — reference read, one call made |
| judge phase 1 | local | the corpus is a personal MCP server no CI holds a credential for |
| judge phase 2 | local | needs the judge phase 0 measured |
| [voice](../../research/2026-09-19-move-the-red-one.md) phases 4–5 | local | the resolver needs a working judge |

Everything in the voice work that needs NO vendor is already done — the
projection carries geometry and colour, and `besideBox` gives the movement
tool its second referent. So the local leg is the whole of what is left, and
phase 0 is its first step rather than a detour before the real work.

Two rules govern every phase here, both inherited and neither negotiable in
this document:

- **A typed judge triages; it never rules.** The evals bar requires a judge to
  cite, and a System One model cannot. Any phase whose outcome is a judgment
  acted on without an accepted act or an existing guard is the wrong phase.
- **Calibration before use.** No phase may act on a judgment before a phase has
  reported that judge's reliability curve. Phase 2 is allowed to end this
  project, and that is its job.

## Phase 0 — The instrument, read rather than assumed

**Status: CLOSED, 19 September 2026.** Read from
[the HTTP API reference](https://docs.typesafe.ai/api) and
[Models](https://docs.typesafe.ai/models) on 19 Sep 2026, and exercised with
six calls from a local machine. Measured spend: **$0.0005** against a budget of
one dollar.

### What the reference says that the coverage did not

The figures table in
[the research note](../../research/2026-09-19-system-one-and-the-ledger.md) has
been replaced with one read first-hand. The price survived — $0.042 per Mtok on
input, output free. Four things did not, and two of them change the design.

**A Choice returns the whole distribution.** Not a chosen value and a
probability; every option mapped to its probability, summing to 1, plus a
separate `confidence`. The design's open question *"what happens to a tie"* is
answered by the API rather than by us: two folders at 0.45 is directly
representable and always was.

**`confidence` is not the probability, and the two must not be confused.** The
reference is explicit that `confidence` is a statistic over the *shape* of the
distribution, not an estimate of being right. Their own worked example returns
`choice: "returns"` at probability **0.60** with `confidence` **0.39**, because
the runner-up holds 0.38. Only `probabilities[choice]` is the calibrated
quantity, so only it can carry a reliability curve. Phase 2 inherits an
explicit choice here and phase 3's band boundary depends on which axis it picks.

**The input is text only.** Verbatim from Models: *"Text only. String, JSON
object, or array of text values. No image, audio, or video input."* This
settles the colour question the voice work left open — see Trajectory.

**The published latency is not published.** The 70–500ms in every piece of
coverage appears nowhere in the reference. Measured below instead.

Two limits nobody had. A Choice takes **up to 255 options**, which clears the
ledger's 131-folder tree, so filing against the entire taxonomy in one question
is allowed rather than assumed. And context is 64k per request, 32k for `state`
plus the longest single question.

### The call, verbatim

One card whose folder is already known, asked against the real 131-folder enum.
The card is
*"What causes a new stacking context to be created?"*, filed by a person in
`technology/engineering/web/css/css-for-js-developers-josh-comeau`.

Request, with the 131 `criteria` keys elided after the first three — every value
is `null`, because a full slash-separated path describes itself:

```json
{
  "state": {
    "front": "What causes a new stacking context to be created?",
    "back": "The most common cause is a `position` that isn't `static` and a `z-index`, but also: Setting `opacity` to a value less than 1; Setting `position` to `fixed` or `sticky` (No `z-index` needed for these values!); Applying a `mix-blend-mode` other than normal; Adding a `z-index` to a child inside a `display: flex` or `display: grid` container; Using `transform`, `filter`, `clip-path`, or `perspective`; Explicitly creating a context with `isolation: isolate`."
  },
  "model": "jev-latest",
  "questions": {
    "folder": {
      "type": "choice",
      "instructions": "This is a flashcard from a personal knowledge base. Which folder of the folder tree was it filed in? Each option is a full folder path, slash-separated, from the root. Choose the single folder the card is filed directly in, not a parent or a child of it.",
      "criteria": {
        "companies": null,
        "companies/augment": null,
        "companies/google": null
        // … 128 more, one per folder, all null
      }
    }
  }
}
```

Response, `200 OK`, with the 127 options that came back at exactly `0` elided:

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "folder": {
      "type": "choice",
      "choice": "technology/engineering/web/css",
      "probabilities": {
        "technology/engineering/web/css": 0.72,
        "technology/engineering/web/css/css-for-js-developers-josh-comeau": 0.23,
        "technology/engineering/web": 0.04,
        "technology/rise-and-fall-of-the-pc-steven-sinofsky": 0.01
        // … 127 more, all exactly 0
      },
      "confidence": 0.71
    }
  },
  "usage": { "input_tokens": 2365, "output_tokens": 2042 }
}
```

**The judge got it wrong.** The person filed the card in the Josh Comeau
subfolder; the judge chose its parent at 0.72 and gave the true answer 0.23. It
is one card and proves nothing about accuracy — that is phase 2's job — but the
*shape* of the error is the thing this project was started to look at. The
distribution puts 0.99 on the CSS/Web branch and splits it across three depths.
The judge knows the region and not the depth, which is the parent-as-junk-drawer
pathology the research note counted at 1,366 cards, seen from the model's side.

### Measured

| | Measured 19 Sep 2026, 5 calls | Coverage claimed |
| --- | --- | --- |
| Latency | 193, 195, 289, 306, 351 ms | 70–500ms |
| Input tokens | 2,365 for a 131-option question | — |
| Output tokens | 2,042, billed at zero | free |
| Cost per call | **$0.0000993** | $0.042/Mtok input |
| Model behind `jev-latest` | `jev-1.13.0` | — |

Latency lands inside the claimed range but never near its floor; 70ms is not
what a 2,365-token, 131-option question costs. Filing all 3,643 cards at this
size is **$0.36**, about triple the research note's twelve-cent estimate,
because the note assumed 800 tokens a call and the real schema is 2,365.

**Repeated calls are not identical, and phase 2 has to budget for it.** The same
request five times returned `probabilities[choice]` of 0.72, 0.75, 0.72, 0.79,
0.77 and `confidence` of 0.71, 0.74, 0.71, 0.78, 0.75. A spread of ±0.035 on a
single card means reliability buckets finer than about 0.1 would be reporting
sampling noise, and it means a card sitting near a band boundary can cross it
between runs. The jaggedness page's *"extremely consistent"* is a claim about
semantically similar inputs, not about repeating one.

### Errors, first-hand

The documented codes are right, but the body has **two different shapes** and
the reference does not say so. A `401` carries an object:

```json
{"detail":{"error_type":"authentication_error","message":"Cannot authenticate with the server. Please check your API key and try again."}}
```

A `422` carries an array, one entry per offending field:

```json
{"detail":[{"type":"missing","loc":["body","questions","q","choice","criteria"],"msg":"Field required","input":{"type":"choice","instructions":"Pick one."}}]}
```

Anything parsing `detail` has to handle both. `429` and `529` were not provoked
— doing so deliberately against an early-access endpoint under load is not
worth the goodwill, and the documented advice is the ordinary one, back off and
retry.

**Proof:** this record. The request and response above are the real ones; the
figures table is measured rather than quoted; the three places the shape differs
from the sketch are named and [design.md](design.md) is corrected.

## Phase 1 — The labels that already exist

**Status: NOT STARTED.**

**Outcome:** the calibration corpus, built before any classifier touches it.
Every card in the ledger is already in a folder a person chose; that is the
label. This phase exports 3,643 of them into a held-out set with the folder
tree as the answer's allowed values, and **writes no classifier at all**.

Two things make this the highest-leverage phase and neither involves a model.
It is what makes phase 2 falsifiable — a judge measured against labels invented
for the occasion measures nothing. And it survives the vendor: the corpus
outlives whichever model is behind the seam.

Fixtures are synthetic, per the house rule, and here that is a privacy
requirement rather than a style one: the committed set carries the *shape* — a
card's length, its folder, its depth, its sibling count — with titles and
bodies replaced. The real text stays on the machine that ran the export.

**Proof:** an export script produces a set whose size and folder distribution
match the live tree as counted on the day, and a test asserts the held-out
split is disjoint from anything a later phase trains or tunes against. The
committed fixture contains no card text from the real ledger, asserted by a
test rather than by inspection. `npm test` and `npm run typecheck` whole.

## Phase 2 — Calibration, and the reading that may end this

**Status: NOT STARTED.**

**Outcome:** the `Judgment` interface and the uniform stub land in
`@isocan/core`, the vendor behind the seam, and a reading is published under
`docs/calibration/` beside the 4 September one — same discipline, same place.

The headline is **not** accuracy. It is the reliability curve: bucket the
judgments by the probability they carried and report what fraction of each
bucket was right. A judge that is 70% accurate with honest probabilities is
usable here; one that is 85% accurate and says 0.99 about everything is not,
because the routing rule this whole project rests on is built on the number
rather than on the verdict.

**This phase is allowed to fail, and failing is a result.** If the curve is
flat, the project stops at a published page saying so, and the corpus from
phase 1 remains worth having.

**Proof:** a reading page in `docs/calibration/` carrying the held-out size,
accuracy, the reliability curve by bucket, the measured spend and the model id,
produced by a harness with a dry mode that writes the page either way — the
shape `scripts/calibrate.mjs` already established. The stub scores at chance
through the same harness, so the harness is shown to be able to report a bad
judge. Cost is read from `spent` rather than estimated. `npm test` and
`npm run typecheck` whole.

## Phase 3 — The band, on a canvas

**Status: NOT STARTED.**

**Outcome:** the first thing anybody can look at. The loose cards of one folder
— General Knowledge's 235 are the candidate — get a proposed folder and a
confidence, and land on a canvas with **confidence as position**: a confident
tail, an uncertain band with a boundary drawn from phase 2's curve rather than
from taste, and each card carrying the model id and the probability that put it
there, the way `contextSource` carries provenance.

Accepting the confident tail is **one act**, and one undo takes the whole
filing back. Nothing is filed by the judge itself: the act is accepted by a
person, which is the design's may/may-not table made literal.

**Proof:** an actual browser walk at 1440px and 390px drives the canvas — the
band renders with its boundary, a card shows the model and probability that
placed it, accepting the tail produces exactly one `group.change` in the log,
and one undo removes every card it filed. Falsified by mutating the product,
not the test, and watching the walk go red. Cards are synthetic. `npm test`,
`npm run typecheck`, the bundle budget, and the walk.

## Phase 4 — The folder that wants to split

**Status: NOT STARTED.**

**Outcome:** taxonomy maintenance driven by measured confusion. Run the judge
over one folder's cards against candidate sub-topics; two tight
high-confidence clusters mean the folder is two folders, and the same
measurement read backwards — two folders the judge cannot tell apart — means
they want to merge. Health & Biology's 183 loose cards are the candidate.

The output is a **proposal on a canvas**, never a move. The mind map module
already draws a graph, and pairwise confusion is a graph.

**Proof:** the split proposal for a folder with a known structure recovers that
structure, and a deliberately homogeneous folder produces no split — the
negative control, without which this phase proves nothing. A proposal writes
nothing until accepted. `npm test` and `npm run typecheck` whole.

## Phase 5 — The cheap tier, at last

**Status: NOT STARTED.**

**Outcome:** what [#205](https://github.com/dglazkov/isocan/issues/205) found
missing. A triage pass over the personas' findings queue that costs cents and
routes only its uncertainty to the Opus tier, with the spend declared per run
in the shape `rcLimits` already holds per agent — so "cheap" is a fact read
from `spent` rather than an adjective in a front-matter line.

The expensive judge still writes every finding that lands. The judge's only
output is the order and the routing.

**Proof:** a run over a known findings set routes its uncertain tail to the
expensive tier and its confident tail past it, with the measured spend of both
on the page; disabling the judge changes what is *spent* and not what is
*found*. That last clause is the phase's real assertion and the one to falsify
first. `npm test` and `npm run typecheck` whole.

## Trajectory

- **2026-09-19** — Closed by phase 0: every figure about the vendor was
  second-hand. The reference has now been read from a local machine with the
  key, and the research note's table is measured. The price held; the input
  modality, the answer shape and the latency figure did not.
- **2026-09-19** — Phase 0: **the `Judgment` sketch loses the thing the API is
  built to give.** A Choice returns the full probability distribution and a
  separate `confidence`; the sketch carried one `p` per field. design.md is
  corrected. The design's open question about ties needed no design work — the
  vendor already answers it.
- **2026-09-19** — Phase 0, for phase 2 to decide and phase 3 to inherit:
  **`confidence` is not `probabilities[choice]`.** The vendor's `confidence` is
  a shape statistic over the distribution, and their own example pairs a 0.60
  probability with a 0.39 confidence. Only the probability can carry a
  reliability curve; the band in phase 3 could reasonably be drawn on either.
  Phase 2 must state which axis it measured and phase 3 must use the same one.
- **2026-09-19** — Phase 0, and it changes what phase 2 can resolve: **the same
  request five times moved `probabilities[choice]` by ±0.035.** Reliability
  buckets finer than ~0.1 would report sampling noise, and a card near a band
  boundary can cross it between runs. Phase 2's reading should either bucket no
  finer than that or measure the variance and say so.
- **2026-09-19** — Phase 0, a cost correction rather than a course change:
  filing all 3,643 cards is **$0.36**, not the twelve cents the research note
  estimated, because the real 131-option schema is 2,365 input tokens rather
  than the assumed 800. Still trivially affordable; still worth not being
  surprised by.
- **2026-09-19** — Phase 0, resolving the voice work's open colour question
  **without reopening anything**: Jev's input is text only — "No image, audio,
  or video input" — so a card's pixel face cannot be judged directly, and the
  question phases 2–3 closed as "not faked" stays closed. The reference adds a
  sharper point than the modality: Jev is explicitly bad at hex, "questions
  about colors using hex values will underperform compared to those using the
  English names", and the prescribed fix is to name the colour in code before
  asking. So a stroke's computable hex is judgeable only after a code-side
  conversion to a named bucket. Recorded, not acted on.
- **2026-09-19** — Open: the calibration corpus lives in a personal MCP server
  a CI workflow cannot hold a credential for, so phase 1 likely exports once
  and commits a synthetic-text fixture. Waits on phase 1 deciding the shape.
  Phase 0 read the tree first-hand and it is **131 folders**, well inside the
  255-option ceiling on a Choice, so the whole taxonomy fits in one question
  and phase 1 need not design a hierarchy of narrower ones.
- **2026-09-19** — Open, raised by phase 0's single call and **not** settled by
  it: the one error observed was parent-versus-child within the right subtree,
  which is the shape a one-question-per-card design handles worst. Asking
  branch and depth as two questions, or letting the parent win only when it
  beats the sum of its children, are both cheap to test. Phase 2 measures
  before anybody builds either — one card is an anecdote.

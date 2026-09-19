# Judge — the walk

**19 September 2026.** The order of work for [design.md](design.md). Each phase
ends with **Trajectory**: only what the phase discovered that changes the
project's course. A phase that went as planned leaves it empty.

**Where we are: nothing is built. Phase 0 is next — read the API from its
reference rather than from coverage, and make one call by hand.** It is the
only phase that needs a person, and it needs two things: an early-access key,
and a machine that can reach `typesafe.ai` (the build container's egress proxy
blocks it, which is why every figure in the research note is second-hand).

Two rules govern every phase here, both inherited and neither negotiable in
this document:

- **A typed judge triages; it never rules.** The evals bar requires a judge to
  cite, and a System One model cannot. Any phase whose outcome is a judgment
  acted on without an accepted act or an existing guard is the wrong phase.
- **Calibration before use.** No phase may act on a judgment before a phase has
  reported that judge's reliability curve. Phase 2 is allowed to end this
  project, and that is its job.

## Phase 0 — The instrument, read rather than assumed

**Status: NOT STARTED.**

**Outcome:** the research note's figures table is replaced by one read from
TypeSafe's own reference: the exact request and response shape, how an answer's
allowed values are declared, whether a runner-up is returned, what the error
and rate-limit behaviour is, and the real latency and price. One classification
is run by hand against an answer already known, and its output is pasted into
the phase record verbatim.

Nothing is integrated. No `Judgment` interface yet, no module, no canvas. The
deliverable is knowing what we are building against, because everything
downstream was designed from secondary coverage and at least one detail will be
wrong.

⚑ **Needs a person, and this is the project's only such step.** An early-access
API key from TypeSafe, and a machine outside this container's egress proxy.
Expected spend for the whole phase: **under one dollar** — a few dozen calls at
$0.042 per million input tokens with free output. No cloud resource, no
subscription, no commitment beyond the key.

**Proof:** the phase record carries the request and response shapes copied from
the reference with the URL and the date read, one real call's exact output, and
a measured latency and cost for it. Any place where the shape differs from
[design.md](design.md)'s `Judgment`/`Judged` sketch is named, and the design is
corrected before phase 1 begins.

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

- **2026-09-19** — Open: every figure about the vendor in this project came
  from secondary coverage, because `typesafe.ai` and `docs.typesafe.ai` are
  blocked by the build container's egress proxy. Phase 0 exists to replace
  them. Waits on a key and a machine outside the proxy.
- **2026-09-19** — Open: the calibration corpus lives in a personal MCP server
  a CI workflow cannot hold a credential for, so phase 1 likely exports once
  and commits a synthetic-text fixture. Waits on phase 1 deciding the shape.

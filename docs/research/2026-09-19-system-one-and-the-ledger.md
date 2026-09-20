---
status: designed
since: 2026-09-19
issue: 334
see: judge, evals, personas, memory, context
note: a System One model (TypeSafe's Jev — typed answers with calibrated probabilities, no prose, $0.042/M input and free output) is the cheap tier the personas project found missing and the autorater triage the evals project cannot afford. The finding that makes it actionable is a corpus: a personal knowledge base of 3,643 cards, 1,366 of them (37%) sitting in a parent folder that also has subfolders, is 3,643 free human labels — where isocan's own preference harvest has 12 pairs. Jev structurally cannot cite, so it can never be the judge of record under the evals bar; it triages and routes its doubt. Became the judge project the same day. The API shape and figures table were read first-hand from the reference on 19 Sep 2026 by judge phase 0, from a machine outside the build container's egress proxy; a Choice returns the full probability distribution, and the input is text only.
---

# A judgment that cannot explain itself

**19 September 2026.** Asked by Dion: *research use cases for isocan,
typesafe.ai and the ledger — categorizing things, be creative.*

This note is a survey and an argument. Nothing is built. The argument is that
a **System One model** is a shape isocan has twice written down that it needs
and twice failed to obtain, and that the thing which makes it testable this
week is not a model at all — it is a corpus of free human labels that has been
sitting in a personal knowledge base the whole time.

## What a System One model is

[TypeSafe AI](https://typesafe.ai/) left stealth in September 2026 with $40M
led by DCVC, founded by Diogo Almeida (ex-OpenAI, co-inventor of RLHF), Erik
Gafni and Sasha Sheng. Its first model, **Jev**, is not an LLM and the
difference is the point.

You send one **state** — the thing to be judged — and a map of named
**questions**, each of one of three types: a `choice` over options you define, a
`score` over ordered levels, or a `noul`, a yes/no returned as a probability.
The answers come back under the keys you chose. It does not write prose, cannot
reason out loud, and cannot explain itself. TypeSafe calls the class *System
One*, and trains for calibration explicitly — *reinforcement learning for
calibrated decisions* — so a 0.7 is meant to be right about seventy per cent of
the time rather than merely larger than a 0.6.

| | Read from the reference, 19 Sep 2026 |
| --- | --- |
| Endpoint | `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer <API_KEY>` |
| Model | `jev-latest` and `jev-preview`, both resolving to `jev-1.13.0` today |
| Input price | $0.042 per Mtok — charged on input tokens only |
| Output price | free |
| Rate limits | 250,000 tokens/sec and 1,200 requests/min, `429` over either; "adjusting dynamically… can change without notice" |
| Context | 64k tokens per request; 32k for `state` plus the single longest question |
| Input modality | **text only** — string, JSON object, or array of text values. "No image, audio, or video input." |
| Choice width | up to **255 options** per question |
| Errors | `401`, `422`, `429`, `529 Overloaded`; retry the last two with backoff |
| Latency | **not published.** The 70–500ms figure appears nowhere in the reference |

**The figures above were read from [the HTTP API reference](https://docs.typesafe.ai/api)
and [Models](https://docs.typesafe.ai/models) on 19 September 2026**, replacing
a table that was entirely second-hand. The price and the free output survived
the check. Three things did not: the input is text only, a Choice returns the
**whole probability distribution** rather than one number, and the published
latency figure is not published — it has to be measured, and
[judge phase 0](../projects/judge/phases.md#phase-0--the-instrument-read-rather-than-assumed)
measures it.

Two limits that were not in the coverage at all matter to what gets built here.
The 255-option ceiling on a Choice comfortably clears the ledger's 131-folder
tree, so filing against the whole taxonomy in one question is allowed. And the
reference is explicit that non-text input must be pre-processed into text by the
caller, which closes rather than opens the question of whether a picture can be
judged directly.

## Where isocan already asked for this, twice

This is not a technology looking for a use. Two documents in this repository
describe the missing piece, and neither names a vendor.

**[Small personas](2026-09-07-small-personas.md) ([#205](https://github.com/dglazkov/isocan/issues/205)), 7 Sep.** The note
opens by correcting a claim that the nightly personas are already the cheap
tier:

> **They are not.** All nine persona files declare `model: opus` and
> `effort: xhigh`. There is one tier, it is the expensive one, and it runs nine
> times a night.

It then lists what a cheap tier would need, and the second item is *a declared
cost, so "cheap" is a fact rather than an adjective* — because "this project's
whole method is that a bound nothing enforces is a comment." A model whose
price is $0.042 per million input tokens with free output makes the bound
trivially declarable.

**[The evals plan](../projects/evals/plan.md), stage 4.** The first calibration
reading, 4 Sep:

> 27 canvases, 12 pairs, 30 comparisons, **12/19 answered agreed (63%, κ 0.26
> ± 0.23), $11.77**.

That is **$0.39 a comparison** for agreement barely above chance. The same
stage also states the discipline that any judge must meet here, and it is the
reason this note does not end in a recommendation to replace the autorater.

## The thing that must be said before anything is built

The evals plan's bar:

> **Judges must cite.** The same bar `/design-audit` already holds: a finding
> names the selector, the value, the line. An autorater that returns a score
> and no evidence cannot be audited, and will not be believed the first time it
> disagrees with somebody.

**A System One model structurally cannot meet that bar.** It returns a typed
judgment and a number. There is no line to name, no selector to quote, no
argument to read. It is not that Jev's citations would be poor; it is that
citation is not in the output shape.

So the honest conclusion is a narrow one, and it is the whole recommendation of
this note:

> **A typed judge may triage. It may never rule.**

What it buys is not a cheaper verdict. It is a cheaper *sort* — a way to spend
the expensive, citing judge only where the cheap one is unsure. That is exactly
the handoff [#197](https://github.com/dglazkov/isocan/issues/197) described and
small-personas found missing, and it needs a confidence number to be possible
at all.

## The corpus, which is the actual finding

A judge that reports calibration needs labels to calibrate against. isocan's
own harvest — the version stack, which the evals plan calls "the single
highest-leverage thing in this document" — produced **12 pairs**. You cannot
calibrate anything on twelve pairs.

The personal ledger behind this session's `knowledge_*` tools has **3,643
cards** in a folder tree of about 130 nodes. Every one of those cards is in a
folder **a person put it in**. That is not a corpus that needs labelling; it is
3,643 labels that already exist, produced over years, for free, by the only
rater whose agreement matters.

And it has a visible pathology, which is where the use case starts:

| Folder | Cards sitting loose | Subfolders below it |
| --- | --- | --- |
| `…/Web 🕸/CSS` | 241 | 2 |
| `General Knowledge 🤔` | 235 | many |
| `…/Health & Biology 💪` | 183 | 2 |
| `Personal 🙋‍♂️/People` | 106 | 16 |
| `…/Psychology` | 103 | 1 |
| `…/TypeScript` | 81 | 1 |

Across the tree, **1,366 cards — 37% of the base — sit directly in a folder
that also has subfolders.** The parent is doing double duty as a category and
as a junk drawer.

That is not automatically a mistake: a folder may legitimately hold both cards
and children, and some of those 1,366 belong exactly where they are. It is a
*signal* of where deciding got expensive, which is the same thing as where a
cheap decision would pay. Filing all 3,643 against a 130-value enum, at roughly
800 tokens a call including the schema, is about **twelve cents**.

**The symmetry is the argument.** isocan has the surface and the discipline and
no labels. The ledger has the labels and no surface. Jev is the cheap typed
judgment that turns one into the other.

## What a canvas adds that a list cannot

A probability is a spatial quantity, and isocan is a canvas. This is the part
that does not exist anywhere else, and it is why the proving ground is a canvas
rather than a script with a progress bar.

- **Confidence becomes position.** Lay a folder's unfiled cards along an axis
  of certainty. The confident tail is a decision; the middle is a question. The
  band you would have to compute and threshold in a list is a *place* you can
  look at, and isocan already has areas and explicit groups to name it with.
- **A machine's filing is one undoable act.** `group.change` carries a whole
  copy in one operation, and [memory phase 6](../projects/memory/phases.md) just
  proved a decoration hook that lets a pin, its provenance and a role-strip ride
  the same act. A thousand-card filing that one keystroke takes back is a
  different proposition from one that rewrites a tree in place.
- **Provenance is already built.** `contextSource` records where a copied piece
  came from — six plain facts, no capability. A confidence and a model id are
  the same kind of fact, and the card can carry them: *filed here by a machine
  at 0.62*. Accountable automation is automation whose card says who decided.
- **Disagreement has somewhere to go.** A canvas has comments and versions. A
  filing you disagree with is a thing you can argue with in place, and the
  argument is the next calibration label.

## Use cases, ranked by what they would teach

**1. The filing floor.** The 235 loose General Knowledge cards get a proposed
folder and a confidence, and land on a canvas with confidence as position. The
confident tail is one accepted operation; the ambiguous band is swept by hand,
once. Cheapest real test of the whole idea, and it produces something the owner
of the ledger actually wants.

**2. Calibration against labels nobody had to write.** Hold out a sample of
*already-filed* cards and ask Jev which folder they are in. Accuracy is the
boring half; the reliability curve is the half that matters — does 0.9 mean
ninety per cent? This is the phase that can fail, and failing is a result.

**3. The folder that wants to split.** Run the judge over one folder's cards
against candidate sub-topics. Two tight high-confidence clusters mean the
folder is two folders. Health & Biology's 183 loose cards are the candidate.
The inverse is the same measurement read backwards: two folders the judge
cannot tell apart want to merge. Taxonomy maintenance driven by measured
confusion rather than by a tidying mood.

**4. The confusion graph.** Pairwise confusion across folders is a graph, and
the mind map is already a module. It draws where the taxonomy lies to you.

**5. Near-duplicates, before the write.** The ledger's own instructions say a
near-duplicate card "is worse than a missing one, because it splits one idea
across two cards that then drift". Same-or-different is a typed judgment cheap
enough to run pairwise inside a folder exhaustively — and `isocan choose`
already exists to converge siblings down to a survivor.

**6. The shelf boundary.** The ledger separates things to *do* from notes
*about* things, and puts the reading list in the task ledger as `#read` rather
than as cards. That distinction is a binary classification people get wrong at
capture time, every time, and it is exactly the shape a typed judge holds.

**7. Card quality.** Is this a good flashcard — one idea, answerable, not a
list in disguise? The failures become a repair queue on a canvas rather than a
number in a report.

**8. A knowledge base that says when the world moved.** The ledger tracks five
companies in 229 cards. A new article types as `{company, kind,
contradicts_existing}`, and the last field is the valuable one: a note that has
quietly gone stale is worse than no note, and nothing currently says so.

**9. The cheap tier, at last.** Nine personas at Opus and xhigh run nightly.
A triage pass that costs cents and routes only its uncertainty to the expensive
tier is what #197 described and #205 found absent.

## What this does not claim

- **Not a replacement for the autorater.** The citation bar forbids it. Triage
  only, with the expensive judge downstream.
- **Not measured beyond one call.** The figures table is now read from the
  reference and one classification was run by hand, but no accuracy or
  reliability figure exists yet. Judge phase 2 is what produces one, and it is
  allowed to end the project.
- **Not a verdict on the ledger's taxonomy.** 1,366 loose cards is a signal of
  where decisions got expensive, not a list of mistakes. Some of them are filed
  correctly and a good classifier will say so.
- **Not free of a vendor.** This is an early-access hosted model from a
  three-month-old company. The judge project's phase 0 exists partly so that
  the seam is an interface rather than a dependency, and phase 1 produces a
  labelled corpus that outlives whichever model is behind it.

## Sources

- [TypeSafe AI](https://typesafe.ai/) · [Introducing System One Models & Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev) · [System One concepts](https://docs.typesafe.ai/concepts/system-one)
- [TypeSafe AI emerges from stealth with $40M](https://finance.yahoo.com/technology/ai/articles/typesafe-ai-emerges-stealth-40m-190000776.html)
- [LangChain — building a harness with Jev](https://www.langchain.com/blog/building-a-harness-with-jev)
- [DataCamp — System One models](https://www.datacamp.com/blog/system-one-models-jev)
- [The Register — TypeSafe AI debuts model for machines](https://www.theregister.com/ai-and-ml/2026/09/16/typesafe-ai-debuts-model-for-machines-that-plays-doom/5296711)
- In this repository: [small personas](2026-09-07-small-personas.md), [the evals plan](../projects/evals/plan.md) stage 4, [the first calibration reading](../calibration/2026-09-04.md)

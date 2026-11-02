---
status: partial
since: 2026-09-19
issue: 334
see: judge, evals, personas, memory, modules
note: designed 19 Sep 2026 from the System One research note. A typed judge returns a decision and a calibrated probability and cannot cite, so it may triage and may never rule — the evals bar forbids it. The seam is `Judgment` in core, one interface with a declared cost, so the vendor is replaceable and a stub is a first-class implementation. Calibration comes before use. The corpus was first a personal knowledge base of 3,643 human-filed cards; on 24 Sep 2026 it became isocan's own — the wireframe flow's round-1 judgments against what a person then kept or took out — because that knowledge base belongs to a separate project isocan does not reach into. Phase 0 closed 19 Sep 2026: the reference was read first-hand and one call made, correcting the sketch in three places — the vendor returns the full probability distribution plus a separate confidence, takes one state with many named questions, and bills input tokens only. Phases 1 and 2 PART-DONE 24 Sep 2026: `isocan judge corpus` reads wireframe decisions into labelled rows, and the reading harness writes the calibration page — which concludes at about 470 labelled rows, and until then says it cannot.
---

# Judge: a decision, a probability, and no argument

The research is
[`2026-09-19-system-one-and-the-ledger.md`](../../research/2026-09-19-system-one-and-the-ledger.md)
and the survey is not repeated here. This is the argument for the mechanism.

## The sentence

> **A judgment that cannot explain itself must show its confidence and route
> its doubt to something that can.**

Everything below is an application of that sentence, and the two halves are
equally load-bearing. *Show its confidence* is what makes a cheap judge usable
at all. *Route its doubt* is what keeps it from quietly becoming the thing that
decides.

## Why this is not the autorater

The evals plan is unambiguous, and it is right:

> **Judges must cite.** An autorater that returns a score and no evidence
> cannot be audited, and will not be believed the first time it disagrees with
> somebody.

A System One model returns a typed field and a number. There is no line to
name. It fails that bar by construction, not by quality — and a model that
could be *persuaded* to cite would be an LLM, which is the expensive thing this
is not.

So the rule this project lives under, and the one that should be quoted back at
any phase that drifts:

> **A typed judge triages. It never rules.**

What it produces is never a verdict. It is a **sort**: a confident head that
can be acted on in one undoable act, and an uncertain tail that goes to a judge
which can argue. The value is not a cheaper answer; it is spending the costly
answer only where it changes something.

## The seam, and why it is in core

`Judgment` is one interface in `@isocan/core`, and the vendor sits behind it:

```ts
/** One typed question. Choice is the only type this project needs today. */
interface Choice<V extends string> {
  type: "choice";
  instructions: string;
  /** Option → rubric description; `null` where the name speaks for itself. */
  criteria: Record<V, string | null>;
}

/** What was asked: one state, and questions under keys the caller chooses. */
interface Judgment<Q extends string, V extends string> {
  state: unknown;
  questions: Record<Q, Choice<V>>;
}

interface Chosen<V extends string> {
  /** The highest-probability option. */
  value: V;
  /** Every option's probability, summing to 1. The runner-up is in here. */
  probabilities: Record<V, number>;
  /** A statistic over the shape of `probabilities`. NOT p(correct). */
  confidence: number;
}

interface Judged<Q extends string, V extends string> {
  answers: Record<Q, Chosen<V>>;
  /** What this cost and what answered, so "cheap" is a fact. */
  spent: {
    inputTokens: number;
    /** Returned, and billed at zero. Kept because it is reported. */
    outputTokens: number;
    /** Measured by the caller; the vendor does not report it. */
    ms: number;
    /** The versioned id that answered, e.g. `jev-1.13.0`. */
    model: string;
  };
}
```

**This sketch was corrected by [phase 0](phases.md#phase-0--the-instrument-read-rather-than-assumed)
on 19 Sep 2026**, which read the reference and made a real call. The first
version carried a single `p` per field, a flat `fields` map, and one `tokens`
number. All three were wrong: the vendor returns the entire distribution, takes
one `state` with many named questions against it, and bills input only.

Two consequences beyond the shape, both of which land on later phases rather
than here. **Many questions ride one `state` in a single call**, which is the
vendor's own cost lever and something a one-question-per-call wrapper would
throw away — phase 5's triage pass is where it pays. And **`confidence` and
`probabilities[value]` are different numbers**: only the probability is the
calibrated quantity, so only it can carry a reliability curve, while
`confidence` is the better read of *"none of these options is a clear winner"*.
Phase 2 must say which one it measured and phase 3's band must be drawn on the
same axis.

Three consequences, and each is a rule rather than a nicety.

**A stub is a first-class implementation.** A judge that answers uniformly at
`p = 1/n` must be wired in from phase 0 and must stay. It is how every consumer
is tested without a network or a key, and it is what the whole project falls
back to if the vendor vanishes — which, for a three-month-old company's
early-access endpoint, is a case to have designed for rather than discovered.

**The cost is returned, not estimated.** Small personas found that "cheap tier"
was an adjective because nothing stated what a persona may spend. `spent` makes
it a fact at the call site, in the same shape `rcLimits` already holds per
agent.

**No new `Operation`.** A judgment is not a mutation. What a judgment *causes*
is an ordinary `group.change` or `item.update` attributed to whoever accepted
it — which means one undo takes it back, the oplog says who, and the isomorphism
holds without the vocabulary growing. A judge that needed its own op would be
proposing a product feature, and should be told so.

## Calibration before use, and the corpus that makes it possible

The evals plan's method is *measure what is measurable before asking a model's
opinion about anything*, and this project inherits it literally: **no phase may
act on a judgment before a phase has reported that judge's calibration.**

Reporting calibration needs labels — decisions a person made, that nobody
had to write for the occasion.

**Decided 24 Sep 2026: the labels are isocan's own, and they come from the
first thing that already acts on a judge.** The wireframe flow (wireframes
phase 5 onward) asks the judge, for every screen round 1 considers, how likely
the request is to need it, and acts on the answer: a confident screen goes
into the prototype by itself, an unsure one is drawn marked *maybe*, and the
rest are never drawn. Then a person disposes. Keeping a maybe (⇧K) is a
*yes* the judge was unsure of; taking an auto-kept screen out is a *no* it
was sure of. `wireKeepBy` already tells the two hands apart — "a mark somebody
chose and one a machine chose are different evidence" — and the oplog keeps
both acts with their authors.

It is the design's own fourth bullet below, promoted from a side effect to the
source: *disagreement becomes the next label*.

**What it was, and why it changed.** The first corpus was a personal knowledge
base of 3,643 cards, each in a folder a person chose, reached over MCP. It is
a separate project, and isocan does not read into it; the phase that would
have exported it was re-cut before any code. Two things were lost and one
gained. Lost: size — the cards existed on day one, and a wireframe corpus
grows only as fast as people use `/wire` — and the question's shape, a
131-way Choice rather than a yes/no. Gained: the judge is calibrated on the
decisions it is already making in isocan, so the curve answers a question the
product is asking, rather than transferring from somewhere else.

**Not the first reading of this judge.** Wireframes phase 6 had already put
Jev's archetype question to 1,318 labelled public screens (Enrico): it ranks
well — the truth is in its top three 62–70% of the time — and its
probabilities are overconfident by about 0.4 in every bin (ECE 0.39). That is a
different question from round 1's *does the request need this screen*, so it
does not settle this project; it is the prior, and a strong hint that the
curve here will want moving rather than trusting.

**Size is the honest limit.** A reliability curve needs enough verdicts in
each bucket to mean anything, so phase 2 states a floor and reports below it
rather than concluding. And the labels are censored at the bottom: a screen
below the maybe band is never drawn, so nobody can keep it, and the curve is
measured only where the flow draws.

**Accuracy is the boring half.** The half that decides whether this project
continues is the reliability curve: when the judge says 0.9, is it right about
ninety per cent of the time? A judge whose probabilities are decorative is
worse than no judge, because the routing rule is built on the number.

## What it may decide, and what it may not

| May | May not |
| --- | --- |
| Propose where a thing belongs | File it without an accepted act |
| Say two things are probably the same | Delete either |
| Sort a queue by likely relevance | Drop the tail |
| Route a finding to the expensive tier | Close the finding |
| Flag a note as probably contradicted | Edit the note |

The pattern is one line: **a judge proposes; a person or an existing guard
disposes.** Where small personas drew the same line it added an escape clause
worth keeping — a cheap tier may write where "changes arrive with guards that
fail without them, at which point the review is reading a test, not a diff."
Filing has exactly that shape when the filing is one undoable act.

## The confidence band is a place, not a threshold

A list has to pick a number and hide everything below it. A canvas does not:
confidence is a coordinate, and the uncertain middle is a region with a name
and a boundary you can see and argue with.

This is why the proving ground is a canvas rather than a script:

- **Position carries the probability.** The confident tail reads as a tail.
- **One act, one undo.** A whole filing rides a single `group.change`; memory
  phase 6 proved the decoration hook that lets a mark, its provenance and a
  role-strip travel inside the same act.
- **The card says who decided.** `contextSource` already records six plain
  facts about where a copied piece came from. A model id and a probability are
  the same kind of fact, and carrying them is what makes the automation
  accountable rather than merely fast.
- **Disagreement becomes the next label.** A canvas has comments and versions.
  Overruling a filing is a labelled correction, which is calibration data the
  next reading gets for free — the same trick the version stack already plays.

## Where it ships

As a module. `packages/modules/` already takes core records, web slots and CLI
verbs, and its removability test is literal: delete the directory and its two
list entries and the feature never existed. A judge is exactly the kind of
thing that should be deletable — a vendor seam, an experiment, and a bounded
one.

The `Judgment` interface and the stub are the exception and belong in core,
because both surfaces must not be able to disagree about what a judgment is.

## Open

- **What the band's boundaries are.** 0.4–0.7 is a guess in this document and
  must come out of phase 2's reliability curve, not out of taste.
- **Whether a correction writes back.** Overruling a filing is a label. Feeding
  it to a future calibration is obvious; doing it without turning the canvas
  into a training-data collector nobody consented to is not.
- ~~**Whether the ledger is reachable from CI.**~~ Moot since 24 Sep 2026:
  the corpus is isocan's own wireframe decisions, read from homes through
  isocan's own interface. What survives of the question is where the labelled
  set lives — on the machine that read it, with a synthetic fixture committed.
- **Whose decisions count.** A shared canvas holds several people's keeps. Phase
  1 counts only the verdicts of the person running the export; counting a
  collaborator's is the consent question the correction bullet above already
  names, and stays open until someone decides it.
- ~~**What happens to a tie.**~~ Closed by phase 0, and by the vendor rather
  than by us: a Choice answer carries `probabilities` over *every* option, so
  two folders at 0.45 is directly representable. The sketch above now keeps it.
- **Which axis the band is drawn on.** New in phase 0. `confidence` and
  `probabilities[value]` are different numbers and the vendor returns both —
  0.60 probability against 0.39 confidence in their own example. Only the
  probability can carry a reliability curve; `confidence` is the better reading
  of *"nothing here is a clear winner"*. Phase 2 states which it measured,
  phase 3 uses the same one, and this document should not guess first.
- **Whether one question per card is the right unit.** New in phase 0, on one
  card, so barely more than a hunch. The single error observed was the parent
  folder beating its own subfolder inside the right subtree. Asking branch and
  depth separately would address exactly that, and would also spend the
  vendor's multi-question call properly. Phase 2 measures whether the error is
  systematic before anyone builds a second question.

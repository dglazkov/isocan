---
status: designed
since: 2026-09-19
issue: 334
see: judge, evals, personas, memory, modules
note: designed 19 Sep 2026 from the System One research note. A typed judge returns a decision and a calibrated probability and cannot cite, so it may triage and may never rule — the evals bar forbids it. The seam is `Judgment` in core, one interface with a declared cost, so the vendor is replaceable and a stub is a first-class implementation. Calibration comes before use: a personal knowledge base of 3,643 human-filed cards is the labelled corpus isocan's own twelve preference pairs cannot be. Phase 0, reading the API from its reference rather than from coverage, is next and needs a key.
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
interface Judgment<F extends string, V extends string> {
  /** What was asked, and what answers were allowed. */
  question: string;
  fields: Record<F, readonly V[]>;
}

interface Judged<F extends string, V extends string> {
  /** The chosen value per field, with the probability it carries. */
  answer: Record<F, { value: V; p: number }>;
  /** What this cost and what answered, so "cheap" is a fact. */
  spent: { tokens: number; ms: number; model: string };
}
```

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

Reporting calibration needs labels. isocan's own harvest has twelve preference
pairs. The personal ledger reachable over MCP has **3,643 cards, each in a
folder a person chose** — labels nobody has to write, produced over years by
the only rater whose agreement matters.

So the ledger is this project's **proving ground**, not its subject. What is
being measured is whether a typed judge is trustworthy enough to triage
anything; the knowledge base is the only corpus at hand big enough to answer
that. The answer transfers; the cards do not.

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
- **Whether the ledger is reachable from CI.** Phase 2 needs the corpus. A
  personal MCP server is not a thing a workflow can hold a credential for, so
  the calibration set likely has to be exported once, synthetically renamed and
  committed — which the repo's fixtures rule requires anyway.
- **What happens to a tie.** Two folders at 0.45 is not the same as one at 0.9,
  and a single `p` on a chosen value loses that. The interface may need the
  runner-up.

# The judge in the tab — the walk

[`journey.md`](journey.md) is the ideal, [`design.md`](design.md) the
mechanism, [`ideas.md`](ideas.md) the use cases. Each phase ends with a
number, a page, or something a person can switch on and switch off again.

**Ordered by what settles the most for the least.** First the instrument in a
real browser, because nothing else is worth building if it is too slow, too
big or leaks. Then an offline comparison with no UI, because a judge that
cannot beat the regex already in the repo should not get a pixel. Then the
use cases, each in shadow before it shows anybody anything.

**Phase citations name their project**: `local-judge phase 2`, never a bare
"phase 2".

**Where we are:** specified 6 Oct 2026; nothing is built.
**local-judge phase 0 is next** — the instrument, measured.

**One rule for every phase.** No phase may show a person a suggestion before
a phase has reported that use case's accuracy among accepted answers, its
coverage, and its threshold, measured on a split it was not tuned on — the
judge project's *calibration before use*, applied per use case.

---

## Phase 0 — The instrument, measured

**Status: NOT STARTED.**

*No product surface.* A `local` `Answerer` in a lazy Worker, and a scratch page
that drives it.

- MediaPipe Decision Maker with **EmbeddingGemma 2 Text 270M** from the
  supplied LiteRT bundle — not converted, not FP16. Record the SDK version,
  the model revision and the sample commit it started from.
- The `local` `Answerer` speaks the existing `JevRequest`; a `JevQuestion`
  becomes a `ChoiceQuestion` in one pure function in core, tested.
- **Measured separately**, on a real desktop browser and one real phone, GPU
  and CPU reported apart: download bytes and time; init (load, compile,
  prewarm); first answer; warm p50/p95/p99 over at least 1,000 answers at 32,
  128 and 512 tokens and with 7 and 30 options; input to displayed result;
  memory; and the canvas's frame census with the Worker busy.
- **The privacy proof**: assets self-hosted, the network disconnected, the
  page reloaded, the suite run again, and the network log shows no request,
  state, embedding or answer leaving.
- The entry chunk's bytes unchanged.

**Acceptance:** `docs/research/` gains a page with those numbers and the
machine, browser, backend and token count beside each, and the offline run
recorded. **If warm p95 is over 100 ms on the desktop or 250 ms on the phone,
the page says so and the project stops at this phase** until something
changes.

⚑ Before any byte is served from isocan's own origin: a person reads the
Gemma terms for redistribution, and decides where the bundle is hosted.

## Phase 1 — Three judges, one set of asks, no UI

**Status: NOT STARTED.**

The Chat intent router ([idea 1](ideas.md#1-the-chat-intent-router-start-here)),
offline. The hand-labelled asks, mapped onto seven routes and split
development / calibration / locked test, with paraphrases of one scenario kept
in one split. Synthetic paired cases added for what the corpus lacks: negation
(*change* / *don't change*), with and without a selection, a request quoted
inside a document, *find* versus *create*, and the same ask before and after a
permission change.

Run three ways on identical inputs: **A** `categoriseAsk` mapped to routes
(the regex baseline, 84% on its own categories); **B** `local`, zero-shot,
route descriptions as criteria; **C** frozen EmbeddingGemma embeddings with a
linear head fitted on the development split. Jev on the home as a fourth
column, so the cloud judge is measured against the same set.

Thresholds chosen on calibration by the fast path's rule — on the winning
probability and its margin over the runner-up — and frozen before the locked
test is opened.

**Acceptance:** a page with accuracy among accepted answers, coverage,
confident errors on *do nothing* and unrelated asks, per route, with
confidence intervals, for all four. **The project continues only if B or C
beats A on the locked set at a coverage someone would use.** Target from the
test plan: ≥ 98% among accepted, ≥ 70% coverage — stated as a target, not a
promise. The real labelled set stays on the machine; a synthetic fixture is
what is committed.

## Phase 2 — Find by meaning, in shadow, then on

**Status: NOT STARTED.**

[Idea 3](ideas.md#3-find-by-meaning). The per-browser item index in OPFS,
built from items this person can read, updated as ops arrive, with a *Forget*
control. ⌘K gains *On this canvas* behind the switch. Measure top-five recall
on queries written by people who did not write the titles, against
`fuzzyMatch` on the same queries. Decide here whether `isocan find --like`
runs the model in Node or is honestly absent, and say which in the agent guide.

**Acceptance:** recall beats `fuzzyMatch`; the index survives a reload and is
gone after *Forget*; the network log is empty during a search; the switch off
leaves ⌘K exactly as it was.

## Phase 3 — The composer suggests

**Status: NOT STARTED.**

Idea 1 in the product, with [idea 4](ideas.md#4-clarify-before-spending)'s
clarify chips. Shadow first: the route is logged beside what the person
actually sent, per browser, as the voice shadow log is. Then on: a suggestion
line under the composer that becomes the person's own edit when taken. The
deterministic policy layer in core, with fixtures carrying intent and
disposition separately.

**Acceptance:** a person can see a suggestion, take it, decline it, and turn
the whole thing off; nothing is sent that they did not send; a read-only
canvas recognises an edit intent and refuses it in words. A
[walk](../../verify/README.md) for the feel of it.

## Phase 4 — The fast path, locally, in shadow

**Status: NOT STARTED.**

[Idea 2](ideas.md#2-the-voice-fast-path-locally). `local` answers the fast
path's five questions beside Jev on the same turns, and the shadow log gains
which judge said what. `thresholdFor` moves to core as its second caller
arrives. Nothing acts.

**Acceptance:** agreement and latency for `local` against Jev on recorded
turns, per act; `move` acts locally only if `local` earns its own threshold by
the same rule (≥ 95% agreement over ≥ 30 commands). A walk for the microphone.

## Phase 5 — Wireframe round 1, against the corpus

**Status: NOT STARTED.**

[Idea 5](ideas.md#5-wireframe-round-1-locally). Waits on the judge project's
corpus reaching its floor (about 470 rows). Then `local` scores every row
`isocan judge corpus` produced, and the reliability curve is drawn beside
Jev's.

**Acceptance:** a calibration page for `local` beside Jev's; the wire flow
gains `local` as a selectable answerer only if its curve is better.

## Later, unordered

Ideas 6–10 — who should take this, file it where it belongs, probably the same
thing, one thing two names, what needs me first — each becomes a phase only
after phase 1 says the instrument is worth more phases. And the multimodal
comparison: text vs text + retrieved context vs text + screenshot, on cases
where the picture should change the answer.

## Trajectory

- **2026-10-06** — Specified from Dion's EmbeddingGemma 2 test plan. The
  plan's six routes became isocan's own commands; its rules-only baseline
  turned out to exist already (`categoriseAsk`, 84%), and its "learned
  classifier" approach has labelled data waiting in three places — the evals
  hand labels, the voice shadow log and the judge corpus.
- **2026-10-06 — Open:** where the model is served from; the Gemma licence
  for redistribution; whether mobile can carry it; whether the CLI gets the
  model or an honest absence.

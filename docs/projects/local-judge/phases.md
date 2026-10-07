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

**Where we are, 7 Oct 2026:** phase 0 is CLOSED. The instrument is built and
measured ([the numbers](../../research/2026-10-07-embeddinggemma-in-the-browser.md))
and passes the warm-median bar: 33–35 ms on an M3 Max and 32–42 ms on an
iPhone up to 128 tokens. **local-judge phase 1 is next**, and is being built:
the harness and drafted labels need no person, and the locked-set verdict
waits on Dion reviewing the labels.

**One rule for every phase.** No phase may show a person a suggestion before
a phase has reported that use case's accuracy among accepted answers, its
coverage, and its threshold, measured on a split it was not tuned on — the
judge project's *calibration before use*, applied per use case.

---

## Phase 0 — The instrument, measured

**Status: CLOSED.** 2026-10-07 — built and measured; the warm median passes on the desktop (33–35 ms up to 128 tokens) and on an iPhone (32–42 ms; 142–179 ms at 512, under its 250 ms bar), and the privacy proof held offline with a browser-enforced policy.

*No product surface.* A `local` `Answerer` in a lazy Worker, the local
daemon serving the model and runtime from its own origin, a verb that puts
the model on disk, and a lab page that drives it.

- **The model on disk: `isocan model fetch embeddinggemma-2-text-270m`.**
  Downloads `embeddinggemma-2-text-270m.litertlm` (164,626,432 bytes) from
  `huggingface.co/litert-community/embeddinggemma-2-text-270m-litert-lm`,
  checks it against the pinned SHA-256
  `2d079ee2f6f066b1f368e8d7c819f55214eaef1d0513b312321901f30ab286fb`,
  refuses anything else, and writes it atomically to `~/.isocan/models/`
  (`ISOCAN_HOME`, beside `keys.json`). `isocan model ls` says what is there.
  A verb rather than a script because an agent's hands are the CLI.
- **The daemon serves it, loopback only**: `GET /models/<name>` from that
  directory, with a known-names allowlist (no path in, no listing out), and
  the MediaPipe runtime's wasm built into `packages/web/dist/` and served like
  any static asset. Vite's dev server proxies `/models` as it does `/api`.
  After the first load the browser keeps the model in Cache Storage.
- MediaPipe Decision Maker (`@mediapipe/tasks-decision` 1.1.0) with that
  bundle — not converted, not FP16. Record the SDK version, the model's hash
  and the sample commit the worker started from.
- The `local` `Answerer` speaks the existing `JevRequest`; a `JevQuestion`
  becomes a `ChoiceQuestion` in one pure function in core, tested.
- **A lab page** (its own Vite entry, not a route in the app, so the entry
  chunk cannot move) that loads the Worker and runs the measurements below.
- **Measured separately**, GPU and CPU reported apart: download bytes and
  time; init (load, compile, prewarm); first answer; warm p50/p95/p99 over at
  least 1,000 answers at 32, 128 and 512 tokens and with 7 and 30 options;
  input to displayed result; memory; and the canvas's frame census with the
  Worker busy. **The desktop numbers are measured here**, in a real Chrome
  driven by `scripts/lib/browser.mjs`. **The phone's are a person's walk**,
  written in `docs/verify/` for whoever holds the phone.
- **The privacy proof**: the model on disk, outbound network unavailable, the
  page reloaded, the measurements run again, and the browser's request log
  shows every request went to the daemon's own origin and none carried the
  state text, an embedding or an answer.
- The entry chunk's bytes unchanged.

**Acceptance:** `docs/research/` gains a page with those numbers and the
machine, browser, backend and token count beside each, and the offline run
recorded. **If the warm median is over 100 ms on the desktop, the page says
so and the project stops at this phase** until something changes. p95 and
the share of answers over the bar are reported beside it, not gated on. The
phone's median closes the phase when the walk is run; over 250 ms there stops
the project the same way.

**Formerly** the bar was warm p95, as the test plan proposed. Dion moved it
to the median on 7 Oct 2026, after phase 0 measured a 33–35 ms median beside
a 170–200 ms p95 caused by intermittent streaks. A suggestion that appears
while somebody types is judged by how fast it usually is, and how often it is
late is reported rather than gated on.

⚑ ~~Before any byte is served from isocan's own origin: a person reads the
terms, and decides where the bundle is hosted.~~ **Answered 7 Oct 2026 by
Dion**: the community LiteRT repo is ungated and its card says Apache-2.0,
which is accepted for now; the local daemon serves it from
`~/.isocan/models/`, fetched by the verb above. Hosted homes (isocan.io)
remain open.

## Phase 1 — Three judges, one set of asks, no UI

**Status: NOT STARTED.**

The Chat intent router ([idea 1](ideas.md#1-the-chat-intent-router-start-here)),
offline, with the state capped at 128 tokens (phase 0's bar holds there and
not at 512; a longer ask is recorded as truncated). The hand-labelled asks, mapped onto seven routes and split
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

- **2026-10-07** — Desktop warm p95 fails phase 0's 100 ms bar. The median is
  33–35 ms up to 128 tokens, but streaks of 170–220 ms answers put p95 at
  170–200, headed and headless; 512 tokens reaches 580–810. The project stops
  here by its own rule.
- **2026-10-07** — MediaPipe 1.1.0 posts metrics to `odml.pa.googleapis.com`.
  A `connect-src 'self'` policy enforced by the browser (the lab page's meta
  tag, plus the Worker script's own response header) blocks it, proved with
  the fetch guard off. Any host that serves the Worker must send that header.
- **2026-10-07** — MediaPipe 1.1.0's CPU delegate throws on every evaluation
  (its Asyncify build returns a plain value), so it is wrapped on CPU only.
  CPU answers in 0.8–3 s, about 25 times the GPU: a fallback that can never
  keep up with typing.
- **2026-10-07** — The model costs 1.2–1.7 GB of resident memory once loaded,
  and its runtime's 17.7 MB of wasm grows every `#release` install by about
  18 MB, whether or not anyone turns the judge on.
- **2026-10-07** — The phone cannot reach a laptop's loopback `/models`, and
  WebGPU needs a secure context. So the lab also takes a chosen model file,
  and the phone walk runs it from dev.isocan.io.
- **2026-10-07** — Dion moved the bar from warm p95 to the warm median (100
  ms desktop, 250 ms phone), with p95 and the share of late answers reported
  rather than gated on. The desktop passes up to 128 tokens and fails at 512
  (median 130–147 ms), so phase 1 caps the state at 128 tokens.
- **2026-10-07** — The phone walk (Dion's iPhone 17 Pro, iOS 27.0.1, Chrome
  for iOS, so WebKit's WebGPU) answered in 32–42 ms up to 128 tokens with no streaks: one slow
  answer in 1,200. The desktop's streaks point at Chrome's WebGPU on macOS,
  not at the model or MediaPipe.
- **2026-10-07 — Open:** the desktop streaks, which no longer gate but cost
  about one answer in five in Chrome on macOS. Untried: Safari on the Mac, a
  timed warm-up, MediaPipe's nightly, and the adapter's power preference. The
  phone run did not record memory.
- **2026-10-06** — Specified from Dion's EmbeddingGemma 2 test plan. The
  plan's six routes became isocan's own commands; its rules-only baseline
  turned out to exist already (`categoriseAsk`, 84%), and its "learned
  classifier" approach has labelled data waiting in three places — the evals
  hand labels, the voice shadow log and the judge corpus.
- **2026-10-07** — The licence and local hosting were decided before phase
  0: the LiteRT community repo is Apache-2.0 and ungated, and a person's own
  daemon serves the model from `~/.isocan/models/`, put there by `isocan
  model fetch`.
- **2026-10-07 — Open:** where a hosted home serves the model from; whether
  mobile can carry it; whether the CLI gets the model for `find --like` or an
  honest absence. The first waits on a person; the rest on phases 0 and 2.

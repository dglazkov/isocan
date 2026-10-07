# The judge in the tab — the mechanism

**6 October 2026.** Specified from a test plan Dion brought for running
EmbeddingGemma 2 as a browser-local decision model. Nothing is built. The
scenes are [`journey.md`](journey.md); the use cases are [`ideas.md`](ideas.md);
the walk is [`phases.md`](phases.md).

**The debt it discharges.** Three of them, owed by other projects:

- The [judge](../judge/design.md) project's seam was designed so that "the
  vendor is replaceable and a stub is a first-class implementation". It has
  one real vendor, Jev — a cloud call through the home, with a key, a price
  and a rate limit (`JUDGMENT_PER_MINUTE`, 60 a badge). Nothing has tested the
  claim that the vendor is replaceable.
- The [voice fast path](../voice-agent/fast-path.md) exists to beat the live
  model to a routine act, and spends a network round trip to the home to do
  it.
- Loop's finding
  [*lack of semantic query indexing*](../../loop/lack-of-spatial-canvas-semantic-query-indexing.md)
  is right on the code: every search in isocan is substring or fuzzy
  subsequence matching (`canvassort.ts`, `canvasswitch.ts`, the ⌘K palette,
  `ls --filter`, voice `find_items`). It is untriaged; this design is one
  answer a person may choose, not the decision.

## The sentence

> **EmbeddingGemma represents the context. The question scores the options.
> The policy decides what is allowed. A person's act is the change.**

Four layers, and the bugs in each must be told apart: a misunderstanding is
the model's, a permission slip is the policy's, and nothing is ever the
model's to execute.

## What the model is, and is not

Read from the sources the test plan cites, not measured here yet:

- **EmbeddingGemma 2** is an embedding model positioned for on-device
  retrieval, classification and routing. The text-only 270M LiteRT bundle is
  about **165 MB**. Its model card notes limits on complex tasks and language
  nuance. It is not a planner and is not a policy checker.
- **MediaPipe Decision Maker (Web)** puts a decision layer over the
  embeddings: categorical choices, yes/no questions and ordinal scores, on
  WebAssembly or WebGPU, with candidate options precomputed
  (`prewarmChoice`) before context arrives (`evaluateChoice`). It returns
  probabilities and a confidence. Google's sample runs it in a Worker.
- **A published browser figure** of about 22 ms text latency on a MacBook Pro
  M5 GPU is for a 128-token signature averaged over five runs. It is a hint,
  not a p95, and not a claim about a phone.

Every number above is the vendor's until phase 0 writes ours beside it.

## The seam: one more `Answerer`

`packages/core/src/jev.ts` already holds the seam this needs. An `Answerer`
has a name (`"jev" | "stub" | "home"`) and answers a `JevRequest` — a `state`
and named questions, each `noul` (yes/no), `choice` (a criteria map) or
`score` — with the full `probabilities`, a separate `confidence`, the
milliseconds and who answered. MediaPipe's `ChoiceQuestion`
(`instructions`, `criteria`, `normalizePrior`) is the same shape with
different spelling.

So this adds **`local`**, a fourth `Answerer`:

```ts
/** Answers in this browser, in a Worker, with EmbeddingGemma 2 through
 *  MediaPipe Decision Maker. `by` names the model revision and the backend
 *  that actually ran (gpu | cpu), because a CPU fallback is a different
 *  instrument and is reported apart. */
interface LocalAnswerer extends Answerer {
  name: "local";
  /** Load, compile and prewarm. Separate from answering so the cost of the
   *  first answer is never mistaken for the cost of every answer. */
  ready(questions: JevQuestion[]): Promise<Readiness>;
}
```

Three rules, each inherited rather than invented:

1. **Same questions, same answer shape.** A caller that asks Jev today can ask
   `local` without changing its question file. That is what lets phase 1
   compare the two on identical inputs, and what keeps a consumer from
   learning which judge it got.
2. **The stub stays first-class.** `local` is never the only path. Absent,
   refusing or slow, the caller falls back exactly as it falls back from Jev
   today.
3. **No new `Operation`.** A judgment is not a mutation. What a judgment
   *causes* is an ordinary op, attributed to the person who accepted it.

`thresholdFor` and `reliability` (the fast path's *lowest p at which
agreement is at least 95% over at least 30*, and its ECE) live in
`packages/modules/talk/src/fastpath-report.ts`. A second caller of the same
rule is the point at which it moves to core, per the house rule on shared
helpers — not a copy.

## Where it runs

```text
main thread                         Worker (lazy, opt-in)
───────────                         ─────────────────────
caller builds JevRequest  ──────▶  MediaPipe Decision Maker
  (state = compact text,             EmbeddingGemma 2 270M (LiteRT)
   structured facts kept aside)      WebGPU, else CPU — reported
                          ◀──────  probabilities, confidence, ms, by
policy layer (deterministic)
  → suggest · clarify · abstain · refuse
person's act → ordinary Operation → oplog
```

- **The first `new Worker` in the web app.** There is none today; the service
  worker is the only one. The Worker owns model init and every evaluation, so
  the canvas's frame budget is measured with it running, not assumed.
- **Outside the entry chunk, by construction.** The client is a dynamic
  `import()` at the moment the switch is turned on, the pattern
  `@isocan/core/jev` and the fast path's shadow already use.
  `test/bundle-budget.test.ts` is the guard; nothing here may move its number.
- **Opt-in, per browser, three positions** — off, shadow, on — the fast
  path's own switch shape (`isocan:voice:fastpath`). Shadow answers and logs
  but changes nothing a person sees, which is how every use case starts.
- **The download is the person's choice and is stated.** ~165 MB plus the
  runtime, cached for offline use. The switch says the size before it fetches
  anything, and a browser that cannot run it (no WebGPU and too little memory,
  measured by a probe rather than guessed) is told so in words and nothing
  downloads.
- **Where the bytes come from is open** (see Open). The privacy proof needs
  them self-hosted; the hosted home's image is the wrong place for 165 MB.

## The policy layer

Deterministic, in core, and the only thing allowed to turn an answer into a
suggestion. It reads the **structured state the app already knows** — never
asks the model to infer it:

| Condition | Behaviour |
| --- | --- |
| The act needs a selection and nothing is selected | Ask the person to select something |
| The canvas or item is read-only for this person (role, admission) | Recognise the intent, refuse the change, say why |
| The act is unavailable here (module absent, verb not declared) | Say it is unavailable — never silently pick the next-closest act |
| The canvas moved under the answer (`lastSeq` advanced on an item the answer names) | Discard the answer |
| The winning probability, or its margin over the runner-up, is under the frozen threshold | Abstain: clarify, or fall back to today's path |

Fixtures carry **two expected outputs**: the intent, and the permitted
disposition. *Edit this screen* on a read-only canvas is an edit intent that
is refused — never a different intent chosen because editing is blocked.

## Privacy, proved rather than implied

A local model makes a privacy claim possible; only behaviour makes it true.

- **Nothing the judge reads or writes leaves the browser**: the request, the
  state text, embeddings, answers and logs. The proof is phase 0's: assets
  provisioned, network disconnected, page reloaded, suite run, and the network
  log empty of all of it.
- **An item index is sensitive data, not anonymised text.** Embeddings can be
  inverted to recover much of their source text (Morris et al., EMNLP 2023).
  So the index lives in this browser's OPFS beside the voice shadow log, is
  built only from items this person can already read, is never written to the
  canvas or the home, and has a *Forget* control that deletes it.
- **Logs follow the shadow log's rule** — per person, per browser, capped,
  "never on the canvas and never on the home". An evaluation set made from a
  real canvas stays on that machine; what is committed is synthetic.

## Both surfaces

An agent's hands are the CLI, and the CLI runs in Node, not a browser. This is
the honest gap, so the checklist is answered now rather than at the end:

1. **Op vocabulary** — none added. Every accepted suggestion is an existing op.
2. **CLI verb** — the *intents* already have verbs (`/variation`, `mv`,
   `ls --filter`, mentions). What has no verb is semantic find; the open
   question is whether `isocan find --like` runs a Node build of the same
   LiteRT model or asks a browser, and phase 2 decides it. Agents are LLMs
   and need a judge least; that is not an excuse to leave one out.
3. **Agent guide** — a topic, written when a verb lands.
4. **Core** — the question files, the policy layer, the context serialiser
   and the threshold rule. The browser holds only the inference.
5. **README** — one line when a use case leaves shadow.
6. **Tests** — the policy layer and serialiser are pure and tested in core;
   the Worker, the download and the offline proof are driven in a real
   browser and said so.

## Open

- **Where the model is served from.** Self-hosted is required for the privacy
  proof. The content origin, a bucket, or the home — each costs something
  different, and the hosted image is the one place it should not be.
- **The licence.** EmbeddingGemma ships under Gemma's terms. Somebody reads
  them for redistribution from isocan's own origin before phase 0 ships a
  byte; this document does not claim it is fine.
- **Mobile.** 165 MB on a phone, and WebGPU on mobile Safari, are both
  measurements nobody has made here. [Mobile](../mobile/phases.md)'s
  Chat-first face is where Scene 1 matters most and where it may not fit.
- **Whether a zero-shot decision layer is enough**, or the representations
  are good and the boundaries are not. Phase 1 answers it by fitting a linear
  head on frozen embeddings — never by fine-tuning the model first.
- **Precision.** The model card warns that converting the base model to FP16
  can produce NaNs; start from the supplied quantised bundle and do not
  convert.

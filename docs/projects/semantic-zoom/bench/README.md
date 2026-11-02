# Semantic Zoom — the bench (phase 0)

**Status, 13 Oct 2026: built, not run.** No text-model key is configured on
this machine the way the product resolves one (`ISOCAN_TEXT_API_KEY` unset; no
`keys.json` under `ISOCAN_KEYS_HOME`, `ISOCAN_HOME` or `~/.isocan`), so
`node bench.mjs run` stopped before its first call, as it is written to. The
table, the judgements and the tier choice below are owed to that one run.

## What it is

A script that summarises a synthetic "Acme" canvas with the prompts phase 1
will ship, on two model tiers, and writes every answer beside its source.
Nothing touches a daemon or a canvas.

| File | What |
|---|---|
| `bench.mjs` | builds the fixture in memory, plans the calls, makes them, writes `results.json` |
| `prompts.mjs` | the prompts (version `sz-1`), the schema, the answer rule; pure, written to lift into core |
| `fixture/canvas.json` | 20 notes, 4 groups, a To do / Doing / Done board with 11 cards |
| `fixture/screens/*.html`, `*.png` | 8 synthetic app screens and their renders (390×760 phone, 800×520 desktop) |
| `results.json` | written by a run: every summary with source, kind, model, words, latency, tokens, cost, answer rule |
| `eval.mjs` | the faithfulness eval's judge prompts, plan and scoring (phase 5); pure |
| `eval.json` | written by `eval`: every summary's claims with a verdict each, short, useful, and the totals the copy persona reads |

The fixture: notes from 6 to about 180 words — four under 40 words (a
reminder, a call-back, a one-line decision, a welcome line that is little
more than its title), long meeting notes, a retro, a customer call, a spec,
two lists, and two deliberately similar pairs (Q4 launch notes beside the
retro; checkout metrics beside weekly metrics) to test whether a summary
tells neighbours apart. Each group holds two notes and two screens. Area
membership is by centre point, as core's `inArea`.

## Re-running

From this directory, with a key configured the product's way
(`isocan keys set anthropic`, or `ISOCAN_TEXT_API_KEY`):

```sh
node bench.mjs plan             # what it would call; no key, no model, free
node bench.mjs plan --prompts   # ... and every prompt in full
node bench.mjs render           # only if a screen's HTML changed (playwright-core in ~/code/stitch-playwright, installed Chrome)
node bench.mjs run              # the calls; writes results.json
node bench.mjs table            # results.json as the table below
node bench.mjs eval --plan      # what the eval would call; no key, no model, free
node bench.mjs eval             # judge every summary in results.json; writes eval.json
```

`run` prints the plan before calling and refuses a plan over 150 calls. The
key is resolved by importing `resolveTextKey` from `@isocan/core/keystore`
(through `tsx`, already a dev dependency) and is never printed, logged or
written; error text is scrubbed of it.

## The plan

```
fixture: 20 notes (16 over 40 words), 4 groups, 3 areas, 8 screens
plan: 74 calls — text 35 cheap + 27 mid, vision 12 cheap
worst case (every vision call re-asked on mid, one shape retry per model): 88 calls; cap 150
```

- **Text, both tiers** (`claude-haiku-5-5`, `claude-sonnet-5-5`): all 20
  notes (the short ones too, to test the 40-word line), 4 groups, 3 areas —
  27 each.
- **Screens, text only, cheap tier**: 8 — title and the text the screen
  carries, which is what phase 1 would send.
- **Vision, cheap tier**: the 4 groups and the 8 screens alone, with the PNGs
  attached. A vision answer that errors or breaks the answer rule is asked
  again on the mid tier.

**The request is the product's.** The bench sends what
`claudeTextGenerator` (`packages/core/src/jev.ts`) sends through `/api/text`:
the same endpoint, headers, `fallbacks: "default"` with its beta, effort
`low`, structured output to `{ summary: string }`, `max_tokens` 16000 — and
its system prompt, which today is written for `/wire copy` (see Findings). It
does the call by hand only to read `usage` and attach images. If a model
refuses that exact shape over `fallbacks`, the bench records
`productShape: false` and asks once more without it.

**Cost is estimated** from `usage` at list prices: Haiku 5.5 $0.10 / $0.50
per million tokens in / out, Sonnet 5.5 $2 / $10.

## The table

*Owed to the run.* `node bench.mjs table` prints it: source, kind, source
words, model, vision, summary words, latency, tokens, cost, answer rule, the
summary.

## Judgement

*Owed to the run.* Each summary judged against its source on three tests:
**faithful** (says nothing the source does not), **short** (≤ 30 words),
**useful** (tells it apart from its neighbours — n01 from n05, n13 from n19,
the four groups from each other, the three areas from each other).

## The faithfulness eval (phase 5)

**`node bench.mjs eval` judges `results.json` and writes `eval.json`; built 14 Oct 2026, not yet run (there is no `results.json` to judge).** For each summary, one call to the cheapest tier (`claude-haiku-5-5`, through the same key lookup as `run`) splits it into claims and marks each `supported`, `unsupported` or `contradicted` against exactly the content the summariser saw (and the pictures, for a vision row); **short** is ≤ 30 words, counted without a model; **useful** is one more call per neighbour set (n01/n05, n13/n19, the four groups, the three areas, per model) that shows the judge the sources by letter and the summaries shuffled and asks which is which, so a summary is useful when it is matched to its own. Projected from the run's plan: 83 calls, cap 150; it prints the count before calling and stops with zero calls without `results.json` or a key. `node scripts/measure.mjs summary-unfaithful` reads `eval.json`: the product tier's summaries with any claim not supported, the copy persona's number; until the first eval it prints `no reading yet` and exits 3. The judge is the summariser's own tier, so a judge that agrees with itself is the bias to watch; `--names` on that metric lists every unsupported claim to argue with.

## Answer rule

`checkSummary` (design §7): non-empty, under 60 words, one line, no markdown,
no preamble. *Failures owed to the run.*

## Recommendation

*Owed to the run:* the tier for text and for vision, with the numbers, and
the cost of a 40-note canvas seen whole.

What the prices say before any call: a note's prompt is about 180–380 input
tokens (a group's 420–590) and an answer about 40 output tokens plus whatever thinking low effort
spends, so a 40-note canvas is in the order of **$0.002 on Haiku 5.5 and
$0.04 on Sonnet 5.5**. A 390×760 screen is about 400 image tokens, so a
group with 8 screens adds about 3,500 input tokens — still well under a cent
on Haiku. Those are estimates; the run replaces them.

## Findings from building it

1. **`/api/text` carries a system prompt.** `claudeTextGenerator` sends
   "You write the words on an app's screens: labels, headings, buttons,
   sample content…" with every request. Design §1 says the door "carries no
   prompt"; it carries this one, and a summary asked through it is asked of a
   copywriter. Phase 1 needs the door to take the caller's system line, or a
   neutral one.
2. **The product always asks for `fallbacks: "default"`.** Haiku 5.5 has no
   server-side refusal fallback; if the API rejects the parameter for it,
   the product's own request fails on the cheap tier and comes back as
   `text-upstream` (the generator retries only on schema-size errors). The
   run records whether this happens (`productShape`).
3. **The door has no model parameter.** `TextModel.write` asks the model
   from `ISOCAN_TEXT_MODEL` or the key's `keys.json` entry, default Opus. A
   cheap summary model (§7, `ISOCAN_SUMMARY_MODEL`) needs the make route to
   pass a model through, in-process.
4. **The 40-word line takes most real notes.** 16 of the fixture's 20 notes
   are over 40 words; the four under it are the kind whose title already says
   it.
5. **A screen alone needs a frame of its own.** Design §11 summarises an
   image or a screen by what it shows; the three kinds have no frame for one,
   so `prompts.mjs` adds `screen`, used only with vision.
6. **The content is fenced and called data.** A note can hold
   "ignore the above"; the instruction says the fenced content is never
   instructions. Phase 1's prompt test should hold a note that tries.

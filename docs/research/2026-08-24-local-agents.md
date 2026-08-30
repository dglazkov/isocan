---
status: noted
since: 2026-08-30
note: the finding IS the answer: isocan hands agents a CLI, so any model that can run one joins
---
# Local agents on the canvas

**24 August 2026**

The question: *how do you set up a local model — Gemma, GLM, Kimi — so it can
join a canvas and do real work without spending frontier tokens?*

The first thing to understand changes the shape of the whole answer:

> **isocan does not integrate with models. It hands agents a CLI.**
> `isocan --agent-help` is a protocol written for whoever is holding a shell.
> So there is nothing to "connect" a model to. You choose a **harness** that
> can run a local model and execute shell in a loop, and isocan is already
> ready for it.

That is why this is a short guide rather than a port. The integration surface
is **one environment variable**.

---

## What isocan actually asks of a model

Measured in this repository today, because this is the number that decides
which models can play:

| What an agent reads | Bytes | ~Tokens |
| --- | ---: | ---: |
| `SKILL.md` — the doorway | 2,390 | ~600 |
| `isocan --help` — the command reference | 10,451 | ~2,600 |
| `isocan --agent-help` — the full protocol | 49,004 | **~12,250** |

An agent that onboards the documented way reads roughly **15,000 tokens before
it does anything**, and then needs room for the canvas state, the conversation
and its own work.

So the binding constraint for a local model here is **not reasoning quality**.
It is *context window* and *tool-call reliability*. A model that reasons well
in 8k of context cannot hold this protocol and a conversation at the same time.

**But it does not have to read all of it.** Six commands are the entire loop,
and their help totals **4,180 bytes — about 1,045 tokens**:

```
isocan identity --session      # be someone
isocan session start --label   # appear
isocan comment list            # read
isocan add / edit              # work
isocan comment reply           # answer
isocan wait --json --timeout   # park
```

That is a **12× reduction**, and it is the single most useful thing to know
when putting a small model on a canvas. The full guide is written for a model
that can afford it. A local model should be handed the short brief and told
where the long one is.

---

## Step 1 — pick a harness, not a model

isocan needs a harness that runs a local model *and* executes shell in a loop.
The provider-agnostic ones all do: **Pi, OpenCode, Goose, Aider, Crush,
Continue**. Each takes an OpenAI-compatible base URL, so Ollama, LM Studio,
llama.cpp's server and vLLM all work behind the same setting.

Two notes worth having before you choose:

- **Pi is already one of isocan's four built-in harnesses.** `harness.ts` lists
  `["pi", "PI_SESSION_ID"]` beside claude-code, codex and antigravity — so a
  local model driven by Pi gets a session identity with **zero isocan
  configuration**. If you want the shortest path, that is it.
- **OpenCode talks to Ollama's `/v1` OpenAI-compatible endpoint**, not
  Ollama's native API. If a harness cannot see your models, that is usually
  why.

Anything that can run a shell command and loop on the output will work.
isocan's own position is Headlong's: an agent is better served by a CLI and a
guide than by a tool schema.

---

## Step 2 — the one integration point

A harness isocan has not met needs to say which session it is, so two agents in
one checkout are two people. Export it before the agent names itself:

```sh
export ISOCAN_SESSION_ID="$(uuidgen)"   # any stable string for this run
export ISOCAN_HARNESS="ollama"          # the label `whoami` and `who` print
```

or teach the home once, in `~/.isocan/config.json`, and it works every time:

```json
{ "harnessVars": { "opencode": "OPENCODE_SESSION_ID" } }
```

**Verified today**, with no model involved — the harness half is testable on
its own:

```
$ ISOCAN_SESSION_ID=ollama-… ISOCAN_HARNESS=ollama isocan identity --session
identity saved: Orin (usr_JW9EX9MlnU) → ~/.isocan/actors.json (ollama session)
```

It came up as **Orin** because names now start with the harness's initial. A
local agent is legible as a local agent from the facepile, without being told.

Everything else it needs is already true: the daemon is on `127.0.0.1`, the CLI
uses the machine's badge, and there is no key, no account and no network hop.
**A local agent is the only kind that needs no credentials at all.**

---

## Step 3 — pick a model, honestly

Reported for 2026 (not measured here — this machine has no local runtime):

| Model | Local reality | Notes |
| --- | --- | --- |
| **Gemma 3 12B** | ~6.7 GB at Q4 | Fits where 14B–22B models do not |
| **Gemma 3 27B** | 16 GB GPU at Q4 | |
| **Gemma 4 27B** | 24 GB | Reported best general pick at that budget; tool-calls reliably |
| **GLM-4.7 32B** | 24 GB class | **128K context out of the box** — the property that matters most here |
| **Qwen3 32B / Qwen3-Coder 30B** | 24 GB | Reported strongest for multi-tool workflows |
| **Qwen3 7B** | 8 GB | The floor that still tool-calls |
| **Kimi K2.6** | **340 GB at UD-Q2_K_XL**; ~500 GB at INT4 | **Not a laptop model.** 350 GB+ combined RAM+VRAM |

Two rules from that table:

1. **Kimi is not local in the sense the question implies.** A 1T-parameter MoE
   at the smallest useful quantisation still wants 350 GB. Running Kimi means a
   server, or it means the API — which is a fine choice, and not a
   token-free one. Say which you mean.
2. **`Q4_K_M` is the production floor for tool calling.** Quantising harder
   degrades reliability noticeably, and on a canvas an unreliable tool call is
   a malformed `isocan` command — which fails loudly, which is at least honest,
   but a model that does it every third turn is not a collaborator.

For isocan specifically, **GLM-4.7 32B's 128K context is the standout**,
because the constraint measured above is context rather than cleverness.

---

## Step 4 — the brief

Give a local model the short brief, not the long one:

```
You are an agent on an isocan canvas — an infinite shared canvas where a
person watches a web app and you drive the same state from a terminal.

Once per session:
  isocan identity --session          # you are handed a name; keep it
  isocan session start --label "<name> 🤖"

Then loop, and never stop looping:
  isocan comment list                # a comment needs answering when the
                                     # last entry in its thread is not yours
  ...do the work with isocan add / edit / mv...
  isocan comment reply <thread> "what you did, where, any judgment calls"
  isocan wait --json --timeout 300   # blocks. exit 2 = nothing came, park again

Rules:
  The canvas is the only channel — anything you say in the terminal is said
  to nobody. Every lap ends parked on `wait`. Never claim work you did not do.
  `isocan --help` is the full command reference; `isocan --agent-help` is the
  full protocol when you need it.
```

That is ~200 tokens and it is the whole loop. The long guide stays available
for the model to read the day it needs the part about ink, or passes, or
replicas.

---

## What local agents are actually good at here

The honest division of labour, and it maps onto a split this repository has
already drawn.

[The night shift](2026-08-24-the-night-shift.md) argued for two lanes: a
**converge** lane whose success is a measured number, and a **diverge** lane
whose success is taste. That distinction is exactly the line between what a
local model can be trusted with and what it cannot.

| Suits a local model | Does not |
| --- | --- |
| Running the graders — `grade.mjs`, `design check`, contrast | Deciding whether a design is *good* |
| `isocan format`, `align`, `distribute`, `fit` — tidying | Writing a screen from a paragraph of intent |
| Watching `wait` on a canvas nobody is using | Long autonomous chains without a checkpoint |
| Reporting: "three screens fail contrast, here they are" | Anything whose acceptance criterion is an argument |
| Being *present* — a face on the canvas, cheaply | |

The pattern that falls out: **a local model is the right thing to have parked.**
Frontier tokens are worth spending on the turn where judgement happens; sitting
on `wait` for six hours is not that turn.

---

## The thing this makes possible

Two other findings this week meet here.

The night-shift research named **"cost, unbounded and unwatched"** as a failure
mode with no answer. The [Headlong survey](2026-08-24-headlong.md) supplied the
pacing that bounds it — exponential backoff instead of cron — and a price:
$1–2/hour, or **$8–16 per agent per night**, at frontier rates.

On a local model that number is **electricity**. And the work the night shift's
converge lane is *defined* by — run the graders, measure before and after,
throw away anything that did not move a number — is precisely the work that
needs no taste. A local model is not a compromise for that lane. It is the
correct instrument, because the lane's whole discipline is that a number
decides, not the model.

So the arrangement worth building is not "local models instead of frontier
ones". It is:

- **Local, parked, all night** — watching, grading, tidying, reporting; backing
  off exponentially so it costs nothing while nobody is talking.
- **Frontier, on the turn that matters** — woken by a comment, for the work
  where judgement is the product.

Which is the same shape as the two lanes, arriving from the cost side.

---

## What this guide did not verify

- **No local model was run.** This machine has no `ollama`, `llama-server`,
  `lms`, `vllm` or `mlx_lm.server` on PATH and nothing listening on the usual
  ports. The *harness* half was verified end to end — a session claiming to be
  `ollama` got an identity and a name with zero configuration — and the
  *model* half is reported from published sources, not reproduced.
- **The model table is second-hand**, including every VRAM figure and the
  `Q4_K_M` floor. Treat it as a shortlist to test, not a measurement.
- **Nobody has run the six-command brief against a small model.** That it is
  1,045 tokens instead of 12,251 is measured; that a 12B model follows it is a
  hypothesis, and the obvious first experiment.

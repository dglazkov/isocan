# Provision for the first measured comparison

**Status: preparation verified; execution awaits approval and compatible authentication.**
The actual source materialization, study tools, independent assessment, review
instruments and full repository gates pass. The exact [verification record](verification/phase-7.md)
makes the following request reviewable. No generated designs, participant
sessions or human ratings exist for this study.

The next decision buys a bounded smoke test of the actual baseline and candidate.
It does not authorize the full study, participant recruitment, optional craft
condition or a production default. [execution.md](execution.md) defines the
method; [evaluation.md](evaluation.md) defines its quality gates.

## Proposed first tranche

| Field | Proposed bound |
| --- | --- |
| Matrix | 16 generations: inventory, brand extension, imagery and small edit × canvas chat/external agent × A/B, one repetition |
| A | Actual source `304346276dbabd3b7c10dff3f55070dbcff10ab2` and its independently measured build |
| B | Actual candidate `08bbf1017213b2d7a24b269384e1861481958ae7`; optional craft guidance unused |
| Model | `claude-sonnet-5`, high effort; exact returned model identity required, no fallback |
| Native harness | Claude Code 2.1.269, pinned binary and explicit local tool server; `--bare` isolated profile |
| Tools | Actual source-bound CLI, contained task files, browser for task outputs/connected fixture and explicit evaluator answer queue; no extra model/agent, web search or image generation |
| Execution | One native process/run, serialized; no implicit retry or new session for a question |
| Time and turns | 15-minute overall deadline and 60 total agentic turns/run, including interaction |
| Tokens | Requested 8,192 output tokens/turn; observed cumulative 4,000,000 input/cache/output tokens/run; record requested and observed limits separately |
| Native cost stop | $2 estimated/API-equivalent usage per run |
| Reservation | $8 before launching each run: $2 stop threshold plus $6 in-flight headroom |
| Aggregate | At most $40 API-equivalent usage authorized for the tranche; no launch unless its full $8 reservation fits |
| Stop rule | Missing accounting, model/tool mismatch, overrun, broken routing, lost context, unusable output or unaffordable cell stops further launches; preserve all attempts and unresolved reservations |

The source price table lists Sonnet 5 input/output at $2/$10 per million tokens;
cache categories are separate. Headroom uses the documented model maximums,
not an assumption that the requested output limit is honored: 1M input tokens
at the highest $4/M cache-write rate plus 128K output tokens at $10/M is $5.28.
The $6 reserve rounds that upward. Recheck the profile, provider and rates before
execution. [Official pricing](https://platform.claude.com/docs/en/about-claude/pricing),
[model limits](https://platform.claude.com/docs/en/models/overview).

The isolated study browser cannot operate the authenticated canvas UI. Canvas
state is available through the actual bound CLI; generated pages and the fixed
connected app run in the owned browser. Both arms receive the same limitation.
The separate local and hosted acceptance walks cover the product canvas itself.

These are estimated/API-equivalent accounting limits, not invoice evidence.
The native CLI stops after its accounted threshold; it cannot undo an in-flight
request. The outer journal reserves headroom first and does not spend an unknown
charge twice. An observed token limit can likewise be exceeded by the request
already in flight. A mismatched or unaccounted result cannot become a valid study
row merely because its output looks useful.

The $40 aggregate may stop the matrix before all 16 cells finish. That produces
an incomplete smoke test, with all failures and costs retained. It never grants
permission to raise the limit or omit expensive failures from the denominator.
Record actual usage and facilitator effort to estimate the full comparison;
do not claim this smoke tranche proves a workflow quality advantage.

## Runnable preparation and execution handoff

The entry point is [`scripts/design-partner-execute.mjs`](../../../scripts/design-partner-execute.mjs).
Its `--help` prints the complete option contract. Preparation and inspection
make no provider calls; only explicit `run` can launch the pinned native agent.

| Mode | Concrete result |
| --- | --- |
| `prepare-source`, `inspect`, `materialize` | Separate source-bound builds and all twelve cases on both entrances; each run starts from one verified canvas |
| `profile`, `manifest`, `validate` | Measured native/tool identities, exact input maps, explicit ceilings and a separate approval record |
| `run` | One approved planned cell; durable reservation, one native process, private question queue and final capture |
| `answer` | Explicit evaluator fact/disposition; typed canvas answers use the synthetic person's own CLI |
| `collect`, `assess`, `evidence` | Exact final HTML/support files or repository, independent declarative task observations, then provenance validation |
| `review`, `serve-review`, `analyze` | Three neutral packets with empty scores, private condition key and the preregistered comparison |
| `partnership` | The committed six-person task/order schedule with empty consent and observation fields |

Keep a run's journal, runtime, captured result and assessment under the same
owned evidence root; keep the condition key outside the served review directory.
The `run` command derives that evidence root from the journal's parent. Inputs
and outputs name new paths: implicit overwrite or retry is not an execution mode.
The [verification record](verification/phase-7.md) identifies the prepared
manifest and the commands actually exercised in this session. A later machine
rebuilds its own manifest and obtains approval for that exact identity; copying
an old approval into a changed profile is invalid.

## Actual prerequisite still missing

The prior read-only check confirmed a working subscription login, but the
prepared `--bare` profile does not use OAuth/keychain authentication. Its native
help requires an API key or explicit approved key helper. An owned empty
configuration-directory probe did not discover an authenticated session, and
no API key was present in the inherited environment. No credential value was inspected,
copied, migrated or stored in these records. The check observed status only.

Configure `ANTHROPIC_API_KEY` in the execution environment through the provider's
normal local credential mechanism, outside the repository and this conversation,
then rerun the exact profile's read-only preflight. This prepared runner accepts
that environment-based method; an approved key helper would need separate
profile support and verification. Alternatively, a different isolated
profile must be proved and frozen as a new manifest before execution; the old
OAuth readiness result cannot stand in for that proof.
[Authentication modes](https://code.claude.com/docs/en/authentication).

## Human work and subsequent decisions

An evaluator must be available to map actual questions to frozen facts, handle
unmapped questions explicitly and inspect the delivered primary task. Budget
up to four hours for the 16-run smoke window plus preparation and review; actual
attention and model waiting time are recorded separately. This is a ceiling
based on 16 × 15 minutes, not a prediction of active evaluator time.

Reserve another roughly 1.5–3 evaluator-hours for sixteen independent final-task
checks, including both target widths and failure/correction states. This is a
planning estimate of about 5–10 minutes per delivered task, not measured study
time; broken artifacts may take less time to reject and diagnosis may take more.
Record this work separately from agent/browser tool time and design rating.

Three reviewers who did not produce the artifacts receive neutral packets and
empty rating forms. Allow roughly 60–90 minutes each for calibration and the
smoke pairs. Reviewers supply their own ratings; a missing reviewer is missing
evidence. The full 96-generation A/B comparison and optional 48 C generations
require a reviewed smoke result and their own approved ceiling.

The six-person partnership pilot has its own [protocol](partnership-study.md)
and frozen [task cards](study-tasks.json): 6–7.5 participant-hours, facilitator
time, any compensation, up to 12 primary runs and six optional returns. None
of that effort or usage is included in the smoke grant. No participant contact
or payment is authorized by preparing these documents.

Broad enablement still requires the independent quality and partnership results,
actual hosted acceptance and a product decision. The existing shared policy
remains opt-in, and the adapter requires its own incremental result.

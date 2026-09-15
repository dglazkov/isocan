# Frozen design-partner creation corpus, set 1

These twelve synthetic tasks implement the initial corpus in
[`evaluation.md`](../../../docs/projects/design-partner/evaluation.md).
They contain inputs and acceptance expectations, **not generated candidates**.
No provider or browser is invoked by the preparation command.

```sh
node scripts/design-partner-eval.mjs --dry-run --out /tmp/acme-design-matrix.json
node scripts/design-partner-eval.mjs --validate /tmp/acme-design-matrix.json
node scripts/design-partner-eval.mjs --dry-run --study smoke
node scripts/design-partner-eval.mjs --dry-run --include-c native
node scripts/design-partner-eval.mjs --baseline inventory --entrance canvas-chat
node scripts/design-partner-eval.mjs --baseline inventory --entrance external-agent
npx vitest run test/design-partner-eval.test.ts --maxWorkers=2
```

`--out` creates a new file exclusively; it cannot silently replace evidence.
Without it, output is JSON on stdout. `--fixtures` selects a copied fixture
root for negative controls. `--seed` changes paired execution order. There is
no model, network, provisioning, image-generation or paid-execution mode.

The default manifest contains 96 cells: 12 cases × two entrances × two repeats
× A/B. The smoke manifest contains 16: four named diverse cases × two entrances
× A/B. Smoke work is additional unless identical cells are explicitly reused.
An explicit `--include-c native` or `--include-c adapted` adds 48 full-study
cells; the package revision and its actual mode stay distinct. Capability
availability is `not-probed`, resource ceilings are unapproved/null, provider
use is false and cost is zero. A dry matrix contains no quality observations.

## Inputs and identity

`corpus.json` fixes the case list, protocol revision, smoke subset and hashes
of every task and input file. Each case directory contains:

- `task.json`: instruction, delivery type, initial known facts, the common
  fact/answer bank, reference availability, both entrances, target widths,
  primary task steps and forbidden regressions.
- `snapshot.json`: initial canvas/group, selected item IDs, identified input
  versions, existing decisions, and a repository manifest where applicable.
- Literal local references, data, SVG, HTML and/or source files.

The snapshot is a **seed specification**, not an assertion that a live canvas
already exists. Before a later measured run, its adapter must create the
isolated canvas and groups, materialize every listed item with its retained
identity and bytes, bind the agent workspace, and then dispatch the request.
It must record that real runtime. All available supplied files become initial
canvas items, even when no item is selected; ordinary canvas list/read tools
must expose them in both conditions. Both entrances bind to the same primary
group and selected IDs. Repository files belong in the actual connected
workspace. The manifest retains their input digest separately.

Input identities are part of each planned cell. Completed result context must
match its seeded item/version/blob set, not merely repeat a manifest hash.
A failed attempt that could not read context can explicitly record
`context.state: "unavailable"`, empty items and `unavailableReason`; it cannot
be counted as a completed output. Later adapters must preserve fixture IDs or
add an explicitly validated fixture-to-runtime identity mapping before use.

`reference.md` contains the facts initially supplied by the person. The answer
bank is evaluator-only: it gives the same matching fact to A, B or C when
asked. `answerFromBank(task, factId)` retrieves a stable fact. The evaluator
records the actual question and the selected fact key; it must not silently
give B all the facts or put task scoring expectations into the generation
prompt. An unknown question returns no supplied fact. A different answer bank
or changed case is a new corpus revision.

The inaccessible URL uses the reserved `.invalid` domain and has an explicit
unavailability reason; no offline check fetches it. The adversarial reference
is intentionally untrusted input data. Its text never becomes a task
instruction. All synthetic claims and illustrated landscapes are identified
as synthetic. Fixtures contain no production-canvas data.

| Case | Important inputs and control |
| --- | --- |
| `inventory` | Stock CSV, sparse initial request, receiving/correction task |
| `appointments` | Service lengths, mechanics and unavailable slots; sequencing |
| `analytics` | Queue totals and ticket rows; comparisons and drill-down |
| `brand-extension` | Scoped system and a runnable existing component/API repo |
| `marketing` | Limited supplied test proof; no invented testimonials |
| `imagery` | Original local landscape SVG, itinerary, unavailable image generation |
| `reading` | Long article, section navigation and footnote return |
| `field-task` | Equipment/checklist, required flagged note, 360 px primary width |
| `accessible-form` | Keyboard path, linked errors, retained form input |
| `small-edit` | Existing functioning signup HTML and exact requested copy change |
| `reference-integrity` | Available facts, adversarial input and unavailable URL |
| `follow-up` | Accepted human direction, receiving screen, governing and adjacent systems |

The `brand-extension/repo` fixture has no dependencies. `npm start` there
starts a Node HTTP server on a loopback ephemeral port and prints its URL.
It serves an existing `<acme-card>`, tokens, an overview, and `/api/stock`.
The requested stock-lookup screen is deliberately not already implemented.
The unit test actually starts this repository and reads its HTTP resources;
that checks fixture executability, not generated design quality or browser UX.

## Runnable condition A

`baseline/baseline.json` fixes main revision
`304346276dbabd3b7c10dff3f55070dbcff10ab2` and hashes the exact source files,
full guide, external collaboration doorway, rendered manual-command registry,
and type-erased original summons function. The hosted orientation source is
also retained; local and hosted harnesses must be separate capability strata
if their capabilities differ. This is a source baseline, not a claim about
a deployed build.

`--baseline <case> --entrance <entrance>` calls the preserved summons function
for canvas chat or renders the original direct instruction for an external
agent. It emits a provider-neutral invocation envelope, on-demand guide and
all current manual commands, source inputs, and a pinned-runtime specification.
It neither creates a design nor calls a model. Baseline sources are preserved
locally so later edits to the live guide cannot silently change condition A.

A measured executor must use a separately prepared checkout at the recorded
revision and the stated CLI entry; use the same model, harness discovery, tools,
available facts and ceilings as its matched condition. Preserve all current
capabilities, including manual design commands and design-lint feedback.
Do not auto-inject those commands as an additional baseline design procedure.
Reference bytes are data, not harness instructions. Before execution, verify
the prepared runtime revision; simply attaching this old source SHA to a
new runtime is not a baseline. Phase 0 does not set up that host or measure it.

## Actual-result validation is not comparison approval

The result validator is deliberately separate from the repair-only pilot's
model provider, scoring schema and fixed schedule. It follows that pilot's
literal hashed inputs and evidence-file checks without inventing another
model execution engine.

```sh
node scripts/design-partner-eval.mjs --validate /path/to/results.json \
  --manifest /tmp/acme-design-matrix.json
```

An actual result set has `schemaVersion: 1`, `kind: "design-partner-results"`,
`mode: "actual"`, `manifestSha256` (SHA-256 of `JSON.stringify(manifest)`), and
`records`. Each record is checked by `validateActualResult` in
[`design-partner-eval.mjs`](../../../scripts/lib/design-partner-eval.mjs):

- Run/request/fixture/entrance/condition/repetition identity, source revision,
  prompt digest, procedure and protocol revision; exact seeded context.
- Requested and resolved model/revision, explicit provider use/call count,
  harness/revision/tools, browser/image/repository capabilities and reasons.
- Authorized cost ceiling and actual model/tool USD, or explicitly unavailable
  cost; input/output/cache tokens; fixed token/time/repair ceilings.
- Start/end and first-useful-visual times, original question/answer transcript,
  repair count, unresolved failures and explicit readiness.
- Canvas item/version/blob identity or repository revision/build/runtime
  identity; a local artifact file and its hash. Each check names its tool,
  revision, artifact/context hashes, evidence file, and relevant task/viewport.
- Terminal `completed`, `failed`, `timed-out`, `abandoned` or `unavailable`
  outcome. A missing artifact is valid only as an unsuccessful attempt with
  its reason. Human quality is `unmeasured`; a separate blinded instrument
  must gather the ratings later.

The validator reads the actual artifact/evidence bytes and checks hashes.
Ready status requires current primary-task evidence and every target viewport;
source diagnostics cannot stand in for browser evidence. Schema validation
cannot certify that a submitted observation is truthful or prove good design.

Every result-set validation reconstructs the manifest from the actual frozen
inputs. It rejects missing arms, fabricated empty matrices and altered input
identities. Missing attempts remain listed in the full denominator; timeouts,
failures and unknown spend remain visible. Model/capability/ceiling mismatches
are reported as unmatched pairs.

**Every phase-0 report is `comparisonEligible: false`.** `valid: true` means
evidence shape and file integrity only. The candidate procedure, common model,
capability strata and spend authorization have not been frozen. A later phase
must add a separately authorized execution manifest and runner before these
records can support a controlled comparison. This distinction keeps a complete
but unfrozen or mixed set from becoming an invented quality baseline.

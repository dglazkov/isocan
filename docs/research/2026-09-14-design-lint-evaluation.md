---
status: partial
since: 2026-09-14
issue: 302
see: design-lint, evals, design-competition
note: A frozen six-task harness measures actual conditional repairs, stored-byte browser behavior and separate cost/coverage outcomes. Canned runs prove instrumentation only; the approved model comparison and human intent ratings remain pending.
---
# A repair experiment needs a trustworthy instrument first

Design-lint phase 5 asks whether actionable findings improve a bounded HTML
repair. The source-checkout harness compares rules-only and rules-plus-findings
conditions over six synthetic tasks, three repetitions and at most two correction
attempts: 36 runs and at most 72 evaluation model invocations. The
[preregistration](../projects/design-lint/evaluation.md) fixes its inputs,
conditions, invariants and decision before model runs. No evaluation model call
or human study rating is represented by the dry-run evidence.

## What the harness actually exercises

Every run gets a fresh local daemon and synthetic canvas. The host reads a real
audit, submits candidate HTML through the shipped captured repair API, then
reads, audits and renders the stored bytes. The selected and adjacent design
documents and their version histories stay fixed. Identical clean output creates
no new version. A separate real concurrent edit proves that a stale capture is
refused. This measures correction feedback under supplied context; autonomous
tool selection and discovery of a live canvas are outside this pilot.

The 26 literal fixture files were frozen before the browser scorer existed.
Their SHA-256 aggregate is
`00ba41f97cdfebcd200113b7605d59cb211bb3345b10c9089fc290ee528d17b9`.
The initial finding counts are 1, 2, 1, 8, 1 and 0 for spacing, ink reference,
type shorthand, Button treatment, scoped lane and clean control. All six
repaired controls have zero findings and complete native coverage. The borrowed
lane value also passes under the adjacent document, so the scope task tests the
selected authority rather than an intrinsically invalid value.

Chrome checks actual DOM, computed styles, text paint, clipping, occlusion,
semantic elements, keyboard focus and a native button/popover response at
390×844 and 1280×900. Page scripts and external HTTP/HTTPS/file requests are
blocked; the native interaction still works. Newly introduced dynamic styling
remains a separate static-coverage failure. These checks do not stand in for
human intent or comprehensive accessibility review.

The occlusion check samples actual DOM geometry conservatively. A transparent
overlay may fail it; passing is not pixel-perfect visibility certification.
Independent review found that merely opening a popover let transparent response
text pass. The final interaction predicate applies the same paint, clipping and
occlusion requirements to the response as to the initial content.

All six initial/golden pairs and the failure controls run before a candidate
provider can start. Empty pages, hidden/clipped/covered/scaled text, lost styles,
removed or renamed recipe identity, new uncovered styling, broken interactions
and changed governing/adjacent histories cannot become completed tasks. A
zero-byte candidate is separately an authoritative storage refusal; it is not
evidence that an empty page was rendered. Invalid output consumes an attempt,
retains the actual stored screen for review, and can end as a failed task after
two replies without making its known coverage disappear.

## Run and review it

Use an installed source checkout with its ordinary dependencies and an existing
Chrome/Chromium executable. No new application package or browser download is
required. Choose a fresh output directory:

```sh
node scripts/design-lint-eval.mjs --dry-run --out /tmp/acme-design-eval
node scripts/design-lint-eval.mjs --summarize /tmp/acme-design-eval
```

The dry provider supplies labelled canned candidates. The spacing task retains
the original on its first attempt and repairs on its second in both conditions;
the other tasks exercise first-attempt repair and unchanged clean output.
The harness records exact prompts, source and fixture hashes, captured versions,
receipts, stored HTML, audits, screenshots and attempted out-of-scope edits.
Required named source hashes include the analyzer, contract, parser, resolver,
API and harness files plus the dependency lock; this is not a transitive
fingerprint of every platform input.

`review.html` presents 18 blind pairs, initial references and both viewports.
`review.json` keeps intent and preference pending; `arm-key.json` is separate
from the page and should be withheld from the rater. Downloaded ratings are
bound to the exact candidate/image manifest, and stale, duplicate or missing
pairs are refused. To summarize a later real run after a person rates it:

```sh
node scripts/design-lint-eval.mjs --summarize /tmp/acme-real-eval --ratings /path/to/ratings.json
```

The summary distinguishes incomplete evidence, ceiling effects, the declared
completion/round/cost thresholds, interaction failures, additional uncovered
styling and human intent loss. Dry mode always reports instrumentation only,
even if explicitly synthetic test data is constructed to favor one condition.

## Independently observed dry run

On source base `0fa80ee5`, the complete command exited 0 with 36 runs and 42
canned candidate attempts: 30 saved repairs and 12 unchanged results, across
36 distinct synthetic canvases. All 42 selected/adjacent document snapshots
retained their bytes and full histories. The conductor independently checked
stored-byte, audit and browser hashes, all 19 named source hashes and all 108
review images. The six clean runs made no content version; the six spacing
runs needed the intentionally unrepaired first attempt and repaired second.

All 13 stored-output/policy negative controls passed, as did actual stale-write
refusal and the two-invalid-output failure case. A separate real Chrome probe
checked 19 cases at both viewports: six valid renders, twelve visible or
interaction failures, and a script case that remains a native coverage failure.
Nineteen model-boundary controls and sixteen summary controls used explicitly
synthetic provider/rating data. They performed no evaluation model invocation
and supplied no human study judgment.

The conductor opened the actual blind review in Chrome, verified all 108 images,
four intent choices, hidden condition names and a real download click. Its
in-memory synthetic selection was not ingested; the saved review stays pending.
The actual summary says `instrumentation-only`, with model lift, comparable
cost and human ratings unavailable. Browser: Chrome 152.0.7977.84; Node 24.13.0;
native rule version 1.1.0.

[The complete evidence archive](shadcn-lint/phase5-dry-run-2026-09-14.tar.gz)
contains original reports, prompts, inputs, candidates, stored HTML, receipts,
audits, screenshots, blank review and separate arm key, plus independent probe
results. Identical files use internal archive hardlinks; a fresh extraction
passed the independent byte/hash verification. Original absolute paths in JSON
record the execution location; the corresponding files are under the archive's
`phase5-dry-run/` root. Open `review.html` there to inspect the canned output.
[The review screenshot](shadcn-lint/phase5-review-2026-09-14.png) and
[compact proof record](shadcn-lint/results-2026-09-14-phase5.json) are direct
reading surfaces. This is evidence about the instrument, not a pilot result.

Repository verification passed 5,394 fast tests, typecheck and build. The strict
local emulator suite passed all 582 files and 5,951 tests, with three opt-in
model/sandbox skips. Publication refreshed onto `4ce3ba7f`, adding an upstream
Voice Agent UI change, and repeated the full fast suite, typecheck and build.
The strict proof and dry run precede that refresh; all named harness/analyzer
hashes remain identical. The app entry is 762,574 raw / 258,875 gzip bytes;
no application dependency or existing limit changed. Fifteen record guards pass.

## The model step remains separate

The proposed model is `claude-sonnet-5`, with the same empty toolset, high effort,
8,192 output-token allowance, one CLI turn and zero application retries in both
conditions. Each call starts in fresh scratch with local customizations and MCP
tools disabled. Admin-managed provider policy can still apply. Control prompts
contain the task, governing document and current HTML; only the diagnostics arm
adds the actual report. Canned repairs and scoring expectations never enter the
model prompt.

A model run requires explicit model mode and a separately approved positive
budget. The proposed aggregate is $10 in CLI-reported estimated API-equivalent
cost, divided into fixed per-call allowances that can only shrink. The runner
requests the CLI cap, records a pending invocation before dispatch, accounts for
its result before continuing, and stops on unavailable cost, unexpected model
identity, invalid usage or a cap overrun. Actual provider enforcement remains
unmeasured until an approved run; this is not a claim of an invoice-level cap.

Read-only preflight found Claude Code 2.1.269 signed in through Claude Max.
The CLI's cost figure is computed from token usage and is not authoritative
billing evidence for a subscription. Actual billed spend remains unavailable;
no credits or account settings were changed. [Provider cost semantics](https://code.claude.com/docs/en/costs)
and [CLI controls](https://code.claude.com/docs/en/cli-reference).

The remaining person-dependent work is approval for that evaluation usage,
then blind human intent/preference ratings on the actual model outputs. Until
both happen, the repair implementation is usable but its measured model benefit
remains unestablished.

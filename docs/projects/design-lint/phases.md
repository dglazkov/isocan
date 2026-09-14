# Design lint: the implementation walk

**Where we are — 14 September 2026:** Research and issues #299–303 are published.
Design-lint phases 1–4 are CLOSED; phase 5 is PART-DONE. Its complete dry-run
harness and independent local proofs pass. The next step is design-lint phase 5
model-usage approval, followed by human ratings on actual model outputs. No
implementation dependency remains before that approval.

The [journeys](journey.md) are acceptance and [design](design.md) names the
mechanisms. Each phase closes only on its named proof, with a full suite,
typecheck and the deep suite before push. Shared computation belongs in core;
reads need no operation, and a repair uses conditional `item.edit`. Fixtures are
synthetic. A passing lint report is not visual approval. The conductor owns
these records and independently verifies the builder's output.
When a local JRE, Firestore emulator and production build are available,
`npm run test:ci -- --maxWorkers=6` may supply the deep proof: it runs the same
deep lane and additionally refuses emulator or bundle skips. Record the actual
command and skips; this substitution strengthens the gate.

## Phase 1 — Parsed diagnostics and governing provenance (#300)

**Status: CLOSED.** 2026-09-14 — Parsed diagnostics, actual CSS declaration resolution, governing provenance and both reader adapters passed the full suite and a fresh-daemon CLI walk.

**Work:** Measure and choose HTML/CSS parsers; implement shared diagnostics,
coverage and compatibility aggregates; resolve each item's governing system
through shared context readers; wire the current CLI audit and a browser-safe
reader entry point to the same report. Cover all cases in issue #300.

**Proof:** Run `npm test`, `npm run typecheck`, `npm run build` and
`npm run test:deep -- --maxWorkers=6`. Replay the seven research probes with
corrected classifications; inspect source-range, alias/fallback/cycle,
malformed/dynamic/external-style and shorthand negative controls. Test nested
groups, scoped-only and inherited systems through real analyzer inputs and
both I/O adapters. Record standalone parser and app bundle measurements.
Exercise `design audit` against a fresh local daemon and synthetic canvas.

**Trajectory:**

- **2026-09-14** — The plugin loader retains the entire core namespace. A
  static analyzer export added 72,119 gzip bytes to the initial app chunk;
  a dedicated lazy `@isocan/core/design-audit` entry reduced that delta to
  three bytes without raising the bundle ceiling.
- **2026-09-14** — DESIGN.md declares intended tokens but injects no CSS into
  an artifact. The analyzer now starts from actual CSS declarations and
  candidates name missing declaration prerequisites; crediting a token's
  name alone would preserve a browser-visible failure.

**Proof record:** `npm test -- --maxWorkers=6`: 4,974 passed, 109 skipped;
`npm run typecheck` and `npm run build`: exit 0. Deep suite: Test Files  548 passed | 11 skipped (559); Tests  5334 passed | 111 skipped (5445).
The seven original probes and thirteen independent source cases passed.
A fresh synthetic daemon's JSON `design audit` report exactly matched the API,
and the scoped human report included missing variables, repair prerequisites
and external-style coverage. Adapter tests exercised nested and inherited
systems and policy refusal. The local deep suite leaves emulator-dependent
checks skipped; this machine has no JRE for the stricter emulator CI wrapper.
[Measurements and source evidence](../../research/shadcn-lint/results-2026-09-14-phase1.json).
After rebasing onto `e56e7acc`, including upstream drawer, Inbox and Voice Agent
changes, the complete four-worker suite passed 5,190 tests (108 skipped).
The production build and typecheck passed again. An earlier six-worker run hit
two archived-history timeouts; those four tests passed in isolation and both
complete four-worker reruns, with unchanged test limits. The deep run above
preceded those upstream additions; the audit implementation stayed unchanged.


## Phase 2 — Findings and conditional repair on both surfaces (#302)

**Status: CLOSED.** 2026-09-14 — Browser findings, exact-input audits and conditional repair passed both real surfaces, full verification and the strict emulator-backed deep suite.

**Work:** Add item/file audit selection and opt-in failing exits, structured
advisory arrival evidence, browser findings with source selection, and explicit
version-checked repair with fresh before/after reports. Document a two-round
agent budget and retain ordinary version/undo behavior. Update README and guide.

**Proof:** Run the full verification commands from design-lint phase 1. Drive a
real browser and a freshly started local daemon: add identical synthetic bad
HTML from CLI and browser, compare reports, select a finding's source, repair,
undo and attempt a stale concurrent repair. Verify CLI file/JSON/failure modes
and that audit errors after storage never misreport a successful write.

**Trajectory:**

- **2026-09-14** — A fulfilled write promise can mean queued, and an HTTP
  timeout can follow acceptance. Repairs now distinguish accepted, refused
  and pending receipts; pending keeps the draft and proposed version identity
  until authoritative confirmation. Ordinary editor saves follow the same
  receipt discipline without changing their version-stacking operation.
- **2026-09-14** — Refreshing a draft's audit must not relabel it with the
  current stored version. Captures retain the opened base, governing identity,
  rule version and exact input hash; the real-browser stale-edit walk preserves
  both the newer stored version and the unsaved buffer.

**Proof record:** On the combined tree through `f2632c90`, `npm test --
--maxWorkers=4` passed 5,214 tests, `npm run typecheck` and `npm run build`
exited 0, and `npm run test:ci -- --maxWorkers=6` passed all 576 files:
5,772 tests passed, three opt-in real-model/sandbox tests skipped. A temporary
JRE 21 and Firestore emulator 1.22.0 enabled the stricter deep proof; no cloud
resource or model call was used. The initial app entry measured 752,914 raw /
255,352 gzip bytes; the analyzer remains a separate lazy chunk.

The conductor independently ran `node scripts/journeys.mjs --only design-lint
--json` against a fresh daemon and real browser: matching CLI/browser findings,
values, source ranges and input hash; source selection and CSS prerequisites;
one-version repair, canvas Undo and stale-write refusal; delayed ordinary Save
preserving newer typing; and refused Save retaining the draft. A separate
12-command CLI walk covered local and contextual files, failing exits,
structured arrival evidence, repair/undo and post-storage audit failure.
[Measured evidence](../../research/shadcn-lint/results-2026-09-14-phase2.json).

The final rebase added only upstream `b2c0abcb`'s placement-test timeout change;
all product code and assertions were unchanged from the successful stricter
run. The full four-worker suite passed 5,214 tests again and typecheck passed.
The earlier first run found an obsolete editor source guard, which was updated,
and a 30-second MCP transport timeout during concurrent tool installation.
That transport case passed alone in six seconds and in subsequent complete
runs; no timeout was changed by this phase.

## Phase 3 — Scoped declarative recipe contracts (#301)

**Status: CLOSED.** 2026-09-14 — Scoped contracts, usable native/DTCG preservation and policy edit/undo passed both real surfaces and the full strict suite.

**Work:** Finalize and record the version 1 schema before coding. Preserve
unknown extension data or report unsupported conversion. Implement literal
policy, explicit recipe/treatment markers, ownership and reasoned exceptions.
Expose the effective contract and source on both surfaces using normal edits.

**Proof:** Run the full verification commands from design-lint phase 1. Test
native and supported export/import round trips, unknown versions/rules, nested
groups and inheritance, separate lane policies, Button placement versus owned
padding/radius, and title size versus owned weight. In a real browser inspect
the effective policy, edit the governing document, observe changed findings
and undo the edit. Confirm an HTML repair cannot weaken the governing policy.

**Trajectory:**

- **2026-09-14** — The existing YAML subset silently changed five of six
  extension round-trip probes, including quoted reasons and unknown JSON types.
  Version 1 now names its supported ownership/selector boundary and requires
  an opaque preservation path before enforcement, with DTCG vendor metadata
  and explicit CSS conversion notes.

- **2026-09-14** — Preserving extension bytes was insufficient: generic DTCG
  import renamed token paths and broke otherwise preserved contract references.
  Native vendor imports now restore native names and partial typography from
  metadata; the round trip compares the effective contract as well as its bytes.

**Proof record:** On upstream `b4fb0a52`, `npm test -- --maxWorkers=4` passed
5,322 tests (108 skipped); `npm run typecheck` and `npm run build` exited 0.
`npm run test:ci -- --maxWorkers=6` passed all 578 files: 5,879 tests passed,
three opt-in real-model/sandbox tests skipped. The local Firestore emulator
and bundle gates ran. No dependency or bundle threshold was added or raised.
The initial entry is 762,562 raw / 258,847 gzip bytes, a 9,648 / 3,495 byte
increase from design-lint phase 2; the analyzer remains lazy.

The conductor independently passed 34 synthetic contract cases and 11
preservation/conversion cases. They distinguish owned values from token
membership, actual exported references from literal aliases and shadows,
physical shorthand sides and radius axes, approved treatments/exceptions,
unknown rules and unsupported selectors. A retained CSS identifier escape
cannot be treated as a definite nonmatch; it now makes coverage incomplete.
An earlier strict run was interrupted for that correction and is not counted
as proof; the final complete run above passed afterward.

The fresh-daemon browser walk passed in 13.818 seconds: CLI/browser policy,
exact finding, quoted exception reason and governing version agree; ordinary
policy edit refreshes findings; actual canvas Undo restores the exact policy,
findings and source version; HTML repair leaves governing bytes and version
history unchanged. Real adapter tests cover nested lanes and inherited policy.
The same walk checks CLI DTCG export/import and CSS conversion notes.
[Evidence and reproducible probes](../../research/shadcn-lint/results-2026-09-14-phase3.json)
and [verified browser view](../../research/shadcn-lint/phase3-contract-2026-09-14.png).

Existing operations provide document versions, conditional HTML repair and
Undo. Existing CLI verbs and both report surfaces expose the shared core
semantics; the agent guide and README are updated. No paid evaluation or human
intent rating is claimed.

## Phase 4 — Optional repository checks and Tailwind proof (#303)

**Status: CLOSED.** 2026-09-14 — Pinned repository and web-tool proofs passed independently; Tailwind is advisory with explicit incomplete coverage and no application dependency cost.

**Work:** Build the pinned local Tailwind runner and reproducible fixture,
isolated from browser dependencies. Measure monorepo/config/component behavior,
unsupported and unavailable states, source mapping and runtime. Record a go/no-go
and the spacing-policy boundary. Survey the other recommended technology checks
with concrete compatibility probes for CSS, HTML and rendered accessibility;
retain optional adoption and existing project configuration.

**Proof:** Run the full verification commands from design-lint phase 1 and
the pinned adapter fixture in a scratch repository. Exercise custom theme,
component directory, monorepo alias/barrel, unsupported HTML/CSS and missing
dependencies/theme. Findings carry relative paths and tool/config identity;
the app bundle contains no upstream runner. Record actual tool output and
go/no-go, including a negative control that cannot report a false clean result.

**Trajectory:**

- **2026-09-14** — An opaque props spread and a plain element's dynamic class
  produce zero upstream findings with all six rules enabled. Rule execution
  and complete styling coverage therefore remain separate: advisory use is a
  go, while a strict design gate is a no-go.

**Proof record:** On base `531733c8`, the full four-worker
suite passed 5,341 tests (108 skipped); typecheck and build exited 0. The strict
local `npm run test:ci -- --maxWorkers=6` passed all 579 files: 5,898 tests passed,
three opt-in model/sandbox tests skipped. The initial app entry is byte-identical
to design-lint phase 3: 762,562 raw / 258,847 gzip bytes. No app dependency,
configuration, core code or bundle threshold changed.

The conductor independently installed both portable fixture locks in fresh
scratch directories. The Tailwind proof passed eight scenarios over sixteen
baseline files in 2,708.00 ms; the CSS/HTML/axe proof passed 23 assertions across
21 actual results in 2,268.51 ms. The latter used a real Chrome browser and
revealed a previously hidden label fault through an actual button click.
Missing web tooling returns unavailable with exit 2. Real standalone Tailwind
JSON and human invocations passed; its optional `--fail` returns 2 even on the
zero-finding control because complete coverage cannot be established.

The Tailwind inputs prove custom theme/components, workspace alias/barrel and
variants, effective project settings/severities/overrides, missing dependencies
and config, ignored/suppressed rules, unsupported HTML/CSS, missing theme and a
readable theme with a compiler-failing import. Fresh invocations observe config
and theme edits. Nine independently checked real diagnostic/suggestion spans
cover Unicode, a BOM and every JavaScript line terminator. Actual Tailwind
compilation retains 13px for `p-3.25`; native analysis rejects that against the
16px discrete policy.

Independent review corrected nonportable fixture locks and source mapping.
The first full suite exposed missing cleanup retries and unintended discovery
of the optional ESLint config; the config now stays inert until copied into
scratch. A subsequent full run hit the unchanged replica-admission assertion
in `packages/server/test/passes.test.ts`; all 25 tests in that file passed
alone, then the complete fast and strict runs above passed. No server code or
test limit was changed.

Before publication, upstream `d25c478b` changed the identity-menu/peek-card
interaction. The combined tree passed the full four-worker suite (5,346 tests,
108 skipped), typecheck and build. Its entry is 762,574 raw / 258,864 gzip bytes;
the strict proof above predates that upstream UI-only change. Fifteen record
guards passed. No phase-4 runtime file changed during this refresh.

Operations, core and the browser are deliberately unchanged by phase 4. The source-checkout
runner has a documented command in README and the agent guide; it adds no native
CLI verb. Stylelint, HTML-validate and axe remain measured compatibility probes,
with other technology checks explicitly recommendations.
[Full evidence](../../research/shadcn-lint/results-2026-09-14-phase4.json) and
[adoption guidance](../../research/2026-09-14-optional-project-linters.md).

## Phase 5 — Controlled repair evaluation (#302)

**Status: PART-DONE.** 2026-09-14 — The complete local evaluation instrument passes; model-usage approval and actual human intent ratings remain open.

**Work:** Prepare equal-budget rules-only versus diagnostics tasks and a dry-run
harness, declare go/no-go thresholds, and render fixtures at intended sizes.
Record compliance, false positives, uncovered styling, system changes, rounds,
latency and spend separately from visual intent and interaction results.

**Proof:** Run the full verification commands from design-lint phase 1 and a
no-spend dry run exercising both conditions and failure/empty-render controls.
Then run the approved paid comparison and collect human intent ratings. Publish
the actual results; no model lift or human preference is inferred from dry runs.

**Provision:** ⚑ Paid model calls require a stated cap and user approval after
the harness is reviewable. Human intent ratings wait on a person's review.

**Trajectory:**

- **2026-09-14** — An opened popover with transparent response text passed the
  first interaction predicate. The final check requires painted, unclipped and
  unobscured response text, including overlays that ignore pointer events;
  conservative DOM evidence still cannot replace human intent review.
- **2026-09-14** — A zero-byte candidate is refused by storage before it can
  become a render. The empty-page control uses valid HTML with an empty body;
  invalid output consumes an attempt and retains the actual stored screen for review.
- **2026-09-14** — Open: approve the proposed $10 CLI-reported estimated
  API-equivalent evaluation budget, at most 72 `claude-sonnet-5` invocations
  through the current Claude Max session. Waits on the user; billing and actual
  provider cap enforcement are not established by the dry run.
- **2026-09-14** — Open: collect blind intent and preference ratings for the
  18 actual model-output pairs after the approved pilot. Waits on a person;
  automated checks and canned outputs supply no human study ratings.

**Proof record:** The conductor ran the complete source-checkout command on
base `0fa80ee5`: 36 fresh synthetic canvas runs, 42 canned attempts, 30 saved
repairs and 12 unchanged results. All 42 selected/adjacent document snapshots
preserved bytes and full histories. Six readiness pairs, thirteen stored-output
or policy negative controls, real stale-write refusal and the two-invalid-output
case passed. The frozen 26-file fixture aggregate remains
`00ba41f97cdfebcd200113b7605d59cb211bb3345b10c9089fc290ee528d17b9`.

Independent verification checked actual input/stored/audit/browser bytes,
19 required source hashes, 108 image hashes and all 18 blind pairs. Real Chrome
inspection and a download click verified the review UI; original ratings stayed
pending. A separate browser probe passed 19 cases / 38 viewport observations,
including scaled text and a small cover. Nineteen model-boundary controls and
sixteen summary controls used explicitly synthetic data. The actual summary
is `instrumentation-only`: zero evaluation model calls, no measured model lift,
no comparative cost and no human ratings.

The full four-worker suite passed 5,394 tests (108 skipped) across 530 files;
typecheck and production build exited 0. The strict local emulator-backed
`npm run test:ci -- --maxWorkers=6` passed all 582 files: 5,951 tests passed,
three opt-in model/sandbox tests skipped, in 420.15 seconds. No application
package, operation, product CLI verb, shared-core/browser runtime, existing
limit or timeout changed. The source-checkout evaluation/summary command is
accessible to agents and documented in README and the agent guide; its new
unit/integration tests and the actual daemon/browser walk are the test surface.

The initial app entry is 762,574 raw / 258,875 gzip bytes on this base, within
the unchanged limit. [Research and reproduction](../../research/2026-09-14-design-lint-evaluation.md),
[compact proof](../../research/shadcn-lint/results-2026-09-14-phase5.json) and
[complete dry-run archive](../../research/shadcn-lint/phase5-dry-run-2026-09-14.tar.gz)
retain the evidence. The archive was extracted afresh and its bytes verified.

Publication incorporated upstream `4ce3ba7f` (Voice Agent canvas selection).
The combined tree passed all 5,394 fast tests (108 skipped) in 176.72 seconds,
typecheck and build. The entry bytes/hash are unchanged from the proof base;
all nineteen named lint/harness source hashes remain identical. The strict
suite and dry run above predate this upstream UI-only refresh. Fifteen record
guards passed. No model run or human rating was performed.

---
status: partial
since: 2026-09-14
issue: 299
see: design-competition, evals, context
note: measured @shadcn/lint 0.1.0 against JSX and isocan's HTML auditor against seven synthetic cases. Adopt actionable, scoped diagnostics in the existing HTML path; reserve the Tailwind plugin for an optional repository adapter. Phase 1 now corrects missing-variable credit, spacing/font shorthand gaps and prose false positives, with parsed ranges, coverage and governing provenance. Phase 2 adds browser findings, local-file audits and conditional repair with honest write receipts. Phase 3 adds scoped recipe contracts, effective policy views and native/DTCG preservation. Phase 4 adds a measured advisory Tailwind repository runner and isolated CSS/HTML/accessibility probes. Phase 5 now supplies a verified 36-run dry harness; model-usage approval and actual human ratings remain pending.
---
# Design lint that explains the repair

**14 September 2026.** Recommendation: improve the HTML design checker isocan
already has, using `@shadcn/lint`'s model of actionable diagnostics. Offer the
package itself only for connected repositories that actually use Tailwind v4.
Changing the canvas artifact format or migrating isocan's app to Tailwind is
not justified by this tool.

The useful sequence is **read the governing design → build → check → repair →
render and review**. A finding should name the rule, the source location, the
system that supplied the rule, and an existing token or component treatment
that could fix it. Compliance is a floor; visual quality and the person's
choice remain separate.

## What was read and run

The starting links were the [announcement on X](https://x.com/shadcn/status/2099534231114314145)
and [shadcn-ui/lint](https://github.com/shadcn-ui/lint). X returned HTTP 403 and
search did not recover that post, so no wording or additional claims are
attributed to it. The conclusions below come from the repository and executable
probes.

- Upstream source pinned at
  [`53de86f0e7dcc341a9cb45c383a9f2c454d1e958`](https://github.com/shadcn-ui/lint/tree/53de86f0e7dcc341a9cb45c383a9f2c454d1e958).
  npm also reported `@shadcn/lint` **0.1.0**. It is MIT, ESM, requires
  Node ≥20.19, and supports ESLint and Oxlint. The package was installed only
  in a scratch directory, with scripts disabled; no product dependency changed.
  [Package metadata](https://github.com/shadcn-ui/lint/blob/53de86f0e7dcc341a9cb45c383a9f2c454d1e958/packages/lint/package.json)
- isocan's audit and export source at local HEAD `da47c5861a11a5bd64add503fbb3282d4239c29d`,
  plus the current CLI, app and roadmap. Unrelated staged context work was
  present and was not edited by this research.
- Seven synthetic HTML cases and five upstream inputs on Node **24.21.0**,
  ESLint **10.9.1**, TypeScript parser **8.68.0**, Tailwind **4.3.3**.
  [Runnable probe](shadcn-lint/probe.mjs) and
  [recorded inputs and outputs](shadcn-lint/results-2026-09-14.json).
  These are compatibility measurements, not an agent or visual-quality eval.

Before publication, the probe was repeated against current main
`cb272b208608d0a78bbd0c0435a78f3dccb72e3d` in a clean checkout on Node
**24.13.0**. Every finding matched; only the recorded Node version differed.
That newer tree also supplies the conditional `item.edit` operation used in
the repair recommendation below.

## What the package contributes

The six rules are explicitly enabled rather than supplied as a preset.
Their [rule reference](https://github.com/shadcn-ui/lint/blob/53de86f0e7dcc341a9cb45c383a9f2c454d1e958/docs/rules.md)
separates component ownership, token use and whether a class can be checked.

| Rule | Useful idea for isocan | Boundary |
| --- | --- | --- |
| `no-restyle` | A component owns appearance; callers get explicitly allowed changes | HTML needs an explicit recipe/component identity; a class name alone does not establish ownership |
| `no-raw-colors` | Require meaningful theme colors and explain alternatives | Matching a color value is weaker than preserving its semantic role |
| `no-arbitrary-values` | Explain the nearest or exact allowed scale value | Tailwind's scale is not necessarily a canvas's discrete spacing vocabulary |
| `no-inline-styles` | Prevent a caller bypassing a component contract | Cannot be applied wholesale to self-contained HTML, whose normal authoring surface is `<style>` |
| `no-unknown-classes` | Report a class that generates no CSS | Uses the project's installed Tailwind v4; does not validate arbitrary CSS classes |
| `require-static-classes` | Say when styling cannot be inspected | Unreadable styling must not become a clean score |

Component contracts can allow layout while reserving padding, type or color
for a component's own variants. Diagnostics can identify the component file
and available size/variant choices. That is more useful than a count followed
by a generic instruction to read the guide.
[Component policy](https://github.com/shadcn-ui/lint/blob/53de86f0e7dcc341a9cb45c383a9f2c454d1e958/docs/rules/no-restyle.md)

The implementation resolves imports and wrappers, reads theme declarations,
and follows some values within a file. It explicitly does not check ordinary
stylesheet declarations or `@apply`, cannot trace every dynamic value or parent
selector, and treats a newly declared theme token as allowed. Tailwind loading
uses a Node worker and can fall back to a grammar with a warning. These are
reasons to report coverage, and to keep the upstream runtime outside browser
core. [How it works](https://github.com/shadcn-ui/lint/blob/53de86f0e7dcc341a9cb45c383a9f2c454d1e958/docs/how-it-works.md)

The public API is the plugin plus an **experimental** project-discovery API.
The collector, grammar and caches are internal. There is no supported
`lintHtml(source, tokens)` API to call from `auditScreen`.
[API reference](https://github.com/shadcn-ui/lint/blob/53de86f0e7dcc341a9cb45c383a9f2c454d1e958/docs/api.md)

Upstream reports more than 150 agent task runs, usually reaching zero findings
in one correction round, and 10–48% lower correction cost in its Claude
rules-only controls. These are upstream measurements, not an isocan forecast.
Its detailed eval page describes small fixtures, changing rules, model-judged
fidelity, some unjudgeable empty renders, and untracked run outputs; the README
also lists Codex runs that the detailed page does not fully document. We did
not reproduce paid runs. The important experimental pattern is a rules-only
control with equal correction budgets, and separate compliance and fidelity
outcomes. [Evals and limitations](https://github.com/shadcn-ui/lint/blob/53de86f0e7dcc341a9cb45c383a9f2c454d1e958/docs/evals.md)

## Where isocan stood before implementation

The [24 August token research](2026-08-24-design-systems-and-tokens.md) is built:
DESIGN.md, CSS export, DTCG import/export and design-document checks exist.
The [component-library research](2026-08-28-component-libraries.md), tracked in
[#143](https://github.com/dglazkov/isocan/issues/143), already established why
React components cannot simply be pasted into a self-contained canvas screen.
This is a new checking problem, not a reopening of that format decision.

| Existing mechanism | Integration point |
| --- | --- |
| [`checkDesign`](../../packages/core/src/designcheck.ts) checks document shape, references and contrast, with some repair guidance | Keep checking the system itself before using it to judge screens |
| [`auditScreen`](../../packages/core/src/designaudit.ts) counts off-system colors, font sizes and radii | Extend this shared logic into precise HTML/CSS diagnostics |
| [`toCss`](../../packages/core/src/tokens.ts) emits variables and typography classes | Derive suggested spellings from this exporter; do not invent a second naming convention |
| [`designSystem`](../../packages/core/src/designsystem.ts) and [`governingDesign`](../../packages/core/src/memory.ts) select scoped and inherited context | Use one governing resolution path for each screen and report provenance |
| [`isocan design audit`](../../packages/cli/src/main.ts) has JSON output; arrival scoring prints a short warning | Add parity and repair guidance to the existing verb and lifecycle |
| [`DesignSystemView`](../../packages/web/src/components/DesignSystemView.tsx) shows system findings; [`tokens.test.ts`](../../packages/web/test/tokens.test.ts) guards the app's own CSS | Give screen findings a browser surface while retaining app-specific guards |

Baseline source inspection found no `auditScreen` caller in the web app, API or server.
Arrival scoring is CLI-only, skips `--json`, and runs after storage as a
best-effort warning. `design audit` reports findings without a nonzero exit for
them. It checks local scoped systems, but its initial canvas-wide lookup can
refuse a canvas containing only scoped systems, and it does not use the linked
inheritance resolver that `design check` uses. Coverage and scope need to be
consistent before this becomes a dependable automated repair loop.

The app itself is React with ordinary CSS and custom properties; its package
manifest has no Tailwind dependency. Its ESLint configuration currently guards
React hooks. Installing all six Tailwind rules there would not check the
stylesheet that supplies most of its design. Improve the existing CSS guards
where evidence warrants it; do not change the app's styling stack for a linter.

## What the probes found

The synthetic system names two colors, a 16px body size, an 8px radius and a
16px spacing token. The full source of each case is in the recorded output.

| HTML input | Baseline reading | Implication |
| --- | --- | --- |
| Known `#112233` literal | 1 on-system, 0 off-system | A literal may conform today; token identity is a separate future policy |
| Off-system `#ff0000` literal | 0 on-system, 1 off-system | Positive control: the current check catches its intended case |
| `var(--missing)` | 1 on-system, 0 off-system | Undefined references receive credit |
| `var(--missing, #ff0000)` | 1 on-system, 0 off-system | Fallback content is removed before analysis |
| `padding:13px` | 0 on-system, 0 off-system | Spacing is unmeasured, despite a declared spacing scale |
| `font:13px sans-serif` | 0 on-system, 0 off-system | The shorthand bypasses the `font-size` scan |
| Hex string in paragraph prose | 1 off-system | The whole-source regex mistakes text for a CSS declaration |

With the upstream plugin configured for TSX, a synthetic Button call with an
arbitrary padding, arbitrary red and a mistyped variant produced **five
findings**, including existing size choices and a corrected class spelling.
A Button using its `size` prop and margin was clean. HTML and CSS each produced
an **ignored-file warning**, not a successful design check. This tests the
documented JSX setup, not every possible third-party ESLint processor.

One small distinction matters: upstream suggested `p-3.25` for `p-[13px]`, and
`<div className="p-3.25">` passed all six rules. It preserves 13px on Tailwind's
arithmetic spacing scale. It does **not** enforce our synthetic system's 16px
spacing choice. A bridge needs an explicit scale policy; converting syntax is
not equivalent to making a design conform.

## Recommended design

**Start with accurate diagnostics for native HTML.** Parse HTML and CSS into
source locations, checking `<style>`, style attributes and relevant SVG
presentation attributes. Ignore prose, comments and non-style scripts. Start
with token references, the existing value categories, and declared spacing;
expand properties only behind measured fixtures. Validate against declarations
and aliases as well as the governing system. A local variable is not inherently
wrong, but an off-system value hidden behind one must not receive automatic
credit. Report dynamic values, unresolved external stylesheets, unsupported
color expressions and ambiguous cascade cases as unexamined. Do not fetch or
execute arbitrary page resources to make a static result look complete.

Each result should carry a stable rule code, severity, source range, actual
value, explanation, candidate repair, and coverage. Each report identifies the
screen version/blob and the governing DESIGN.md version/source canvas. Derived
results can be cached by those inputs and rule version; a changed screen or
system invalidates them. Shared policy and analysis belong in `@isocan/core`,
with a browser-compatible parser chosen by a bundle/coverage spike; blob reads
and orchestration belong at the shared API boundary. Node/ESLint/Tailwind
discovery stays in an optional repository runner.

**Add explicit contracts after token coverage works.** DESIGN.md is the
authority. A proposed, versioned isocan extension can declare policies and
HTML recipe identities, allowed caller changes, approved variants and scoped
exceptions with reasons. The extension's exact schema and round-trip behavior
must be designed and tested; it is not an existing Google/DTCG field. Begin
with an explicit component marker, not guesses that every `.button` means the
same thing. Unknown rules are reported rather than silently enforced or lost.
Use data, never executable lint configuration loaded from a canvas.

Ordinary token conformance should continue to accept an exact matching literal
unless a system explicitly requires references. Where a repair is unambiguous,
use the exporter's real name, e.g. `var(--space-md)` for the synthetic spacing
token. A nearest color is only a candidate: visual proximity cannot decide
whether a value means danger, brand or selection. Adding a token, changing a
contract or granting an exception is a visible design decision with an ordinary
version, not an automatic way to reduce the finding count.

**Complete the loop on both surfaces.** Extend `design audit` with proposed
single-item/local-file checking and an opt-in failing exit mode; preserve its
existing report use. Give agents structured findings even in JSON mode and
people an item-level list that opens the source location. Run the same check
after add, update and web save, without reporting a stored write as failed.
An explicit repair action works against a captured version, reruns the audit,
then uses the existing conditional [`item.edit`](../../packages/core/src/ops.ts)
with `expectedVersionId` to land one content version; a concurrent edit requires
a fresh read. Checking needs no mutation. There is no reason for a new Operation.

An agent repair loop should have a small declared round budget and show what
remains when it stops. The final step is rendering at the intended sizes,
checking interactions/accessibility, and a person reviewing visual intent.
Do not treat a zero count, especially with incomplete coverage, as design
approval. Follow the upstream [gradual adoption approach](https://github.com/shadcn-ui/lint/blob/53de86f0e7dcc341a9cb45c383a9f2c454d1e958/docs/adoption.md):
start advisory, baseline measured violations, and tighten deliberate rules.

## Roadmap and proofs

The implementation walk is [design-lint/phases.md](../projects/design-lint/phases.md).
The execution queue is [#299](https://github.com/dglazkov/isocan/issues/299).
Phases 1–4 are implemented and independently verified; the evidence sections
below distinguish them from the original baseline. The controlled model
experiment and human intent ratings remain pending.

| Step | Scope | Proof needed |
| --- | --- | --- |
| 1 · [#300](https://github.com/dglazkov/isocan/issues/300) | Shared HTML/CSS diagnostics and coverage | All seven probes classified correctly; valid local aliases and malformed/unsupported inputs handled honestly; CLI/API/browser return equivalent findings |
| 2 · [#301](https://github.com/dglazkov/isocan/issues/301) | Versioned scoped design contracts | Two nested groups and an inherited system keep separate rules; recipe ownership, explicit exceptions and round trips work without a global house style |
| 3 · [#302](https://github.com/dglazkov/isocan/issues/302) | Agent/browser feedback and measured repair | The same bad HTML added from each surface yields the same report; repair creates one version; stale edits are detected; equal-budget eval separates compliance, visual intent and cost |
| 4, optional · [#303](https://github.com/dglazkov/isocan/issues/303) | Tailwind repository adapter | A pinned v4 fixture reads its own theme/components, reports JSON and coverage, handles monorepo paths, and refuses/labels unsupported HTML/CSS or missing Tailwind; no app migration |

Step 1 comes first. Step 2 depends on it. Step 3 can start with token findings
after step 1 and gain contracts after step 2. Step 4 can be investigated
independently when a real connected Tailwind repository needs it; it does not
block native HTML improvements. Pin the dependency and wrap only documented
APIs; avoid forking or deep-importing the package's classifier.

For step 3, use synthetic tasks through the existing
[`scripts/lift.mjs`](../../scripts/lift.mjs) / [evals plan](../projects/evals/plan.md):
same starting drafts, same models and token budget, rules-only versus rules
plus diagnostics, equal maximum correction rounds. Record successful repairs,
false positives, unexamined styling, changes to the system itself, elapsed
time and model spend. Render both versions; inspect interaction failures and
have people assess intent separately from lint. Set go/no-go thresholds before
running the paid comparison.

For [design competition #250](https://github.com/dglazkov/isocan/issues/250),
apply each lane's own system and attach compliance evidence at hand-in.
Keep human voting and distinctiveness separate; raw counts from different
policies are not a fair ranking of fighters. The current
[phase record](../projects/design-competition/phases.md) says technical
integration is built while the human distinctiveness/cost measurement remains
owed. Linting must not mark that acceptance complete. Relate the experiment to
[#276](https://github.com/dglazkov/isocan/issues/276)'s designer/model comparison.

Implementation acceptance must cover the repo's two surfaces: shared core
analysis; CLI verb/options and agent-guide reference; browser interaction
proved in a real browser; README updated only when features ship; existing
operations for edits; `npm test` and `npm run typecheck`. The original research step changed
research, evidence and roadmap records only; later implementation is recorded below.

## Reproduce the bounded probe

From the repo, using a fresh scratch prefix:

```sh
npm install --prefix /tmp/isocan-lint-probe --ignore-scripts --no-audit --no-fund @shadcn/lint@0.1.0 eslint@10.9.1 @typescript-eslint/parser@8.68.0 tailwindcss@4.3.3
node docs/research/shadcn-lint/probe.mjs /tmp/isocan-lint-probe
```

Omit the prefix argument to run only the native HTML cases. The recorded run
pins direct dependency versions; transitive dependencies are not locked, so
future results can differ. The probe writes synthetic fixture files only in
the supplied scratch prefix and does not contact a canvas or call a model.

Publication validation on the clean current-main checkout: `npm run build`
and `npm run typecheck` passed; `npm run test:deep -- --maxWorkers=6` passed
**5,266 tests in 542 files**, with **111 tests / 11 files skipped** under local
defaults. The stricter emulator/anti-skip `test:ci` run was not performed.
The original shared workspace's fast run had an unrelated conduct-skill
duplication failure; no skill or staged implementation file was changed.

## Implementation evidence, 14 September: phase 1

The earlier tables record the baseline; [phase 1](../projects/design-lint/phases.md)
replaces the whole-source regular expressions with parse5 8.0.1 and CSS Tree
3.2.1's parser/walker. The same seven inputs now have the intended classifications.
Thirteen further independent cases cover scope, cycles, nested fallbacks,
HTML entities, malformed CSS, imports and dynamic styling. The report keeps
unexamined regions visible and never executes scripts or fetches stylesheets.
[Actual source and output](shadcn-lint/results-2026-09-14-phase1.json).

A governing token is an expected value and name, not an injected CSS definition.
An artifact that says `var(--color-ink)` still needs that declaration in its own
static scope. Candidates explain that prerequisite. Scoped and inherited reads
share one browser-safe orchestration module; each finding carries both content
and governing-document provenance. A fresh-daemon CLI walk returned exactly the
same JSON as `CanvasHandle.designAudit()`.

`node scripts/probe-design-parsers.mjs <scratch-prefix>` reproduces the parser
comparison. Minified browser bundles were 42,179 gzip bytes for parse5, 18,163
for CSS Tree's narrow entry, and 20,151 for PostCSS 8.5.28 plus value-parser
4.2.0. The full standalone analyzer was 68,918 gzip bytes. CSS Tree supplies
structured values and recovery locations with less gzip cost in this probe.
Its tolerant recovery still needs explicit malformed-input coverage.

The app's plugin loader made a static core barrel export expensive: it added
72,119 gzip bytes to the initial chunk. A dedicated lazy audit subpath leaves
the initial chunk at 750,359 raw / 254,239 gzip bytes, a 0 / +3 byte delta from
the pre-change build. This phase exposes the browser reader; phase 2 will mount
it in the interface. The measurement is not a claim that later UI costs nothing.

Those isolated bundle measurements precede the upstream drawer/settings change
`0dfc1970`. Rebuilding the combined tree afterward gives a 750,470 raw /
254,290 gzip initial entry; the standalone analyzer remains 237,875 raw /
68,918 gzip. The evidence identifies both source baselines rather than
attributing the unrelated interface change to the analyzer.


## Implementation evidence, 14 September: phase 2

The Design check beside an HTML screen now exposes the same diagnostics as the
CLI, with exact source selection, governing provenance, repair prerequisites
and incomplete coverage. Local HTML can also be checked against a local
DESIGN.md without a daemon. `--fail` is opt-in and distinguishes findings or
missing coverage from command errors; JSON add/edit callers receive the stored
version identity plus advisory audit evidence.

An explicit repair captures the opened screen version, governing source, rule
version and input hash. Fresh reads surround upload, and one conditional
`item.edit` creates one undoable version. A lost response or offline queue is
pending, not a refusal: the proposed version stays identifiable and the draft
stays present. A confirmed write remains successful when its subsequent audit
fails. Ordinary editor Save keeps its existing version stacking and preserves
text typed during upload.

The conductor's fresh-browser walk and twelve real CLI commands verified these
paths, including stale edits, real Undo and a successful storage operation
followed by an unavailable audit. All 576 files in the strict local CI suite
passed (5,772 tests, three opt-in real-model/sandbox skips), using temporary
local Java and Firestore tools. No paid model or cloud resource was used.
[Actual proof and bundle measurements](shadcn-lint/results-2026-09-14-phase2.json)
and the [verified browser view](shadcn-lint/phase2-findings-2026-09-14.png).
The final upstream rebase changed only a placement-test timeout; the full suite
and typecheck passed again. This establishes the repair mechanism, not agent
lift or visual quality: those remain the separately approved evaluation.


## Implementation evidence, 14 September: phase 3

Version 1 contracts now travel with the governing DESIGN.md. Recipes own
specific physical padding, radius and typography properties; callers may
change declared controls, choose approved treatments or name an exception
with a preserved reason. Literal policy follows the governing document, so
nested lanes and inherited systems remain separate. Reference checks require
an actual exported CSS token, including a valid alias path and value.

Native and DTCG round trips preserve unknown JSON-compatible extension data.
DTCG import also retains the native token paths the contract references;
preserving policy bytes while renaming their targets was not a working round
trip. Unsupported syntax or conversion produces problems, and CSS exports
explicitly disclose the loss of contracts and reasons.

The conductor passed 34 independent contract cases and 11 preservation cases,
then walked the real browser and CLI: inspect the effective contract and
source, edit its document, observe changed findings, Undo the policy, and save
an HTML repair without changing governing bytes. The full fast suite passed
5,322 tests; typecheck and build passed; the strict emulator-backed suite
passed all 578 files, with 5,879 tests and three opt-in model/sandbox skips.
The initial entry grew by 9,648 raw / 3,495 gzip bytes; parser analysis remains
lazy and the existing bundle limits remain unchanged.

[Measured results](shadcn-lint/results-2026-09-14-phase3.json),
[contract probe](shadcn-lint/probe-contracts.mts),
[round-trip probe](shadcn-lint/probe-contract-roundtrips.mts), and
[verified policy view](shadcn-lint/phase3-contract-2026-09-14.png) retain the
synthetic inputs and outcomes. Run either probe from the repo with
`node --import tsx <probe-path> [output.json]`. Escaped CSS identifier selectors
and other unsupported cascade paths are explicit incomplete coverage. This
proof establishes enforcement and preservation; paid agent lift and human
intent ratings remain unmeasured.


## Implementation evidence, 14 September: phase 4

The optional source-repository runner executes the target project's existing
ESLint configuration and pinned public `@shadcn/lint` API in a fresh process,
without fixes or installation. Eight independently replayed scenarios cover
sixteen baseline files, including actual theme compilation, custom component
aliases, disabled rules, broken theme imports and exact Unicode/BOM/line-ending
source mappings. An opaque props spread remains an upstream blind spot:
completed rule execution is distinct from complete design coverage. The verdict
is advisory adoption, with no claim of a strict complete-design gate.

Separate fresh Stylelint, HTML-validate and axe/Playwright fixtures passed 23
assertions across 21 results, including a real click revealing an accessibility
fault and explicit unavailable tooling. These are compatibility probes, not
additional installed application dependencies or general repository adapters.
The [full optional-tool report](2026-09-14-optional-project-linters.md) retains
the technology shortlist, primary sources, exact versions and reproduction.

The final fast suite passed 5,341 tests; the strict emulator-backed suite passed
5,898 tests across 579 files with three opt-in model/sandbox skips. Typecheck
and build passed. Before the final upstream identity-menu change, the browser entry was byte-for-byte
unchanged from phase 3; the combined entry is 762,574 raw / 258,864 gzip bytes.
[Combined evidence](shadcn-lint/results-2026-09-14-phase4.json) records successful
proofs, earlier corrected failures and the unrelated server-test intermittency.
No model call or cloud resource was used. Phase 5's [controlled harness](2026-09-14-design-lint-evaluation.md)
now passes its dry-run proof; lint compliance alone has not established agent
lift or visual intent. Model-usage approval and actual human ratings remain open.

Publication incorporated upstream identity-menu change `d25c478b`; all 5,346
fast tests, typecheck and build passed on the combined tree. The strict
5,898-test result above predates that upstream UI-only change.

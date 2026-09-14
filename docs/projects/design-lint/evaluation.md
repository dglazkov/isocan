# Does diagnostic feedback improve a bounded repair?

The debt is an unmeasured claim: upstream lint repair results do not establish
that isocan's HTML checker improves our artifacts. This is the preregistration
for design-lint phase 5, written before model runs. A dry run proves only the
instrument. No paid run or human comparison has happened.

## Conditions and budget

Start both arms from identical synthetic HTML and the same governing DESIGN.md.
The control receives the task and rules; the treatment also receives the
analyzer's findings and coverage. Use one explicitly recorded model, the same
available tools and the same output allowance in both arms. Permit at most two
correction rounds per run and perform three repetitions per task/condition.
Randomize arm order with a recorded seed. Keep the model identifier, CLI/tool
versions, input hashes and rule version in the result.

Use six tasks, for 36 task/condition/repetition runs and at most 72 correction
calls. The eventual monetary cap is an explicit run parameter approved by the
person after the dry run is reviewable; fix each per-call allowance at no
more than that cap divided by 72, only tighten it against the remaining
budget, and stop when the aggregate budget is exhausted. Missing cost data is unavailable, never zero. Do not call
a paid model during a dry run.

## Frozen task families

All names and text are synthetic. Write literal fixtures and expected task
invariants before implementing the scorer; do not generate expectations from
the analyzer under test.

| Task | Seeded problem | Intent that must survive |
| --- | --- | --- |
| Card spacing | 13px padding against a declared 16px step | Heading, body and action remain visible at narrow and wide sizes |
| Ink reference | Missing variable with an off-system fallback | Body ink and a separately meaningful accent remain distinct |
| Type shorthand | 13px font shorthand against a 16px body role | Text remains legible, unclipped and in its original semantic element |
| Button treatment | Caller overrides recipe-owned padding/radius | Button retains its label, focusability and working click response |
| Scoped lane | Screen uses the adjacent lane's otherwise valid token | The selected lane's policy governs; the other document is unchanged |
| Clean control | Valid local alias and prose containing a hex string | No unnecessary design edit; visible content and behavior remain intact |

If a task cannot exercise the shipped checker as described, revise this record
with the reason before collecting any paid result. Preserve old fixtures and
version the set when changing it after a run.

## Outcomes, recorded separately

For every attempt record the exact before/after bytes, diagnostic counts by
rule, coverage exclusions, known false positives, rounds, wall time, token use
and actual reported API-equivalent cost, separately from billed spend. Record any attempted or accepted policy/token change.
The governing document is held fixed; weakening it cannot count as repair.

Render at 390×844 and 1280×900. Require a nonempty page, the task's visible text,
and its specified interactions. An empty page, hidden required content, removed
styles used to evade analysis, removal or renaming of the required recipe
identity to escape its contract, new uncovered styling, or a broken button is a
failed task even if its finding count is zero. Accessibility checks can add
evidence but cannot certify every interaction or visual intent.

Human review is blind to condition and looks at paired renderings and the task.
Collect intent preserved / uncertain / lost, plus a preference or tie. These
ratings remain pending until a person provides them. Automated visibility and
interaction results are never relabeled as human intent judgments.

## Decision declared before runs

This small pilot supports adoption of feedback, not a universal model claim.
Proceed to a larger trial only if all of the following hold:

- No accepted repair overwrites a concurrent edit or changes the governing
  policy; no empty/hidden-output bypass is counted as success.
- All seeded violations are correctly identified and the clean control has
  no false positive before models are involved.
- The diagnostics arm improves completed repairs by at least two runs out of
  18, or ties completion while reducing median correction rounds or measured
  spend by at least 20%. Report the raw small-sample counts alongside percentages.
- The diagnostics arm has no more intent-lost human ratings or interaction
  failures than control, and introduces no additional unexamined styling.

If both arms already succeed immediately, record a ceiling effect. If costs,
ratings or coverage cannot be compared, the conclusion is inconclusive. Keep
compliance, task behavior, human judgment and cost in separate columns.

## Execution mechanism and cost interpretation, frozen before model runs

The model supplies candidate HTML with an empty toolset in both conditions.
A host harness starts a fresh local daemon and synthetic canvas for each run,
then applies the candidate through the shipped `CanvasHandle.designRepair`
API using the actual captured version, governing provenance and rule version.
It audits and renders the accepted stored bytes. This is a bounded correction
pilot; it does not measure autonomous tool selection or context discovery.
The scoped task uses real groups and the shared governing resolver. The selected
and adjacent design documents, including their version histories, stay fixed.
An unchanged clean candidate creates no new content version. A real stale-write
negative control must refuse and retain the concurrent edit.

Each round supplies the current HTML, the same task, the same governing document
and the same instruction to preserve its intent. Only the diagnostics arm also
receives actual current findings and coverage. Both arms stop under the same
complete-repair predicate or after two attempts; invalid output consumes an
attempt. Even the initially clean control receives a first call so unnecessary
edits can be observed. Candidate output cannot select or modify a policy document.

Freeze literal HTML, DESIGN.md and semantic/style/behavior invariants before
implementing the scorer. Browser checks inspect actual DOM, computed styles,
required text rectangles and clipping at both sizes, and focus and click the
real button. A script-free native popover supplies the fixture click response;
Chrome preflight confirmed it at both target sizes. Regex presence alone cannot
prove visibility or interaction. Keep explicit negative controls for empty,
hidden, clipped, style-deleted, recipe-removed/renamed, newly uncovered and
broken-interaction output. Fixture hashes and scorer/source hashes identify
exactly what ran. Missing browser or audit evidence fails readiness explicitly.

Use Claude Code's exact requested model `claude-sonnet-5` for the proposed
pilot, with the CLI version, reported model identity and usage recorded per
call. Freeze the same output-token allowance (8,192), reasoning effort, empty
toolset, one CLI turn and zero application retries for each condition. Start
from a clean scratch working directory with local customizations and MCP tools
disabled. Ordinary JSON CLI output carries a strictly parsed candidate JSON
object; no structured-output repair loop gets extra hidden correction attempts.
Mismatched model identity, missing cost, invalid usage or an unconfirmed outcome
stops the comparison rather than being assigned zero cost or clean success.

Read-only preflight on 14 September found Claude Code 2.1.269 signed in through
Claude Max. A run therefore consumes that subscription's quota; the CLI's
reported dollar cost is **API-equivalent cost**, not evidence of a new invoice.
Actual billed spend remains unavailable without billing evidence. The published
Sonnet 5 base API prices are $2 per million input tokens and $10 per million
output tokens; token estimates do not replace actual reported cost.
[Model pricing](https://platform.claude.com/docs/en/about-claude/pricing),
[CLI budget flags](https://code.claude.com/docs/en/cli-reference),
[output and retry controls](https://code.claude.com/docs/en/env-vars).

The proposed approval is a $10 aggregate API-equivalent budget over at most
72 calls. It is not approved by this document. Each call's allowance is fixed
at no more than the approved aggregate divided by 72, and can only shrink as
the remaining budget shrinks; unused earlier allowances never enlarge later
ones. Pass the per-call cap to the real CLI and stop if its reported cost exceeds
it. Provider/CLI budget enforcement remains unmeasured until an approved run;
a dry run tests accounting and refusal controls with labelled synthetic data.
If the provider cannot enforce the stated bound, do not advertise a hard cap
or run the pilot under that assumption. Report cost comparisons explicitly as
API-equivalent. The decision rule's 20% cost branch uses that named metric,
while actual billed-spend comparison remains unavailable.

A dry-run report contains zero model calls and no model-lift verdict. It writes
reviewable per-attempt inputs, candidates, receipts, audits and screenshots,
plus a blind paired review sheet with ratings left empty and a separate arm key.
The human gate remains pending until a person supplies preserved/uncertain/lost
and preference/tie ratings. Do not infer those values from the browser checks.

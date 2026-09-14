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
person after the dry run is reviewable; divide it across the maximum remaining
calls, enforce a per-call cap through the runner, and stop when the aggregate
budget is exhausted. Missing cost data is unavailable, never zero. Do not call
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
and actual reported spend. Record any attempted or accepted policy/token change.
The governing document is held fixed; weakening it cannot count as repair.

Render at 390×844 and 1280×900. Require a nonempty page, the task's visible text,
and its specified interactions. An empty page, hidden required content, removed
styles used to evade analysis, new uncovered styling, or a broken button is a
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

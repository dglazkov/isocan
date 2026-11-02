# Design partnership evidence

The [report](../2026-09-14-design-partner.md) separates source behavior from
product-quality hypotheses. Run `node docs/research/design-partner/probe.mjs`
from the repository to reproduce the questionnaire/helper and source checks.
The default pins remote-main commit `cb272b208608d0a78bbd0c0435a78f3dccb72e3d`;
an optional argument selects another locally available git ref. No network,
canvas access, application mutation or model call is required. The probe
executes the actual exported parser and active-question selector with the
same ref's system-actor classifier; it does not render the component.

Recorded outputs are in [results-2026-09-14.json](results-2026-09-14.json).
The existing [native HTML probe](../shadcn-lint/probe.mjs) was also repeated;
all seven cases matched the findings in the design-lint research.

Validation during the research pass on the shared checkout, 14 September 2026:

- `npm run typecheck` passed.
- `npm test`: 4,775 passed, 4 failed, 111 skipped. The failures were the
  pre-existing conduct-skill directory conflict and three recap timeouts.
- The two recap files passed when rerun with two workers: five tests passed.
  This does not establish that the full-suite timing issue is resolved.
- Focused roadmap, design-standing, design-audit and command tests: 51 passed.
- Local report links and all 25 footnotes resolve; `roadmap.mjs --check` and
  `git diff --check` passed.

No product implementation changed. The full suite is not claimed green; no
deep-lane, production browser journey or model-quality benchmark was run.

The subsequent [planning verification](../../projects/design-partner/verification/planning-2026-09-14.md)
records the latest complete suite and metadata checks after the execution
outline moved into the design-partner project. Its documentation checks pass;
the full suite still has the existing skill conflict and recap timeout.

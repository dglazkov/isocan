---
status: noted
since: 2026-10-27
see: practice
note: "The clean nightly source reproduces the overdue cold-start review; the original run's complete failure details were not retained. The guide now meets 3500 tokens and the nightly/test budgets are checked for agreement. Shared Plates diagnostics remain upstream work; full validation awaits resource coordination."
---

# 27 October 2026 — Isocan's nightly gate evidence

The clean nightly source was `ba2758cb97e6c45aeaf9c6b3784230fff2661a57`.
[Run 40468512896](https://github.com/dglazkov/isocan/actions/runs/40468512896)
recorded the configured command `npm test && npm run typecheck && node --test
tests/loop.test.mjs` exiting 1 after 472,098 ms. Its sole retained artifact,
`plates-test-runs` (12717338520), contains a completed outer gate receipt with
that commit, `dirty: false`, status 1, no signal and an empty test list.
The job log also says only `exit 1; no node test summary`.

## What can be proved

On that commit, with the clock at 27 October, the focused command
`npm test -- test/review-queue.test.ts packages/cli/test/agent-guide.test.ts
--maxWorkers=2` failed exactly one of 43 tests: the 23 October architect
finding that 3,505 tokens exceeded 3,500 was unanswered for four days.
Thus the nightly source has a reproducible failure in the first stage;
the `&&` chain stops there. This establishes a genuine cause, but does not
prove that it was the only failure in the historical full run.

The later [Loop run 40484052659](https://github.com/dglazkov/isocan/actions/runs/40484052659)
retained the detailed output: exactly that review-age failure, with 8,784
passing and 112 skipped tests. Its insight collection succeeded.

The mismatch originated in `29bd7a62c`: the cold-start test was raised to
3,600 for motion's topic index while `.agents/personas/architect.md` retained
3,500. Restoring the test to 3,500 produced a direct failure on the old prose
(3,505 measured). Trimming the opening paragraph brings the measurement to
3,477. The finding is accepted with this rationale; the test now also checks
that its limit and the architect's parsed goal agree.

## Shared Plates diagnostics gap

In the installed Plates 0.8.35 code, `scripts/plates/test-ledger.mjs`'s
`timedCommand` captures stdout/stderr in pipes but records only the outer
status, duration and empty test list. `scripts/plates/improve.mjs`'s
`gateRun` inspects that output for Node test counts and then drops it.
The workflow retains `.plates/test-runs`, but neither the raw captured
output nor Isocan's `.isocan/test-profile.json` is in that artifact.
Consequently the original Vitest assertions cannot be recovered from the
retained nightly artifacts or job log. A missing Node summary is not proof
that no tests ran; Vitest has a different summary format.

This branch does not edit those managed files. The upstream Plates guardrail
work should retain bounded, redacted failing-command diagnostics and runner
summaries with their provenance, including fixtures for a Vitest failure
followed by commands that must not execute. It must keep the original exit
status and coverage. No diagnostics can retroactively prove missing output.

## Validation scope

The final focused run passes 54 tests across the review queue, agent guide
and CLI surface. `node --test tests/loop.test.mjs` passes both tests;
`node scripts/reviews.mjs --check` confirms the generated index is current.
`npm run typecheck` passes across all workspaces and the root test config.
The nine record-consistency tests pass after adding this note and regenerating
the roadmap. A temporary test copy with the budget changed back to 3,600
fails specifically at the new agreement assertion (3,500 versus 3,600);
the control copy was removed afterward.
Full-suite validation is pending resource coordination with the parent:
the offline-save task owns the Mac's expensive validation slot. No full
suite or production build was started by this task.

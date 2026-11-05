# Journey guardrails — the walk

**Where we are:** phases 1–2 CLOSED, phase 3 NOT STARTED, 5 November 2026.
Next: phase 3, measured timing claims. One integrated deep suite and typecheck
remain required before pushing the finished branch. Work is isolated on a draft branch;
merge and deployment are outside this session's authorization.

The November 2 run (41487853956) lost reporting before its failure verdict.
The November 5 run (42055435592, source 3299d27) completed 45/57 journeys:
two Undo controls were covered by `canvas-finding`, and several grounds failed
timing or sampling assertions. These are observations, not product diagnoses.
Keep real hit testing, fail on missing readiness, and never relax thresholds
to explain away a slow runner. The design is in [design.md](design.md).

## Phase 1 — A browser either becomes ready or fails

**Status: CLOSED.** 5 November 2026 — readiness and transport proofs passed
on the draft branch; nothing merged or deployed.

**Work:** bound Chrome socket connection, CDP replies and event waits, release
pending calls on disconnect, and retain owned cleanup. Wait for actual canvas
readiness after creation and navigation. Reproduce both Undo coverage cases
in the built browser and distinguish transient loading from a product defect.

**Proof:** focused browser transport and readiness regression tests including
a peer that never replies and a veil that never clears; existing browser
startup/teardown guards; built-browser `design-contract`, `design-lint`,
`text-tool` and runner selftest. Keep real pointer coverage assertions.

### Trajectory

- **2026-11-05** — `canvas-finding` is the class rendered by
  `CanvasArrivalVeil`; `.world` can mount beneath it. Both Undo journeys passed
  at native speed and the controlled 6× CPU probe also passed. The CI failures
  remain observations, not confirmed product defects.
- **2026-11-05** — The shared transport also serves long local-judge batches.
  Those callers now declare a finite budget derived from their documented
  CPU measurements instead of inheriting the 30-second interactive bound.

**Verification:** conductor focused run: 6 files, 63 tests, exit 0 on Node
24.13.0 (`browser-transport`, `browser-start`, `browser-teardown`, `canvas-ready`,
`journeys`, `records`). Built app and isolated browser walks `design-contract`,
`design-lint`, `text-tool`, and `--selftest` all exited 0. The selftest printed
its intentional failure. Readiness tests execute the shipped expression against
mounted, fading, permanently covered and wrong-route DOM states; pointer hit
testing is unchanged. The full integrated pre-push gate belongs to phase 2.

## Phase 2 — A failure survives interrupted reporting

**Status: CLOSED.** 5 November 2026 — interruption, workflow shell and
end-to-end selftest proofs passed on the draft branch.

**Work:** persist a checkpoint before starting and after each journey; report
incomplete runs honestly. Stream output, fail the walk before comment posting,
reserve bounded reporting time and upload available diagnostics even on failure.

**Proof:** execute workflow shell against success, failure, crash and interrupted
runner fixtures; verify checkpoint survives interruption, partial is never clean,
and failed/hung comment posting cannot erase the walk's failure. Focused workflow
and runner regressions, then one integrated deep suite and typecheck before push.

### Trajectory

- **2026-11-05** — A checkpoint must precede cleanup, not just the next
  journey. The failure can otherwise vanish while Chrome is being stopped.
  SIGKILL regressions preserve it during cleanup and the next rig's setup.
- **2026-11-05** — The workflow now fails its walk step before network
  reporting. Step budgets sum to 44 minutes inside a 45-minute job: 15 for
  setup, 26 for walking, two for artifact upload and one for the comment.
  Upload is best effort on cancellation, not a promise after a hard job kill.

**Verification:** Node 24.13.0 focused workflow/progress run passed 76 tests
in three files, exit 0. The conductor independently ran the preceding 73-test
set and the real `--selftest --checkpoint /tmp/isocan-selftest-checkpoint.json`:
exit 0 with the required deliberate failure, `complete:true`, `failing:1`,
`cleanupComplete:true`, and setup/walk/cleanup durations in the checkpoint.
The shipped workflow shell rejects a failed test, nonzero runner without FAIL,
false clean exit, missing/incomplete checkpoint and failed tee; the shipped
orchestrator survives SIGKILL with the prior failure preserved.

## Phase 3 — Timing claims measured in the browser

**Status: NOT STARTED.** 5 November 2026.

**Work:** inspect and reproduce the November 5 ground-motion and timing failures
with isolated browser walks. Record elapsed time and measurement boundaries;
correct sampling/readiness errors where proved. Preserve existing product bounds.

**Proof:** targeted walks with raw measurements, a concrete account of which
failures reproduce, and focused regressions for any changed measurements. Leave
unreproduced CI/environment differences explicitly open. No costly full walk or
paid reviewer is required merely to classify these findings.

### Trajectory

*nothing — implementation has not started.*

# Journey guardrails — the walk

**Where we are:** phases 1–3 NOT STARTED, 5 November 2026. Next: phase 1,
bounded browser readiness and transport. Work is isolated on a draft branch;
merge and deployment are outside this session's authorization.

The November 2 run (41487853956) lost reporting before its failure verdict.
The November 5 run (42055435592, source 3299d27) completed 45/57 journeys:
two Undo controls were covered by `canvas-finding`, and several grounds failed
timing or sampling assertions. These are observations, not product diagnoses.
Keep real hit testing, fail on missing readiness, and never relax thresholds
to explain away a slow runner. The design is in [design.md](design.md).

## Phase 1 — A browser either becomes ready or fails

**Status: NOT STARTED.** 5 November 2026.

**Work:** bound Chrome socket connection, CDP replies and event waits, release
pending calls on disconnect, and retain owned cleanup. Wait for actual canvas
readiness after creation and navigation. Reproduce both Undo coverage cases
in the built browser and distinguish transient loading from a product defect.

**Proof:** focused browser transport and readiness regression tests including
a peer that never replies and a veil that never clears; existing browser
startup/teardown guards; built-browser `design-contract`, `design-lint`,
`text-tool` and runner selftest. Keep real pointer coverage assertions.

### Trajectory

*nothing — implementation has not started.*

## Phase 2 — A failure survives interrupted reporting

**Status: NOT STARTED.** 5 November 2026.

**Work:** persist a checkpoint before starting and after each journey; report
incomplete runs honestly. Stream output, fail the walk before comment posting,
reserve bounded reporting time and upload available diagnostics even on failure.

**Proof:** execute workflow shell against success, failure, crash and interrupted
runner fixtures; verify checkpoint survives interruption, partial is never clean,
and failed/hung comment posting cannot erase the walk's failure. Focused workflow
and runner regressions, then one integrated deep suite and typecheck before push.

### Trajectory

*nothing — implementation has not started.*

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

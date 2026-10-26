# Phase 113 evidence — 23 October 2026

Implementation is in an isolated worktree from
`e59d061a02ae44bf02a45a02a3e47095ab2688f7`. A first integrated checkpoint passed;
independent source review then required an output-error cleanup correction.
Corrected local gates and independent source review passed at `b81481fe4`.
Hosted verification and parent approval remain pending. No speed improvement
or complete hosted gate is claimed.

## Inputs and dependency inventory

The source fleet manifest, consumer config and origin agree on
`dglazkov/isocan`. The canonical checkout's unrelated motion work was not
copied or edited. Node is the repository's pinned 24.22.1; npm is 11.19.1.
Focused checks used a private dependency copy: 741 installed lock entries
matched, no versions differed, and all 75 absent entries were optional
platform packages. This is not evidence of a fresh `npm ci`.

Java 27 is available locally, but this checkout's discovered gcloud SDK lacks
the Firestore emulator component. The initial worktree inventory had no web
bundle; fresh installation and explicit builds subsequently produced it.
The hosted setup still pins Java 21 and installs the emulator. Local deep
coverage and strict hosted CI coverage are not asserted to be equivalent.

## Independent focused proof

All commands below used Node 24.22.1 and returned exit 0:

- Earlier checkpoint `ISOCAN_TEST_REQUIRE_PROCESS_SNAPSHOT=1 node --test scripts/install-watchdog.test.mjs`:
  14 controls passed in 5.373 seconds, with actual process inspection required.
- Earlier checkpoint `node node_modules/vitest/vitest.mjs run test/install-watchdog.test.ts test/workflows.test.ts test/switches.test.ts --maxWorkers=1`:
  38 tests passed across 3 files in 6.25 seconds after the backpressure correction.
- `node node_modules/vitest/vitest.mjs run test/install-watchdog.test.ts test/workflows.test.ts test/switches.test.ts test/sharding.test.ts test/records.test.ts test/teardown.test.ts test/packaging.test.ts test/unused-exports.test.ts test/undocumented-exports.test.ts packages/core/test/docstatus.test.ts --maxWorkers=1`:
  89 tests passed across 10 files, 36.05 seconds before that correction.
- `node --test tests/loop.test.mjs`: 2 passed.
- `npm run lint`: passed.
- `node scripts/roadmap.mjs --check` and `git diff --check`: passed.

Before implementation, five focused workflow/switch/shard/record/docstatus
files passed 68 tests in 2.62 seconds. This is a different test set from the
candidate and is not a comparable timing baseline. CPU and queue durations
were not measured. Repeated synthetic timeout controls are correctness proof,
not an npm-install benchmark.

A direct comparison to the base confirmed unchanged PR/release `run:` command
sequences and four-shard matrices. The only caller additions label stages for
the shared action; the action wraps its existing installation and retains the
diagnostic artifact. Existing test/profile artifacts and every mandatory
product/check command remain present.

## Failed attempts and review corrections

The builder's first Node run failed a mutation case because its fixture
shared input objects; changing one record changed all of them. The original
tool output was not saved as a file, so the retained record is explicitly a
transcript summary, not a reconstructed log. Independent fixture objects now
allow mutations to test mismatches.

The first process-inspection run failed an assertion that expected the report
not to have advanced after TERM: a heartbeat could update it before the child
read it. The failed log is retained. The proof now records pre-signal evidence
ordering, and atomic report replacement prevents partial heartbeat reads.

Code review also corrected a descendant liveness probe that confused a PID
with its group ID; the control now proves the descendant is alive before
cleanup. Retry controls reject removal of both a stage and its job, fabricated
matching manifest hashes, malformed runtime/provenance and second retries.
None of these failures was relabelled as a passing product gate.

Output review found that ignoring a blocked destination's return value could
buffer unbounded child output. Three failed Node attempts and one failed bridge
attempt were retained while correcting forwarding: Node automatically resumes
child pipes on exit, and fixed-size reads can delay small output. Pull-based
forwarding now caps each read at 64 KiB and waits for destination drain. Controls
prove bounded queued output, active deadline/heartbeat while blocked, and full
successful output after a delayed drain. The earlier 14-control proof above includes
these cases. Local Git fsmonitor emitted daemon errors during focused switch
fixtures; the test process still returned zero, and this is recorded rather than
removed from its log.

## First integrated checkpoint and source review

After Ledger released its slot, the parent assigned isocan the next slot.
Admission showed zero used/no leases and no competing heavy commands were found.
Fetched `origin/main` was unchanged. At `8f3d2ad8b`, Node 24.22.1/npm 11.19.1:

| Command | Exit | Wall | User / system CPU |
| --- | --- | --- | --- |
| Watchdog running unchanged `npm ci` | 0 | 16.42 s | 24.21 / 14.03 s |
| Explicit `npm run build` | 0 | 9.06 s | 19.92 / 1.89 s |
| `npm run test:deep` | 0 | 415.49 s | 1792.28 / 329.17 s |

Deep reported 892 files passed, 11 skipped; 9,344 tests passed, 115 skipped.
These local skips are not strict hosted coverage. Times are `/usr/bin/time`
measurements with different local hardware, cache and coverage from the audit;
they establish no comparable hosted speed gain. The install used a private npm
cache and a scoped `GIT_CONFIG` so prepare's merge-driver registration did not
change the canonical checkout's shared config. Flags/lifecycle were unchanged.
The explicit build separately confirmed success because existing prepare does
not propagate its build subprocess exit. npm warnings were retained; no
dependency, install-script policy or security setting was changed.

A fresh source reviewer found one P2: an output destination's asynchronous
`EPIPE` or synchronous write exception could exit the wrapper before cleanup,
leaving its detached installer alive and the diagnostic marked running. This
was validated from source. The first deep pass does not prove that case; the
correction and its new controls require final validation. No other actionable
source findings were reported. Four new controls failed against that checkpoint,
including late output failure after installer exit zero. A real unread OS pipe
also kept the wrapper alive after supervision returned 124; that failed control
is retained. The CLI now exits nonzero only after bounded cleanup/reporting,
while success flushes normally. A delayed `_destroy` control exposed premature
error-listener removal; the corrected listener survives until actual error/close.
An invalid first observer used asynchronous persistence during a fatal event;
it is retained separately and was replaced by synchronous observation.

The builder's corrected 20 controls passed, including actual process snapshots.
Fresh source review of the correction found no remaining actionable findings.
This review covered the earlier complete base diff plus the correction, without
claiming a hosted or final-commit review. The conductor independently passed
20/20 controls with required process snapshots in 10.315 seconds, then 69 tests
across the bridge/workflow/switch/record/changelog/docstatus files in 13.04
seconds with one worker. Both commands returned zero. Spin lint was clean.

## Corrected integrated proof

On clean `b81481fe46b734336de7b8ee74ebde7b5122bc4a`, with unchanged fetched base:

| Command | Exit | Wall | User / system CPU |
| --- | --- | --- | --- |
| Watchdog running unchanged `npm ci` | 0 | 7.56 s | 5.12 / 13.89 s |
| Explicit `npm run build` | 0 | 9.45 s | 19.54 / 1.94 s |
| `npm run test:deep` | 0 | 408.76 s | 1708.41 / 319.44 s |
| `npm run typecheck` | 0 | 87.14 s | 165.02 / 5.47 s |

Deep again reported 892 files passed, 11 skipped; 9,344 tests passed, 115
skipped. The loop command passed 2/2. Direct `npm run lint` passed; its preceding
timed attempt returned 1 because the timing utility's `sysctl kern.clockrate`
read was sandbox-denied, not because ESLint reported a finding. Both attempts
are retained. The install cache was now populated and the bundle already
existed; the 7.56-second result is not a matched comparison to 16.42 seconds.
No code changed during the gates.

A separate complete-diff source review pinned this head and base and found no
remaining actionable code findings. The final documentation update corrects
historical wording and records results; targeted record checks cover it.

## Remaining acceptance and coordination

The emulator uses `detached: true`, so this task does not claim the admission
wrapper's cooperative foreground contract; parent-controlled serialization is
was used. Local heavy work ended and the slot was released at 02:11 UTC;
process inspection found no remaining validation/worktree children. The shared
admission status then refused a hostname binding mismatch despite matching UID
and a raw state file with zero leases. That state was left untouched for parent
inspection; no valid current admission receipt is claimed. All failures and
skips remain in the evidence.

The complete strict CI shard union/checks must hold at the PR head. This repo
has no committed `ready_for_review` review workflow or cross-review practice;
its `review.yml` runs mechanical metrics on main pushes. Any review produced
at the PR boundary must be inspected for actual head and complete input; local
source review and green CI do not manufacture hosted review evidence.

The planner is read-only and cannot authenticate supplied artifacts or grant
reuse authority. [The manual path](design.md#a-conservative-retry-decision)
separates requested-input eligibility from verifying the actual rerun and all
mandatory outcomes. Hosted retry execution and comparable cold/warm install
timings have not been measured. No merge, deployment, security permission,
schedule or gate policy was changed.

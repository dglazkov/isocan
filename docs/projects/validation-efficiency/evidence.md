# Phase 113 evidence — 23 October 2026

Implementation and focused verification are complete in an isolated worktree
from `e59d061a02ae44bf02a45a02a3e47095ab2688f7`. Required integrated gates,
hosted verification, independent exact-head PR review and parent approval are
pending. This is not a completed gate or a speed-improvement claim.

## Inputs and dependency inventory

The source fleet manifest, consumer config and origin agree on
`dglazkov/isocan`. The canonical checkout's unrelated motion work was not
copied or edited. Node is the repository's pinned 24.22.1; npm is 11.19.1.
Focused checks used a private dependency copy: 741 installed lock entries
matched, no versions differed, and all 75 absent entries were optional
platform packages. This is not evidence of a fresh `npm ci`.

Java 27 is available locally, but this checkout's discovered gcloud SDK lacks
the Firestore emulator component. The fresh worktree has no web bundle yet.
The hosted setup still pins Java 21 and installs the emulator. Local deep
coverage and strict hosted CI coverage are not asserted to be equivalent.

## Independent focused proof

All commands below used Node 24.22.1 and returned exit 0:

- Final `ISOCAN_TEST_REQUIRE_PROCESS_SNAPSHOT=1 node --test scripts/install-watchdog.test.mjs`:
  14 controls passed in 5.373 seconds, with actual process inspection required.
- Final `node node_modules/vitest/vitest.mjs run test/install-watchdog.test.ts test/workflows.test.ts test/switches.test.ts --maxWorkers=1`:
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
successful output after a delayed drain. The final 14-control proof above includes
these cases. Local Git fsmonitor emitted daemon errors during focused switch
fixtures; the test process still returned zero, and this is recorded rather than
removed from its log.

## Remaining acceptance and coordination

Ledger owns the next shared local heavy slot by parent direction. No isocan
full suite or install/build has started. The emulator uses `detached: true`,
so this task does not claim the admission wrapper's cooperative foreground
contract; parent-controlled serialization is required.

After the slot is released: refresh/integrate the remote base, preserve the
exact candidate, run the unchanged fresh installation/build and required
deep/typecheck/configured checkpoint, then create the draft PR and inspect its
complete strict CI shard union/checks at the exact head. Preserve any failures
and skips. Do not push before the mandatory local deep/typecheck proof holds.

The planner is read-only and cannot authenticate supplied artifacts or grant
reuse authority. [The manual path](design.md#a-conservative-retry-decision)
separates requested-input eligibility from verifying the actual rerun and all
mandatory outcomes. Hosted retry execution and comparable cold/warm install
timings have not been measured. No merge, deployment, security permission,
schedule or gate policy was changed.

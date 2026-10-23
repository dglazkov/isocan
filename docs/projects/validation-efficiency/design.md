---
status: partial
since: 2026-10-23
note: "Phase 113 PART-DONE: bounded install diagnostics and conservative retry planning pass focused proof; required final gates and parent review remain pending."
---

# Install evidence before the job deadline

The 22 October retained audit found one shared suite setup still running at
1,203 seconds, before its tests began. Four successful setup observations
were 46–67 seconds. The complete checks job took 380 seconds, longer than the
slowest healthy suite shard at 346 seconds. These are observations from one
hosted run, not a benchmark or an argument for additional shards.

## Supervise the existing installation

Both PR and release jobs call `.github/actions/suite-setup`. Keep its toolchain
steps and exact `npm ci` flags/lifecycle; supervise that installer separately
from the suite. The provisional deadline is 300 seconds, heartbeat 15 seconds,
and TERM grace five seconds. Process inspection is separately bounded to one
second per snapshot. Thus termination includes bounded diagnostic and cleanup
overhead after the installation deadline; the 15/20-minute enclosing job
timeouts are unchanged.

The report records start/completion, elapsed/heartbeat/last-output offsets,
installer exit code or signal, watchdog outcome, process-group identifiers and
states, input hashes and run/stage identity. It records no environment dump,
process arguments or npm output. Normal npm output still streams to the job
log through bounded reads that stop when the destination needs to drain;
backpressure does not suspend heartbeat or deadline timers. Normal completion
waits for trailing pipe output. A missing process snapshot is explicitly unavailable, never an empty
healthy tree. The pre-TERM report is written before signalling, then cleanup
signals the entire group even if its leader already exited. A timeout remains
failure even when a TERM handler exits zero. Evidence-write failure cannot
turn a failed installation green.

Output exceptions and asynchronous stream errors take the same bounded cleanup
path and retain only the stream identity and error code. Late write callbacks
must settle before success; broken-stream error listeners remain through actual
error/close delivery. After failed supervision, the CLI exits explicitly so an
unread OS log pipe cannot keep it alive. Pending log bytes may be lost on failure;
the final synchronous JSON report and installer outcome remain. Successful runs
drain normally.

Each stage/attempt gets its own retained JSON artifact. The normal four-shard
test union, anti-skip switches, typecheck, lint, release graders, metrics and
roadmap steps remain intact. Dependency installation does not attest any of
those later results.

## A conservative retry decision

`node scripts/install-retry-plan.mjs <retained-evidence.json>` is a read-only
planner. Exit zero means its proposal checks passed; it is neither a complete
gate verdict nor a command to rerun a job. Exit one rejects missing evidence,
changed inputs, product/harness failures or a further retry.

The input carries schema/repository, original and candidate attempt identities,
observed original and requested candidate head/tree/lock/runtime/setup/flags/manifest inputs, the expected stages,
and original job identities/conclusions/timestamps. A failed job also needs
the retained watchdog diagnostic, artifact provenance, evidence that product
steps never started, and an explicit operator classification of the timeout
as transient setup only. Inspect lifecycle logs before making that judgement:
an npm lifecycle script can itself expose a product failure.

Verify those records against GitHub and the exact source checkout. A proposal
permits at most one failed setup job from attempt 1 to attempt 2; its parentage
and successful siblings' original timestamps remain explicit. Do not add the
same successful duration again when inspecting the retry. A changed setup
invalidates siblings; run a complete new gate. A timeout alone is not evidence
of a transient failure, and the audit's eventual passing retry does not prove
what caused its first stall.

The smallest manual path has two distinct checkpoints:

1. Retrieve the original run's jobs and install artifacts, retaining attempt 1.
   Verify the head, exact source checkout, complete stage set, setup-only
   classification and original observed runtime. Supply the requested fixed
   candidate inputs to the planner. These are an execution requirement, not
   a claim to have observed a future runner. Unknown original or requested
   runtime refuses; never fill an unknown with a guessed version.
2. After explicit operator approval, a single-job rerun may be requested with
   `gh run rerun <run-id> --job <failed-job-id> --repo dglazkov/isocan`.
   This implementation never invokes that command. Retain attempt 2 and its
   new diagnostic alongside attempt 1. Verify its actual runtime, head,
   lock, setup and manifest against the requested inputs, and inspect every
   mandatory job/step conclusion. Any mismatch invalidates the sibling reuse
   proposal and requires a complete fresh gate. A second failed attempt is
   investigated, never retried into green. Never request a release rerun
   without separate authority for its existing publication consequences.

**Limit:** The planner cannot authenticate supplied records, enforce GitHub
retry admission, or attest the complete gate. A pinned `.nvmrc` is not an
observed runtime. An eligibility proposal is not evidence that actual
execution matched it. No retry is automatic, and this phase does not change
existing mandatory checks or grant reuse authority. The reviewed complete
evidence producer and reuse policy remain Plates phase 114; additional
hosted execution machinery needs an explicit scope decision.

## Verification and rollback

The dependency-free Node negative controls also run from an ordinary Vitest
test, so the CI shard union includes them. They exercise real child processes,
not a fake installer status. The conductor separately checks workflows,
conventions and the complete configured/pre-push gates.

Rollback restores the shared action's plain `npm ci` step and removes its stage
inputs and watchdog/planner files. No product state, dependency lock, scheduler,
security permission, shard count or worker setting changes in this phase.
Measured speed savings and cold/warm p95/p99 remain unknown.

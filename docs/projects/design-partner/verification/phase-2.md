# Phase 2 verification — one admitted design task

Phase 2 CLOSED on 14 September 2026. The conductor independently completed the named browser/CLI walk and the staged-source release gates.

## Source and scope

Execution began after phase 1 at `aca35fc9904cf7c85fc9d009be3e56045c542e16` in
`/Users/dionalmaer/code/isocan-design-partner`. Upstream
`c6ade95c9e359e72719b76739ccae86d595fc798` was integrated before implementation.
The request boundary was settled in separate mechanism commits `d06ed675`,
`f09b4651` and `ff548a6a`. The original checkout and its unrelated staged work
remain untouched. [phase-2-sources.json](phase-2-sources.json) identifies every
staged implementation, instruction, test and harness file by SHA256.

Requests now have canonical admission, a durable compact brief, preserved
source/context, explicit continuation and separate attributed evidence. The web
and CLI read and mutate the same records. Automatic enrollment remains off
unless the canvas chooses `design.workflow=adaptive-v1`; manual starts and
continuation work while it is off. These are correctness and synthetic task
proofs. Generated design quality and real-user partnership remain phase 7 work.

## The named complete task

The conductor ran `node --import tsx scripts/journey-design-request.mjs`
against a fresh owned daemon and freshly built application. Its final clean
run exited 0, including browser teardown. Evidence is
`/var/folders/63/4k_ydj554mz6_56j2hpg7jcr0000gn/T/isocan-personal-journey-sDMTKf`;
log `phase2-clean-journey.log` under `/tmp/isocan-design-partner-execution/`.

All twelve checks passed. A sparse canvas message retained its selected brand
context, admitted an explicit task and asked only the two missing consequential
questions. Actual human answers were reconciled once; external continuation
retained the facts without another initial batch. The equivalent external start
reached the same audience, primary task, delivery, constraints and context titles,
with honest agent-reported provenance. Both actual saved HTML versions completed
empty receipt, invalid quantity, receive 12, save, correct to 10 and save again
at 390 and 1280 pixels. Browser inspection being unavailable produced a draft.

The receipt face detected later output drift; an open receipt form retained its
captured output and refused to publish checks against a concurrent edit. A precise
edit and ordinary HTML import caused no design enrollment or interview. Typed
cancellation refused an old completion, Undo restored the prior version, and
literal requester cancellation still blocked later work.

The connected application used actual loopback stock lookup and receipt
create/read/update routes. Saving the correction and saving again left exactly
one receipt with quantity 10. Its receipt named the complete server-plus-HTML
revision `e227b242996857b9d26cae09f0bf9099ac4329d8802f411f3d896e289b96cc2a`,
build `acme-e227b2429968`, the actual runtime URL, Chrome version and exact
screenshot reference. `proof.json` records the address and observed requests.
This service is a synthetic functional fixture, not a production deployment.

Chrome was `152.0.7977.84`, revision
`@4334922f44c77b1208072c4deac29db3af39bbea`. Four browser error lists were empty.
The conductor inspected the rendered task card, receiving surfaces and narrow
stale receipt. Scripted agents establish routing and material-fact parity;
they do not establish model-generated craft or human preference.

## Independent boundary and recovery checks

Scratch commands below own fresh daemon state, synthetic identities, CLI homes
and browser profiles. Credentials and daemon state are removed at teardown.
No paid provider, live customer canvas or new cloud resource was used.
Evidence suffixes are under `/var/folders/63/4k_ydj554mz6_56j2hpg7jcr0000gn/T/`.

| Command, prefixed with `node --import tsx /tmp/isocan-design-partner-execution/` | Exit | Evidence / what it could disprove |
| --- | --- | --- |
| `phase2-conductor-api.mjs` | 0 | `isocan-design-request-conductor-x3GZBP`: opt-in and manual policy, real requester versus mutator, exact retry, changed-payload/wrong-actor refusal, stale edits, cancellation, epochs, unverified completion and human correction of agent-reported facts |
| `phase2-conductor-retention.mjs` | 0 | `isocan-design-request-conductor-bdmjlL`: two exact versions of one SVG survive pruning, deletion, trash empty, actual GC and restart; archived retry adds no operation |
| `phase2-conductor-source.mjs` | 0 | `isocan-design-request-conductor-Oq8JbO`: quoted/helper cancellation is inert; typed Undo, literal source boundary, body edits, source removal/restoration, generic JSON and old decoder refusal behave distinctly |
| `phase2-conductor-governing.mjs` | 0 | `isocan-design-request-conductor-nP2RxU`: actual lazy system renderer, exact historical evidence after a newer version, changed governing winner, unchanged old hash, unrelated chat and declared live-context drift |
| `phase2-conductor-questions.mjs` | 0 | `isocan-design-request-conductor-tOLtgW`: real CLI with long version IDs, partial-batch refusal, all effective answer identities, brief drift, skipped facts and continuation without a second initial allowance |
| `phase2-conductor-browser.mjs` | 0 | `isocan-design-request-conductor-eXn99a`: stale correction across refresh, explicit review, HTTP503 exact retry across a switch to another canvas with the same request ID, HTTP408 after commit confirmed once, no-browser draft and live narrow receipt drift |

GC archived ten operations, retained five reachable blobs and swept a deliberately
unreachable 20-byte blob. Both historical SVG versions remained readable after
restart, and a later brief update retained both. This tests collection, not
merely a live version stack. Nested retained metadata stays flat and carries the
original public author rather than local transport-binding fields.

The five API commands ran before the last packaging/export/hook guard correction;
their request behavior did not change afterwards. Final fast and strict suites
exercise the frozen writer and reader. The final browser replay used the final
application bundle; the complete journey additionally used the corrected owned
browser cleanup.

## Failures and corrections

The first staged full fast run exited 1 with four failures (542 files and 5,578
tests passed). Shipped declarations retained a new workspace subpath, internal
exports exceeded the existing ceiling, a hook returned a fresh object, and the
synthetic connected runtime used the daemon's reserved `/api/` namespace.
The fixes map emitted declarations through actual workspace exports and verify
the targets, keep two declarations private, memoize the mutation hook, and use
`/warehouse/` routes for the synthetic application. No ceiling or boundary was
weakened. The corrected full fast run passed 5,582 tests in 170.86 seconds.

That corrected-source task journey passed every task assertion in `0djiOp` but
exited 1 during owned Chrome teardown. It is not counted as a clean proof.
Instrumentation found that synchronous profile removal can defer another
browser's exit notification until its stop timer escalates. The helper now awaits
the same retried removal without blocking the event loop; process deadlines and
failure assertions remain unchanged.

The conductor independently ran the initial real-process regression: 2 tests
passed in 6.61 seconds. Two real owned Chrome processes
exit normally using only SIGTERM with asynchronous cleanup. A data-URL copy
restoring synchronous removal produces a spurious SIGKILL despite a normal
exit code 0. The causal barrier arms both stop timers before removal, and an
owned resumer is awaited. The negative control proves unnecessary escalation;
it does not reproduce the original final timeout. Its intentional 2.2-second
blocked-loop warning is expected. The clean complete journey then exited 0. However, the subsequent full fast
run exposed that this regression also depended on real Chrome termination
latency: the fixed case legitimately reached SIGKILL under load. The suite test
was replaced with controlled process/socket/removal I/O executing the actual
helper close body. It checks concurrent exit delivery, awaited retried removal,
and failure when termination does not complete. The real Chrome instrumentation
and complete journey remain separate integration evidence; the suite no longer
pauses actual browsers to make a scheduling assertion.

Other independent probes corrected real implementation defects: receipt drafts
must capture exact versions before checks are entered; partial question batches
must settle before a single reconciliation; long CLI version IDs need bounded
full-identity retry hashes; read status must use structured availability rather
than parse error wording; and start Undo/Redo must restore canonical identity.
Browser inspection also caught a squeezed task card and an unfinished loading
state. Source/body tampering and response supersession remain distinct from
ordinary brief drift and historical citation updates.

## Final frozen-source gates

All 85 intended source files were staged before the final gate. The built entry
is `index-ksDn3RHN.js`, **721,204 bytes**, below the unchanged **743,900-byte**
ceiling; SHA256
`664f987a49090624941a61567706de10100ce65cea06d83a0590bb97b0565fcf`.
Application source and bundle did not change during the cleanup-only correction.

| Command | Result |
| --- | --- |
| `npm run build` | Exit 0; `phase2-final-build.log` |
| `npm run typecheck` | Exit 0; `phase2-land-typecheck.log` |
| `npm test -- --maxWorkers=6` | Exit 0; 547 files / 5,585 tests passed, 108 skipped; 163.13 seconds; `phase2-landing-fast.log` |
| `node /tmp/isocan-design-partner-execution/strict-test.mjs phase2-final` | Exit 0; 599 files / 6,148 tests passed, 3 opt-in skips; 424 seconds; `phase2-final-strict.log`; cleanup scope below |
| Named repository journey and independent browser recovery | Exit 0, as above |
| `npx vitest run test/browser-teardown.test.ts test/teardown.test.ts test/deeplist.test.ts --maxWorkers=6` | Exit 0; 16 tests in three files, including three actual-close-body cases; `phase2-conductor-teardown-final.log` |

The strict wrapper owns its loopback Firestore emulator, runs
`npm run test:ci -- --maxWorkers=6`, preserves the suite's exit code and stops
the emulator. The full strict run passed 599 files and 6,148 tests with three opt-in skips in
424 seconds. It validates the frozen application implementation. The subsequent
changes are confined to owned browser profile cleanup and its regression; the
final full fast run, focused cleanup guards and clean complete Chrome journey
cover those changes. The record does not claim that the new cleanup test was
present in that earlier strict run. Logs and local evidence remain in the scratch directory.

## Done on both surfaces

1. **Operations:** canonical `design.request` and `design.receipt`, refusing
   writer validation, preserved source/actor identity, exact retry and ordinary
   reducer/inverse/replay behavior. No separate workflow database.
2. **CLI:** start/read/update/resume/cancel/complete, evidence publication/read,
   exact reference access and shared on-demand procedure; text and JSON retain
   real provenance and uncertainty.
3. **Guide:** actual verbs and examples, with short summons and hosted-agent
   pointers to one procedure. The collaboration skill stays a doorway.
4. **Shared helpers:** core validation and lifecycle, permission-bearing shared
   context/governing readers, response reconciliation and per-check freshness.
   The browser projects the same records in chat, canvas faces and outputs.
5. **README and notes:** describe manual and opt-in behavior, preserved work
   when disabled and the current evidence boundary.
6. **Tests:** meaningful pure and real-daemon tests plus actual browser tasks,
   correction/retry/navigation and rendering. The browser entry ceiling and
   packaging guards remain intact. Human quality measurement is still owed.

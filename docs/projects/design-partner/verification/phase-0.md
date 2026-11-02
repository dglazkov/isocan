# Phase 0 — Baseline and acceptance contracts

The offline preparation proof held on 14 September 2026. This phase establishes
shared record semantics and a runnable comparison preparation path. It does
not ship the questionnaire protocol or measure generated-design quality.

## Source and execution boundary

The reconciled source baseline is
`304346276dbabd3b7c10dff3f55070dbcff10ab2`. Execution used a clean `main`
checkout at `/Users/dionalmaer/code/isocan-design-partner`; the original
checkout's unrelated staged changes were preserved. The orientation commit is
`90e673451a52ba90622e1bd1b8b35652467bfff6`.
[phase-0-source.json](phase-0-source.json) identifies all 76 added implementation,
test and fixture files by SHA-256, with aggregate digest
`158a1ad3ed30c6aa6e24eb027d235fe8451f072f8e52d39b75c111bd9fc4d1c5`.
The phase's landing commit is discoverable with
`git log --all --format='%H %s' --grep='design-partner phase 0:'`.

[baseline-2026-09-14.json](baseline-2026-09-14.json) records the initial full
fast suite, typecheck, source probe and issue states. The probe still reproduces
the questionnaire accepting malformed objects, another agent closing a question,
and uploads retaining filenames. It also records the already-shipped JSON
design-audit improvements. These are source/helper observations, not browser
walks. No production deployment was inspected.

Design-lint phases 1–4 are already closed, with #300 and #301 closed and #302
still open for its remaining human evidence. This project will consume the
shipped shared diagnostics and repair mechanisms. It neither duplicates them
nor uses the separate pilot as evidence for this creation workflow.

## Named offline proof

From the repository root, with fresh output paths:

```sh
node scripts/design-partner-eval.mjs --dry-run --out /tmp/acme-design-full.json
node scripts/design-partner-eval.mjs --validate /tmp/acme-design-full.json
node scripts/design-partner-eval.mjs --dry-run --study smoke
node scripts/design-partner-eval.mjs --dry-run --include-c native
node scripts/design-partner-eval.mjs --baseline inventory --entrance canvas-chat
node scripts/design-partner-eval.mjs --baseline inventory --entrance external-agent
npx vitest run packages/core/test/design-partner.test.ts test/design-partner-eval.test.ts --maxWorkers=2
```

The conductor executed these modes and separately rendered every case through
both baseline entrances: twelve cases, 24 invocation envelopes, 96 full A/B
cells, 16 smoke cells and 144 cells with explicit optional condition C.
All modes made zero provider calls. The final full manifest digest is
`30845bcda49e6fd307574cc363ee21b83b2f6b5db697dd6391271ea16a3b9302`.
An earlier manifest made before the scoped-system fixture correction was
independently rejected with exit 1: changed inputs cannot pass by repeating
their old identity.

The 35 core tests exercise malformed/unknown payloads, respondent and request
association, stale epochs and sources, response replacement, accepted retries
after cancellation, actual conditional item-edit/inverse behavior and target
protection. The 13 evaluation tests exercise real asset/hash reads, removed
comparison arms, missing artifact/context/model identity, incomplete attempts,
unknown spend, mismatched pairs and current failed checks blocking readiness.
The fixture repository actually serves its component, tokens and stock API;
the conductor also started it independently and read those HTTP resources.
That proves the fixture runs, not the future generated application.

The baseline adapter preserves the original summons, full guide and manual
commands. A later measured runner must prepare the pinned source runtime and
materialize the seed snapshots on actual canvases before dispatch. These
snapshots are seed specifications, not fabricated live canvas state. Both
conditions receive the same available facts and answer bank on request.

## Required checks

| Check | Result |
| --- | --- |
| `npm test -- --maxWorkers=4` | Exit 0; 532 files and 5,457 tests passed, 11 files/108 tests skipped; 187.32 seconds |
| `npm run typecheck` | Exit 0 across workspaces |
| `npm run build` | Exit 0 |
| `npm run test:ci -- --maxWorkers=6` with an owned local Firestore emulator | Exit 0; 584 files and 6,014 tests passed, three opt-in tests skipped; 445.10 seconds. Firestore and bundle checks ran |
| Project status/document lint, roadmap regeneration and `git diff --check` | Passed; project lint clean |

The first full fast run found one failure in the new test cleanup: recursive
removal lacked the repository's retry options. The builder fixed that call;
the guard was unchanged. The repeated full fast run above passed. No timeout,
test expectation or bundle budget was weakened.

## Contract and next phase

[contracts.md](../contracts.md) fixes the five record schemas, immutable typed
comment metadata, explicit respondent/epoch/source association, planned native
verbs and shared `design.workflow` policy. Phase 0 exports pure source modules,
not a working `design ask` command. The answer planner explicitly marks its
inner reply as materialization only: the baseline reducer drops unknown typed
comment data. Phase 1 must implement refusing canonical wire acts and writer
validation, including reference retention, custody, undo, retry and replay.

Decision adoption uses one conditional item edit, preserving brief and
alternative items. The future writer must additionally validate the request
and source versions; checking a supplied snapshot is not concurrency control.
The separate protocol bound of 32 questions leaves the ordinary initial
budget at zero to three. An explicit replacement cannot silently reopen an
omitted previously answered question.

Phase 1 is next. Its concrete browser scenarios are recorded in
[browser-scenarios.md](browser-scenarios.md), including real upload bytes,
refresh/back navigation, two successive reference questions, failed-submit
retry, unrelated agent replies, both producer/consumer directions and undo.
Run `bash .claude/skills/conduct/status.sh design-partner` to read the next
phase and its named proof. No paid service, cloud resource or participant is
needed to implement and walk that local phase.

Surface accounting: pure core contracts and tests changed. Runtime operations,
API/CLI verbs, the shipped agent guide, product README and browser behavior
deliberately remain unchanged in phase 0. The offline eval CLI is an instrument,
not a product command. The source baseline and all preparation results remain
explicitly ineligible for a controlled quality comparison until the execution
conditions are frozen and the actual study and independent human review run.

## Release CI correction

The phase landed as `1f7d12e17b249d9e842a73c0974313140a6175ea`. Release
[run 34915545080](https://github.com/dglazkov/isocan/actions/runs/34915545080)
then failed both unchanged export guards: 364 undocumented exports against
a ceiling of 331, and 57 unused exports against 39. The 33 undocumented
additions and 20 new unused declarations were in the two core contract modules. The
local runs above happened before those files were staged; `git ls-files`
therefore omitted them from the measure. Those runs are real, but they did
not establish that this particular tracked-file guard covered the new files.
The `green` deployment gate correctly withheld the failing revision.

The correction adds purpose and boundary comments to those 33 declarations
and keeps presently unused declarations private until a real consumer needs
them. Runtime behavior is unchanged. Receipt parsing explicitly validates record shape;
it does not certify that browser inspection occurred. Both guards and their
ceilings remain unchanged. [Lesson 70](../../../reviews/lessons.md) records the
failure, and the conductor now stages only the intended phase paths before
running the full gate so locally measured sources match committed sources.

Correction verification uses a separate clean checkout at committed
`86b2bdb9` plus the documentation and export-scope patch. Paused phase 1 product changes
remain in the execution checkout and cannot enter these results. With the
correction staged, `node scripts/measure.mjs undocumented-exports` reports
331; `node scripts/measure.mjs unused-exports` reports 37 against 39;
`node scripts/lessons.mjs --check` reports no collisions across 70 lessons. The original source manifest above continues to identify the
original phase 0 implementation, before these documentation and export-scope changes.

The first clean correction run passed 5,456 tests and failed only the unused
export guard (57 against 39). Reading all failed CI shards confirmed it had
also failed in the original release run. The correction therefore covers
both measurements; a single failed job is not a complete CI failure inventory.

The final corrected tree passed the conductor's complete checks:

| Correction check | Result |
| --- | --- |
| `npm test -- --maxWorkers=4` | Exit 0; 532 files, 5,457 tests passed; 11 files/108 tests skipped; 180.00 seconds |
| `npm run typecheck` | Exit 0 across workspaces |
| `npm run test:ci -- --maxWorkers=6` with an owned local Firestore emulator | Exit 0; 584 files, 6,014 tests passed; three opt-in tests skipped; 424.12 seconds |
| Both export measurements, lesson/status lint and `git diff --check` | Passed with unchanged guard limits |

The two corrected files have SHA-256 identities
`7406e5bdb2b50c6faa45fe7ba8c9a33e2707c45acf5016a9b6933257164eb6f5`
(`design-partner.ts`) and
`5fe837130b210ad928eb85d3f311508117d4aedd3f78dd894b9090d7e4fc4098`
(`design-partner-plan.ts`). The conductor compared their TypeScript-emitted
runtime after removing comments and export visibility: both matched the
committed originals. The build produced during clean installation remains
applicable; these modules are not in the phase 0 browser import graph. The
execution checkout receives these exact files, and its staged tree is compared
with the clean verification tree before commit, excluding phase 1's work.

The correction landed as `9fd836f1181c641de77aaa99e4cf34e23b64e150`.
[Release run 34917952577](https://github.com/dglazkov/isocan/actions/runs/34917952577)
then passed all four suite shards, checks and publication;
[review run 34917952606](https://github.com/dglazkov/isocan/actions/runs/34917952606)
also passed. This confirms the committed correction, without asserting a
hosted product walk.

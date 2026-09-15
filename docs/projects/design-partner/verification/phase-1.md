# Phase 1 verification — questions and references

Phase 1 CLOSED on 14 September 2026. The conductor independently ran the named browser/CLI proof and the full staged-source gates.

## Source and scope

Execution began from `9fd836f1181c641de77aaa99e4cf34e23b64e150` in
`/Users/dionalmaer/code/isocan-design-partner`. The original checkout at
`/Users/dionalmaer/code/isocan` retains its unrelated staged work untouched.
The completed phase 0 correction passed release CI before this phase resumed.
Before the final gate, the frozen phase was integrated onto
`e4bc100f550b04aade1e8d00228b07362f955cc6`; its agent-pass work remains intact.

The implementation adds canonical `questionnaire.ask` and
`questionnaire.answer`, immutable comment data, shared reads, exact retained
references and four native CLI verbs. The browser publishes and answers the
same records. Phase 1 still uses an existing valid brief and thread; phase 2
owns ordinary request enrollment and the readable brief projection. This is a
correctness release, not measured evidence of better generated designs.

## Independent checks before the final gate

The conductor's scratch verification tools live under
`/tmp/isocan-design-partner-execution/`. Each owns a fresh file-store daemon,
synthetic identities, its CLI home and Chrome. They clear inherited isocan and
harness settings and remove their own credentials and daemon state at teardown.
No provider, live customer canvas or cloud resource is used.

`node --import tsx /tmp/isocan-design-partner-execution/phase1-conductor-api.mjs`
exited 0 on the pre-freeze implementation. The CLI published a question,
refused another agent's answer, retained two different versions of one SVG item,
answered once through a stable retry, and performed Undo/Redo. The source item
was pruned, deleted and removed from trash. GC archived all 13 operations,
retained three reachable blobs, and actually swept a 26-byte orphan negative
control. After daemon restart, CLI reference reads downloaded both exact SVG
versions. Retrying the already accepted answer after archive added no operation.

Evidence:
`/var/folders/63/4k_ydj554mz6_56j2hpg7jcr0000gn/T/isocan-questionnaire-conductor-IeIrG9`;
log `phase1-conductor-api.log` in the scratch directory. This proves reference
retention after collection, rather than merely finding an old version still
present in a live stack. It is an API/CLI proof, not the browser journey.

The first independent extended Chrome walk exercised explicit transfer after
question supersession, a removed option requiring review, unchanged freeform
recovery, pre-write HTTP 503 followed by refresh and one accepted retry,
malformed legacy text, valid legacy questions after unrelated replies, explicit
browser adoption, a 390 × 844 viewport, keyboard focus, and an accepted write
whose HTTP acknowledgement was replaced with 408. Those assertions passed.
The run then stopped because its harness tried to click the hidden wide-screen
Undo control at narrow width. The screenshot showed the expected narrow shell;
the harness now restores the wide viewport before using that toolbar. This
failed run does not close the browser proof.

That run's evidence is
`/var/folders/63/4k_ydj554mz6_56j2hpg7jcr0000gn/T/isocan-questionnaire-conductor-aKjVit`.
The conductor inspected the actual failure screenshot. Final source/build and
completed reruns will be recorded below.

The corrected independent browser command exited 0 with all eleven checks and
an empty Chrome error list. It exercised browser Undo followed by CLI Redo,
explicit adoption of a valid legacy questionnaire, and human-readable recovery
after a removed option. Evidence:
`/var/folders/63/4k_ydj554mz6_56j2hpg7jcr0000gn/T/isocan-questionnaire-conductor-LC47eB`;
log `phase1-conductor-browser-final.log`.

The extended independent API/CLI command also exited 0. After actual GC and
restart it superseded only the text resolution, retained both original SVG
versions, and downloaded the exact bytes through the replacement answer.
Evidence:
`/var/folders/63/4k_ydj554mz6_56j2hpg7jcr0000gn/T/isocan-questionnaire-conductor-s6a8nS`;
log `phase1-conductor-api-final.log`. GC again swept its orphan negative control;
the initial answer was operation 8 and the replacement operation 14.

The conductor independently captured all thirteen baseline commands from the
clean phase 0 checkout, then deep-compared the implementation's full records
and catalogue metadata. Both comparisons passed: all 41,070 instruction bytes,
aliases and dispatch metadata were unchanged. The browser build reported a
729,629-byte entry against the unchanged 743,900-byte ceiling. Final integrated
gates still follow the last hook and relay-identity corrections.

## Findings that changed the implementation

- A lost acknowledgement can be confirmed by an exact saved comment while the
  original operation ID remains unknown. Shared results now distinguish the
  caller's retry ID, actual canonical operation ID and snapshot/receipt evidence.
  An actor join changes identity comparison without rewriting historical authors.
- Reference retention must include the full identified versions and visual faces.
  A single-entry-per-item context manifest cannot preserve two versions of the
  same source. GC, inverse and replay checks exercise the canonical retained data.
- Request-only feature negotiation missed an old client's ordinary reply that
  reused a questionnaire operation ID. Independent HTTP probing returned the
  original typed receipt. The writer/response boundary must also check the
  actual returned operation and inverse; the new negative control covers it.
- Keeping canonical replay validation synchronous exposed the first-load bundle
  budget. Splitting instruction bodies from the shared command menu preserves
  immediate/offline names, home overrides and full CLI instructions without
  charging every first visit for the bodies. No budget increase is authorized.
- A same-question replacement originally looked only in live item versions,
  refusing an unchanged upload after pruning. It now preserves exact canonical
  retained references from that question's history and checks their bytes again.
- Transparent source-policy reads were advertising the relay's decoder features
  for an older caller. The forwarding boundary now preserves the caller's
  declaration. Separately, a `replica:` claim could overwrite recorded human
  harness provenance; transport custody must not redefine respondent kind.

## Final integrated walks

After the final hook and relay-identity corrections and upstream integration,
`npm run build` and `npm run typecheck` both exited 0. The browser entry is
729,735 bytes, below the unchanged 743,900-byte ceiling. No budget was raised.
The conductor reran these commands against that freshly built source:

| Command | Exit | Evidence directory suffix / observed result |
| --- | --- | --- |
| `node --import tsx scripts/journey-questionnaire.mjs` | 0 | `isocan-personal-journey-HfMg1V`: all eleven required upload, refresh, retry, reverse-producer, Undo, keyboard and narrow-width checks |
| `node --import tsx /tmp/isocan-design-partner-execution/phase1-conductor-browser.mjs` | 0 | `isocan-questionnaire-conductor-t51Fdp`: all eleven supersession, explicit legacy adoption and lost-acknowledgement checks; no Chrome errors |
| `node --import tsx /tmp/isocan-design-partner-execution/phase1-conductor-api.mjs` | 0 | `isocan-questionnaire-conductor-oi6naz`: exact two-version reads after pruning, deletion, GC and restart, including a replacement answer; no Chrome errors |
| `node --import tsx /tmp/isocan-design-partner-execution/phase1-command-browser.mjs` | 0 | `isocan-personal-journey-L6LRJU`: all thirteen full commands and aliases match baseline; immediate/offline menu, zero-operation local Help and actual home override posting |

Evidence directories are under
`/var/folders/63/4k_ydj554mz6_56j2hpg7jcr0000gn/T/`.
Logs are `phase1-integrated-{build,typecheck,journey,browser,api,commands}.log`
in the scratch directory. The conductor inspected the actual narrow answer,
completed upload, changed-option review and pre-response command-menu screenshots.
The task's synthetic brief remains a generic JSON tile in phase 1; the readable
editable brief projection is explicitly owed by phase 2.

The retained-reference run swept its orphan negative control, archived all
thirteen preceding operations, and preserved both requested SVG versions.
Its original answer was operation 8 and its text replacement operation 14.
The integrated command walk compared all 41,070 instruction bytes, not just
menu labels. HTTP failure did not turn a local command into an agent message.

Legacy FileStore actor records overwritten with transport-only `replica`
harnesses recover from the existing full actor-log read. A legacy CloudStore
row without available original provenance remains honestly unknown until a
new actual home claim. There is no guessed human attribution or additional
cloud scan. New relay claims preserve the known kind on both stores.

## Full-gate integration findings

The first integrated fast suite exited 1: 530 files / 5,527 tests passed,
9 files / 13 tests failed, 11 files / 108 tests skipped; 194.63 seconds.
The failures were not suppressed or treated as an inherited red baseline:

- The Operation AST guard could not enumerate a new union alias.
- The top-level installed API entry lacked the seven new runtime exports.
- A forwarded recap performed an unnecessary authoritative snapshot preflight
  before its queued, canceled read; the no-content-read proof caught it.
- Sprint instruction guards still read the old command-body file location.
- Existing web HTTP/socket expectations named only the old feature token.
- Attachment handlers and the automatic placement seed lacked the placement
  guard's explanation that these coordinates are not a person's chosen spot.

Each failure went back to its owning builder. Command bodies and guard ceilings
remain unchanged. The final full reruns below include the corrections.

The second full fast run exited 1 with 5,539 tests passed and one architecture
measurement failure (192.29 seconds). Making the two operations enumerable
exposed that the isomorphism audit did not follow their real shared API calls.
The browser and CLI proofs had exercised those calls successfully. The audit
must follow the shared producer instead of receiving dummy operation strings
in each client or an exemption for the new vocabulary.

The third full fast run passed 5,541 tests and exited 1 only on the new
isomorphism fixture's missing teardown retry options (192.70 seconds).
Adding the repository's existing cleanup options changed no product behavior;
the teardown and isomorphism guards then passed 11/11. The strict run and
final fast run below follow that last correction.

## Latest-main integration

The staged e4bc100f implementation completed `npm run test:ci -- --maxWorkers=6`
with its own Firestore emulator: **592 files and 6,106 tests passed, three
opt-in tests skipped**, exit 0 in 450.30 seconds. Log:
`/tmp/isocan-design-partner-execution/phase1-gate-strict.log`.

Before landing, main advanced to
`c088404aef65e284e2c559387622d4b294e5fcb6`, adding cross-home rc availability.
The conductor preserved only this phase's explicit paths in a stash, fast-forwarded
this separate clone, and reapplied them. One API route import conflict required
combining both sets of shared helpers. The original checkout remained untouched.
Because the upstream change touches the relay, the final gates repeat on the
combined source; the e4 strict result is not presented as proof of that later tree.

The combined build exited 0. Its entry is
`packages/web/dist/assets/index-DX4bMuPI.js`, **729,777 bytes**, SHA-256
`30d1d8067329a6d8ba064a91058168ac9ba06e084542d1334cd95f33c65b68c7`.
The unchanged first-load limit is 743,900 bytes. The then-82 changed source paths were checked against the staged bytes before
gates. [phase-1-sources.json](phase-1-sources.json) pairs the c088404a base with
those sources and the later two test-fixture corrections: 84 final paths.

The conductor reran `node --import tsx scripts/journey-questionnaire.mjs`
on that fresh build: exit 0, all eleven checks. Evidence:
`/var/folders/63/4k_ydj554mz6_56j2hpg7jcr0000gn/T/isocan-personal-journey-2RQpmW`;
log `phase1-c088-journey.log`. The conductor inspected the narrow screenshot.
`npm run typecheck` also exited 0 on the combined source.
Focused integration tests separately exercised the new home rc methods,
questionnaire relay/custody and recap cancellation; no behavioral integration
fix was needed. Full combined gates follow.

## Strict gate: simulated-home concurrency correction

The c088404a combined strict run exited 1 in 454.28 seconds: 591 files /
6,110 tests passed, one test failed, three opt-in tests skipped. The failure was
`rc-sheep-withdrawal.test.ts:192`: two successful `rm` calls at its simulated
sheep home where exactly one should end the existing session. It did not report
a repeated design turn. All questionnaire and new home-relay tests passed.

The conductor reproduced the problem independently without running isocan:
eight concurrent processes ran the existing `fake-sheep.mjs rm --json s_1`
against one synthetic busy session. The first round returned two exit-0
`ended: true, aborted: true` results and six refusals. The fixture loads state
before mutation and atomically renames its output; this prevents a partial read
but does not serialize competing read/modify/write sequences. The actual rc
expects competing withdrawal paths and handles the home's second refusal.
The reusable conductor probe is
`node /tmp/isocan-design-partner-execution/phase1-sheep-concurrency.mjs <fixture>`.
Against the unchanged fixture captured with `git show HEAD:packages/cli/test/fake-sheep.mjs`,
it reported duplicate successes in six of ten eight-process rounds and exited 1;
log `phase1-sheep-before.log`. Its temporary state was synthetic and removed.

The fixture correction must preserve the exactly-one-success assertion,
serialize its short mutations and reread state inside that boundary. Long turns,
birth delays and stdin waits must remain outside it. This is the same failure
shape as lesson 58. Final proof follows that correction; the failed run is not
treated as a passing gate.

The corrected fixture passed the conductor's same ten-round probe with zero
duplicate successes, exit 0 (`phase1-sheep-after.log`). The added regression
launchers hold identical initial reads and delay later reads: the unchanged
fixture failed both exactly-once removal and concurrent-pasture preservation.
The corrected fixture serializes short mutations only. Runtime code and the
existing exactly-one-success assertion are unchanged. Both sheep integration
files then passed all 20 tests, including long birth and in-flight withdrawal.
A scratch copy with only lock acquisition/release removed accepted eight of
eight competing removals under the same test scheduler, while the corrected
fixture accepted one. Evidence: `phase1-sheep-lock-negative.json`.
The final source manifest now includes these two fixture paths: 84 total.

## Final gate and surface accounting

All commands ran from the execution clone on the c088404a base. The final
84 staged source hashes are captured in [phase-1-sources.json](phase-1-sources.json).
The fast suite preceded the test-fixture-only concurrency correction; the
final strict suite includes every fast test plus the deep and emulator lanes.
No product source changed after the recorded build and browser journey.

| Check | Result |
| --- | --- |
| `npm test -- --maxWorkers=2` | Exit 0; 539 files / 5,547 tests passed, 11 files / 108 intentional skips; 406.01 seconds |
| `npm run typecheck` | Exit 0 across the workspace |
| `npm run build` | Exit 0; entry 729,777 bytes against the unchanged 743,900-byte ceiling |
| `npm run test:ci -- --maxWorkers=6` with owned Firestore emulator | Exit 0; 592 files / 6,113 tests passed, three opt-in skips; 431.58 seconds |
| `node --import tsx scripts/journey-questionnaire.mjs` | Exit 0; all eleven real browser/CLI checks on the final build |
| `node scripts/isomorphism.mjs --check` | Exit 0; questionnaire acts reachable through both real clients; negative controls remain enforced by the full suites |
| `node scripts/lessons.mjs --check` | Exit 0; no collisions across 71 lessons |

The final full-gate logs are `phase1-closure-{strict,typecheck}.log`; earlier
`phase1-c088-{fast,build,journey}.log` records the unchanged product build and
ordinary suite. All are in the scratch directory. The strict command is launched by the owned-emulator wrapper
`node /tmp/isocan-design-partner-execution/strict-test.mjs phase1-closure`;
it tears the emulator down and returns the actual suite exit code. The ordinary
suite's message that its deep lane was omitted is discharged by this full strict
run. No provider or paid cloud resource was used.

The six surface obligations are accounted for:

1. **Operation vocabulary:** `questionnaire.ask` and `questionnaire.answer`
   materialize immutable comments with canonical retained references. Refusal,
   replay, replication and inverse paths preserve one answer as one undo.
2. **CLI:** `design ask`, `design answer`, `design questions` and
   `design reference` expose stable identities, text/JSON and exact bytes.
3. **Agent guide:** actual verbs and examples ship in the quick reference;
   the installed root API exports are exercised by the suite.
4. **Shared core/API:** validation, question association, projections, delivery
   truth and retained reference reads are shared by browser and CLI.
5. **README:** documents the shipped question/reference path and its current
   existing-brief requirement. Automatic creation is not advertised as enabled.
6. **Tests and walk:** core/server/API and real CLI tests cover refusal and
   recovery. The conductor drove Chrome, reviewed screenshots, and independently
   tested actual GC/restart, supersession, old-client negotiation and command
   loading. These prove correctness, not measured generated-design quality.

The work began at 18:46:45 MDT and includes the interruption to correct phase
0's release-CI measurement gap. Phase 2 now owns ordinary request creation,
readable brief/reference projections and the complete shared task path.

Closure documentation checks passed after recording the phase: conductor status
lint clean, regenerated roadmap current, and 16/16 roadmap/changelog/lesson
tests passed (exit 0, 2.25 seconds). Log: `phase1-closure-docs.log`.

## Landed commit and CI acknowledgement

The complete phase landed on `main` as
`aca35fc9904cf7c85fc9d009be3e56045c542e16`. GitHub
[release run 34925120720](https://github.com/dglazkov/isocan/actions/runs/34925120720)
passed all four strict suite shards, typecheck/measurement checks and publication;
its publish job completed at 03:36:45 UTC on 15 September 2026.
[Review run 34925120664](https://github.com/dglazkov/isocan/actions/runs/34925120664)
also passed. This acknowledgement travels with the phase 2 mechanism commit;
it adds no unverified product change.

# Canvas groups — verification record

This records work that was actually checked. The acceptance gates in
[`design.md`](design.md) describe future feature verification; they are not
completed checks. Phase records below distinguish built mechanisms from the
client interactions and release gates still to be walked.

## 12 September 2026: independent review of the plan

The user requested `/conduct`, subagents and verification during the work.
No `conduct` skill was found in the then-current checkout (`ed1520a6`),
accessible installed skill directories or available tools. This review used
the available subagent tools directly and did not follow that skill. The
upstream-sync correction below records why it was missing.

Three subagents independently read the plan and relevant current source:

| Reviewer | Assigned scope |
| --- | --- |
| `review_group_semantics` | Membership, nested transforms, operations/inverses, concurrency, migration and API/replay feasibility. |
| `review_group_surfaces` | User requirements, UI/CLI parity, selection/context, layout and existing command/shortcut collisions. |
| `review_group_verification` | Implementation sequencing, meaningful test gates, lifecycle, persistence and browser verification. |

The coordinator also inspected the operation writer, actual undo/redo paths,
CLI command declarations, annotation geometry and native export discovery.
Reviewers made no edits; the coordinator integrated the fixes into the plan.

| Finding | Source evidence | Disposition in the revised plan |
| --- | --- | --- |
| Conflicting structural undo could silently undo an older action. | `server/src/engine.ts`: `undo`/`redo` catch validation errors and discard candidates; `repairInverse` shrinks ordinary batches. | Require a distinct non-discarding group-conflict path; test actual endpoints, unchanged log tip, preserved candidate and untouched earlier work. |
| Creation redo could collide with trashed IDs. | `engine.ts`: `redoOpFor` only special-cases existing creation operations. | Add restore-based redo for group creation/copy; test IDs, versions and authorship. |
| Deduplication does not choose between two annotation transforms. | `core/src/annotation.ts`: attachment is independent of area geometry, and saved regions are clamped/rounded. | Require marks and live targets to share a parent; target outer-box transform wins, preserving actual overhang. Specify frame marks, Ungroup and migration. |
| Migration omitted legacy trash and old inverses. | `core/src/reducer.ts`: restore reinstates the stored item; current undo reuses stored operations. | Convert legacy trash without inventing historical membership; record a visible undo boundary and preserve old-log replay. |
| Subtree restore had no durable deletion cohort. | `core/src/model.ts`: existing trash entries contain an item and deletion attribution only. | Persist deletion cohorts; restored/moved/re-deleted children cannot be stolen back by ancestor restore. |
| Stale-transform dependencies were incomplete. | The proposed transform also depends on descendant sets, attachment links and layout settings. | Capture those inputs and test separate races; unrelated text edits still succeed. |
| CLI spellings and intent were misstated or incomplete. | `cli/src/main.ts`: `align --to`, `set --size`, `fit`, `distribute`, `mv --in`; `ask` asks the person and parks the actor. | Preserve existing syntax, route all geometry intents deliberately, and use `say`/comments for group-scoped agent requests. |
| Group entry could collide with embed/full-screen behavior. | `web/src/pages/CanvasPage.tsx`: Enter opens full screen; `stores/uiStore.ts`: `enteredItemId` belongs to interactive content. | Add separate `activeGroupId`, scoped hit testing and Escape precedence; preserve ordinary-item behavior. |
| Label footprints depended on zoom. | `web/src/components/ItemView.tsx`: persistent item chrome currently counter-scales. | Define fixed world-space reserved label bands separately from transient chrome; test unchanged geometry across zoom. |
| Context retention and migration tests could pass without proving persistence. | GC, backup blob discovery and snapshot/tail paths have different consumers. | Require GC-past-horizon/restart/source-and-visual retrieval and real two-daemon native backup round trips. |
| Compatibility and copy tests missed real failure paths. | Already-connected replicas receive tails; per-item copy placement may scatter intentional overlaps. | Test connected old clients/queued writes and nested overlapping copies placed as one unit. |

All three reviewers checked the revision and reported their original
findings resolved at the planning level. That pass found three interactions,
which the coordinator then made explicit:

- Automatic tidy/align/distribute treat a target and its attached ink as one
  placement unit; the ink cannot receive an independent slot or delta.
- The ink menu exposes **Detach from annotated item**, with a documented
  existing CLI metadata command and a detach/remove/undo acceptance sequence.
- Migration rollback checks post-boundary live, trash **and redo** state.
  Undoing a new group creation still leaves dependencies and must not allow
  rollback to strand them.

Each reviewer then confirmed the targeted correction to their final finding.
No findings remain open from this plan review. These are design dispositions,
not evidence that the proposed behavior has been implemented or tested.

Documentation link checks, roadmap freshness and diff whitespace checks
passed. `npm run typecheck` passed. The final `npm test` run passed 4,132
tests, skipped 71 and failed one existing review-queue guard: the unanswered
8 September performance finding is four days old. No runtime source files
or that review finding were changed by this work. No feature browser
acceptance was run; the group implementation remains unbuilt.

## Recording an implementation phase

For each phase, append the assigned builder/reviewer scopes, changed paths,
review findings and their dispositions, exact checks and observed results,
and remaining limitations. Mark the phase complete only when both surfaces
and its gate have been verified. Do not record planned browser actions as
executed actions or a passing suite as proof of untested pointer behavior.

## Upstream sync correction

After the user pointed out that the skill was new, fetching `origin/main`
revealed 41 commits beyond the checkout. The earlier switch from `anatomy`
to local `main` had not fetched: the remote-tracking ref was last updated on
11 September. The `conduct` skill was added by upstream commit `5e4d31b3`.

The checkout was fast-forwarded to `19355501`. The plan files were preserved,
and their project/changelog entries merged with upstream's entries. The
actual skill at [SKILL.md](../../../.claude/skills/conduct/SKILL.md) has now
been read. Its status script currently reports that this project has no
`phases.md`; the existing phase table remains in `design.md`. Implementation
has not started, and the earlier review/test results above describe
`ed1520a6`, not the newer source tree.

Post-sync validation: `npm install --ignore-scripts --no-audit --no-fund`
linked the new `@isocan/sandbox` workspace without changing the lockfile.
`npm run typecheck` passed. `npm test` passed 4,394 tests with 78 skipped
(430 test files passed, 5 skipped). The old overdue-review failure is absent
on this upstream revision. Roadmap freshness and diff whitespace checks passed.

## Conduct orientation

The user authorized implementation on 12 September. The acceptance journeys
and five-phase contract now live in journey.md and phases.md; the conduct
status script passes and names phase 1 next. No implementation is claimed by
this orientation record.

An independent read-only reconciliation against `ed1520a6..19355501` found
four upstream additions that the implementation brief now accounts for:
sandbox transcript creation inherits its program's group; retained context
stays inside operator purge's deletion boundary; context selection preserves
the owner-only summon policy; and the operation-count instrument must see
every new union member and an explicitly justified vocabulary bound. Existing
area geometry, reducer and Undo/Redo assumptions remain accurate on main.

## Phase 1 — CLOSED, 12 September 2026

Builder ownership is split between core geometry/membership and daemon/API/
protocol integration, with a third subagent reviewing without editing.
The conductor's first independent production-helper probe wrapped one
400×400 Markdown card at (100, 200), obtaining a 448×528 group at (76, 120).
Requesting 336×396 initially yielded 336×528 and a 288×400 card: the fixed
external label prevented vertical shrink. This exposed a design equation
error, not a passing acceptance result. The design now scales the frame plus
label reservation and names the required 288×268 card result. Both the
production regression and the independent HTTP walk now produce that result.

The core builder owned core membership, geometry, bounded operation writes
and consumers; the daemon builder owned API/writer, Undo/Redo, persistence
and protocol capability plumbing, including minimal web negotiation. The
read-only reviewer checked the actual writer, raw JSON refusal paths and
storage boundaries and approved the corrected phase. The conductor read the
diff and tests, ran all socket/emulator proofs centrally, and wrote this record.

The first complete suite found five old web protocol assertions that omitted
the new capability header/query, and two export guards. The web tests now
assert the feature while retaining bodyless-delete and queue-order checks.
The export instrument reads tracked files: staging the six new files exposed
their actual consumers and unused exports. Builders kept eleven internal
helpers/types private and documented the public contracts. The unused and
undocumented export bounds remain 39 and 331. The separately justified
operation vocabulary bound is 34, accounting for `group.change`.

During final integration, upstream operator phase 4 added badge-ending paths.
Rebasing onto `13f009ce` produced one API import conflict; its builder retained
both features and reviewed the HTTP, socket and web queue merges. The
following checks ran on that combined implementation tree:

| Conductor command from the repository root | Observed result |
| --- | --- |
| `npm test -- packages/core/test/canvas-groups.test.ts packages/server/test/canvas-groups.test.ts` | Exit 0; 60 tests passed in two files. |
| `FIRESTORE_EMULATOR_HOST=127.0.0.1:19099 ISOCAN_REQUIRE_EMULATOR=1 npm test` | Exit 0; 4,557 passed, four skipped, 442 files passed; 145.55 seconds. Local FileStore and real Firestore-emulator paths both ran. |
| `npm run typecheck` | Exit 0 across all workspaces. |
| `npm test -- test/roadmap.test.ts test/changelog.test.ts` | Exit 0; 11 tests passed after updating the record. The initial sandbox run could not open the CLI daemon log; the unrestricted rerun passed. |
| `node --import tsx /tmp/isocan-canvas-groups-phase1-walk.mts` | Exit 0; independent fresh-daemon HTTP walk passed all ten recorded checks. |
| `git diff --check` | Exit 0. |

The full suite's four skips were the existing dispatch/ACP cases (three) and
the bundle-size check because the built web assets predated the source. No
group persistence test was skipped. Phase 2 requires a fresh build and a
real browser walk. The emulator used synthetic local data, without a cloud
account or provisioned resource.

The independent HTTP walk uploaded and retrieved real blob bytes, wrapped a
card while leaving an overlapping non-member outside, and observed one log
entry. It resized 448×528 to 336×396 through the ordinary resize API and read
the 288×268 child. Group-plus-child movement translated once, a same-key retry
returned the same receipt with one entry, undo retained another actor's title
edit, and a stale membership expectation returned 409 with an identical
snapshot and log tip. Focused engine cases additionally verified a conflicting
undo candidate is retained, a mixed undo-label batch is preflighted, creation
redo preserves IDs/authorship, malformed snapshots never replace storage,
and cohort persistence survives restart and native export/import.

Both-surface obligations: the operation vocabulary and shared core helpers
changed, with API and protocol integration and production tests. CLI verbs,
the agent guide, product README and feature UI are deliberately phase 2;
WHATSNEW is untouched because this foundation exposes no normal creation
path. No pointer walk or completed user journey is claimed for phase 1.

# Canvas groups — verification record

This records work that was actually checked. The acceptance gates in
[`design.md`](design.md) describe future feature verification; they are not
completed checks. No group implementation has started.

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

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

## Phase 2 — CLOSED, 12 September 2026

The semantic builder owned the API, CLI, public Remove resolution and command
documentation; the UI builder owned browser membership, navigation and menus.
A third subagent reviewed source without editing. The conductor read their
diffs/tests, ran the writer and browser independently, and returned failures
to the owners. All data in the two browser homes was synthetic.

Two contract corrections landed before implementation: mixed-parent Remove
is one public action, and it canonicalizes to the existing v1 reparent intent.
The independent HTTP/API walk loaded the actual phase-1 reducer from
`dec07903`, replayed the accepted removal, and compared the resulting canvas.
One undo restored both different parent destinations. Creation/add/remove/
ungroup dry runs left state, log and blob inventory unchanged. An intervening
HTTP move before API Add showed why receipts must describe the accepted
writer facts: replaying the receipt against the caller's earlier snapshot
could throw after a successful write. The API now returns the actual accepted
positions and sequence.

The conductor's real browser walks used freshly built `packages/web/dist`,
a fresh local daemon, separate legitimate browser/CLI/seed identities, and
hit-tested CDP mouse, keyboard and touch input. CLI checks launched the actual
`packages/cli/bin/isocan.js`, reading the same live home. The observations:

- Selected three 240×180 cards, wrapped by context menu and by Cmd+G, and
  inspected the same three IDs with `canvas group ls/show`. The overlapping
  fourth card remained unrelated. Saved card positions stayed fixed; a brief
  reserved its own band. The final screenshot showed a readable title/count
  and brief above the first row at 112% zoom, with the frame visible.
- Enter selected the group's scope; clicking then reached a direct child.
  Shift+F10, arrow keys and Enter removed a child. CLI inspection showed the
  changed relation, and browser Cmd+Z restored it without moving the child.
  Add items via the picker enlarged the frame in one change; undo restored
  its prior frame. CLI `mv --in` moved and reparented an overlapping card,
  and CLI undo restored its original relationship and geometry.
- Cmd+G created a nested frame; Enter/Escape navigated both levels.
  Cmd+Shift+G dissolved the nested frame and promoted children without moving
  them; undo recovered its identity. CLI Add, Remove and Ungroup produced
  the same relationships while the browser was watching. Toolbar Groups →
  New group produced an empty frame, and CLI Show reported zero members.
- An independently selected annotation refused Remove. The ink menu's
  Detach cleared annotates and region in one act, preserving its 280×220
  box at (180,180) and parent. Remove then succeeded; two undos restored the
  membership and both attachment fields. The real CLI repeated detach,
  remove and both undos using `set --rm-prop` and the group command.
- Lowering the actual link grant to read removed editing menu entries.
  Readers could enter, select contents and inspect a read-only name without
  a Save button. Restoring edit access restored editing. The legacy canvas
  refused group creation with an explicit not-enabled explanation. People
  group help and `session select --help` kept their existing meanings;
  ambiguous group prefixes listed candidates and refused to guess.
- Deleting a selected card through the real API while the form was open
  produced a disabled form with a missing-selection explanation. Holding
  its actual blob upload, deleting the selected card, and releasing the
  upload also yielded a settled unknown-item refusal in the form, with no
  partial frame. Browser runtime-error collection remained empty.
- A real Shift-marquee starting outside an entered group exposed a stale
  child selection at root scope. The fix clears the old scope before the
  additive base is captured; repeating the drag selected only the outsider.
  An outside touch tap now exits scope through the same boundary decision.
- At a 760px viewport height, End scrolled the last menu action into view.
  ArrowRight on Delete did nothing. A submenu initially opened before React
  could focus its child; the fix moves focus after commit. The final walk
  used Right → Down → Left → Right → Enter, observed Left/Center/Align focus
  as expected, and confirmed the resulting alignment and undo with the CLI.

The browser found two presentation defects: the header could start above the
viewport and inherited a dark paper-ink color on the dark canvas. Accepted
creation now reveals the complete frame by changing only the camera, and
group titles use theme text colors. Groups no longer mount irrelevant
Markdown reader/fullscreen card chrome; Open brief is explicit. The group
menu also omits the fullscreen row whose Enter hint contradicted Enter group.

The first full suites caught API root-entry exports and old source assertions,
not just new feature tests. The owners fixed the API export, retained legacy
area branches, and updated touch/menu guards to preserve their intent.

The fresh build also made phase 1's previously unmeasured entry cost visible.
Same-machine in-memory builds measured 667,692 bytes before phase 1, 691,309
at phase 1, and 702,349 after phase 2. There are no new third-party entry
modules. Deferring the Toolbar menu saved 1,725 bytes in a controlled
comparison; the final keyboard-focus correction added 328 bytes. The shared
resolver remains synchronous because optimistic replay uses it. The explicit
ceiling is now 702,400; the 640,000 goal and 20,000 jump gate are unchanged.
This is a measured feature cost, not a hidden library import.

| Conductor command | Observed result |
| --- | --- |
| `npm test -- packages/cli/test/canvas-groups.test.ts packages/web/test/canvas-groups.test.ts packages/cli/test/surface.test.ts` | Exit 0; 21 tests passed in three files. |
| `FIRESTORE_EMULATOR_HOST=127.0.0.1:19099 ISOCAN_REQUIRE_EMULATOR=1 npm test` | Exit 0; 4,579 passed, three existing ACP/dispatch skips, 445 files passed; 148.68 seconds. |
| `npm run typecheck` | Exit 0 across all workspaces. |
| `npm run build` | Exit 0; final entry 702,349 bytes. |
| `node --import tsx /tmp/isocan-canvas-groups-phase2-api-walk.mts` | Exit 0; real HTTP race, actual v1 replay, atomic mixed-parent undo and dry-run inventory checks passed. |
| `node --import tsx /tmp/isocan-canvas-groups-browser-driver.mts` | Real two-home browser/CLI walks above; final interaction checks passed and runtime errors were empty. |
| `git diff --check` and conduct status lint | Exit 0 / clean. |

The scratch browser command/observation record is
`/tmp/isocan-canvas-groups-browser-walk.jsonl`; representative screenshots are
`/tmp/isocan-groups-phase2-final-wrap.png` and
`/tmp/isocan-groups-phase2-scroll-menu.png`. These are observed evidence,
not a fixture standing in for a browser. A wrong scratch selector and an
attempt to use native Select All without CDP keycodes were harness errors;
triple-click name replacement and the correct DOM selectors were used in the
subsequent walks.

All six surface obligations were touched: the existing operation union gained
public Remove with compatible canonical replay; CLI membership verbs and
`mv --in` call API helpers; the guide quick reference and README describe
both surfaces; shared traversal/receipt logic lives in core/API; meaningful
logic tests and actual browser interaction proofs ran. Group mode remains
opt-in until phase 5. Complete gesture previews, all insertion producers and
atomic brief/header edits belong to phase 3; context and migration remain
phases 4 and 5. No external provisioning or human-only step is pending.

## 12–13 September 2026: phase 3 — transforms, insertion and layout

The same three builders owned disjoint paths: core/server semantics,
API/CLI/module producers, and web interactions. The API/CLI builder then
independently reviewed the web changes, and the core builder reviewed the
performance changes. The conductor ran the acceptance commands and browser
walks, returned failures to their owners, and owns this record. Final
independent review reported no remaining concrete blocker.

The new vocabulary remains inside `group.change`: bounded insertion and
content effects, saved grid counts and their preconditions require schema 2
and the `canvas-groups-v2` capability. Historical v1 replay remains supported.
Ordinary metadata/version changes retain their ordinary operation and undo
behavior unless structural/header repair is necessary.

### Checks run by the conductor

All final commands exited 0:

| Command | Observed result |
| --- | --- |
| `npm test -- packages/core/test/canvas-groups.test.ts packages/cli/test/canvas-groups.test.ts packages/web/test/canvas-groups.test.ts packages/server/test/canvas-groups.test.ts` | 122 tests, four files, 6.27 seconds. |
| `FIRESTORE_EMULATOR_HOST=127.0.0.1:19099 ISOCAN_REQUIRE_EMULATOR=1 npm test` | 4,718 passed, four skips, 457 files, 152.13 seconds. Rebase refreshed source mtimes, so the stale-build skip was rerun separately after rebuilding; only three existing ACP/dispatch skips remain uncovered. Real Firestore tests ran. |
| `npm run typecheck` | Every workspace passed. |
| `npm test -- test/roadmap.test.ts test/changelog.test.ts` | 11 documentation checks passed, 1.96 seconds; rerun outside the sandbox after the CLI log path was blocked. |
| `npm run build` | Vite completed in 5.14 seconds; final entry `index-DjmIL7El.js` was 721,172 bytes. |
| `npm test -- test/bundle-budget.test.ts` | Rebuilt after the final rebase; one test passed, zero skips, exit 0. The entry hash remained unchanged. |
| `npm test -- packages/cli/test/area.test.ts packages/cli/test/grid.test.ts` | Four real-daemon CLI compatibility tests passed, 10.98 seconds. |
| `node --import tsx /tmp/isocan-canvas-groups-phase3-api-walk.mts` | Independent numeric, concurrency, insertion, brief and capability gates all passed against fresh synthetic daemons. |

The full suite initially caught ordinary CLI placement JSON losing `chosen`,
source guards that no longer described their call sites, a hooks dependency,
and the historical-view write guard. These were corrected and rerun; the old
CLI compatibility and scrubber behavior tests were preserved. New registered
module-command tests preserve the existing mindmap coordinate response and
use accepted group geometry where appropriate. The three final skips are the
existing ACP/dispatch cases, not group or emulator tests. Post-rebase checks
are recorded in the phase commit message.

Upstream operator access controls exposed a further race: a same-canvas POST
failure could replace a terminal socket refusal with “offline.” Both queue
entry paths preserve that terminal decision now. The conductor ran 43 API
and offline tests; six cases close the actual store socket before releasing
the held POST failure and verify persisted work without reconnecting. Badge
recovery also reports the door's definitive 403 instead of an earlier 401,
without retrying the write or reclaiming identity. Full verification caught
an older fake close event missing its reason and a new test cleanup missing
the required retries; both were corrected before the green run.

One post-rebase full run timed out in the pre-existing RC enrollment test.
Read-only diagnosis identified an older enrollment/park-claim ordering that
can displace an RC cursor; those application paths predate this feature and
were unchanged. The exact competing owner in that failed run was not traced.
The isolated RC rerun passed all 24 tests, and the complete rerun exited 0.
No cursor-ownership behavior was changed as part of groups.

The terminal race was repeated against the final built app and a fresh real
daemon: a hit-tested group drag held its real 200 response and operation echo;
a 4402 refusal close reached the browser before the held response failed at
the transport. The refusal page remained visible after settlement, with no
runtime exceptions. This verifies transport ordering, not a new operator
ledger action. Browser, proxy and daemon cleanup completed successfully.

### Actual browser, HTTP and CLI observations

Walks used fresh synthetic local daemons and real Chrome, serving built
assets. Pointer targets were checked with `elementFromPoint` before CDP
mouse/touch input. Network-ordering probes held actual HTTP responses or
relayed the daemon's unmodified WebSocket bytes; they did not replace the
writer or reducer. The final browser reloaded the final entry above and
reported no runtime exceptions.

| Walk | What was observed |
| --- | --- |
| Four corners and zoom | At 135%, every resize corner previewed descendant boxes without appending an operation until release. Each commit was one entry, and one undo restored exact geometry. Zooming to 100% changed no saved geometry. A real CLI 700×720 resize and browser resize produced identical boxes: Alpha 289.777778×225.333333, Beta x562.222222, Gamma y566.666667. |
| Cancellation and nested ink | Escape and actual touch cancellation removed all preview drift with no appended entry. A nested group with child-attached and frame-attached overhanging SVG marks retained its labels and overhang at 64% zoom under aspect-preserving resize; exact undo passed. The final build repeated northwest preview/cancel successfully. |
| Numeric ownership | The separate HTTP probe computed expected asymmetric boxes independently, exercised both annotation insertion orders, and compared exact committed results and inverse restoration. Membership, gutter and attachment races each refused with zero appended entries. An unrelated text edit survived accepted geometry and its undo. |
| Receipt and echo order | Both orders were repeated on the final build. Echo-first held the real 200 HTTP response until the real operation echo arrived. Receipt-first held the echo until after the response. Group and child frames moved once, with exact undo in both cases. An earlier walk also started a new preview before releasing an older receipt; that receipt did not clear the new preview. |
| Keyboard ownership | ArrowRight on Alpha followed immediately by selecting Beta committed only Alpha's one-unit move. Waiting beyond the nudge timer appended nothing else; undo restored the starting canvas. The earlier empty-timer entry found by this walk has a production timer regression. |
| Frame, grid and brief controls | Frame-only width/height editing preserved all children and undid exactly. The real inspector saved a named 2×2 grid and tidied it in one entry. Title, brief, 120-unit row gutter and 32-unit column gutter stayed clear; a long row label truncated inside its own band. Brief editing created one version/structural entry; undo restored the original version. The inspector uses one outer scroll. |
| Insertion | The Text tool created a node in the entered group. The Add form's canvas picker inserted an existing synthetic canvas card into that group in one operation and grew its frame. A native file drop on a closed group created a new member; after entering, dropping on the reachable child added a version instead. Existing cards retained their boxes during insertion. |
| Navigation during upload | A real blob POST was held after choosing a file. Actual SPA links navigated from canvas A through Home to B before the upload resumed. The item landed in A's original group; B remained empty, with no selection or queue pollution. Read-only inspection of IndexedDB showed B's empty queue and empty saved canvas. |
| Drop membership | A header drop named its destination and placed the new member in clear content space. Alt suppressed feedback and retained root membership. Dragging a member beyond the frame kept its parent and grew the frame. A deeper nested header won over the outer group. Each mutation/undo restored the exact baseline. |
| CLI geometry | Real CLI named-grid/tidy, align, distribute and fit commands each returned accepted canonical geometry and one operation. Each real CLI undo restored all saved boxes. The native fit example grew the parent while avoiding an existing overlap. |
| Sandbox producer | A synthetic program ran through the actual Seatbelt fence with the temporary installed sandbox runtime. Its first transcript inherited the program's group; after explicitly moving the transcript, a second fenced run added a version to that same item and preserved its new group and exact geometry. |

Other insertion producers share the tested core/CLI/web dispatch and have
production tests, including implicit Context-sheet group creation, modules,
Google Doc and sprint paths. This record does not claim an external Google
Doc account workflow or every producer's browser button was manually walked.
Copy/context-specific producer coverage remains in phase 4.

### The 1,000-item result

The real daemon received 1,000 synthetic Markdown cards, ten containing
groups and one outer group through actual operations. The first browser walk
exposed minutes of tail/render lag and 1,006 mounted document content trees
at overview zoom. Pure geometry timing had not found this. The correction
keeps selectable frames and actual image/video visual faces, while deferring
unreadable/offscreen document trees. Sprint derivation is shared by immutable
canvas revision, and an absent, untimed or completed sprint does not tick
all item components. Pointer snapping and structural expectations reuse the
captured gesture state.

The corrected live seeding took 24.351 seconds; the outer group appeared
47 ms after seeding finished. At overview zoom there were 1,020 item shells,
12 groups and zero document trees or iframes. The real CLI's recursive show
returned all 1,010 descendants, including the final card, in 394 ms. Selection
and movement did not mount document previews or increase the three blob
requests. Across a 45.3-second idle interval, layout count stayed unchanged;
script time increased by 54 ms, with ordinary canvas polling still present.

Pointer update calls measured 83–125 ms in the repeated preview sample; a
final-build move measured 77 ms. These timings are recorded limits, not a
60-fps claim. The large move appended one entry, translated the first and last
children by the same delta, left unrelated groups fixed, and one undo restored
all 1,020 boxes and memberships. Cancellation also preserved the log tip.
Reloading the final corrected bundle displayed the full group in 277 ms.

The bundle increase was investigated before raising its ceiling. Same-source
lazy boundaries for the Add form and content fitting removed 11,474 entry
bytes. Before rebasing, entry growth over phase 2 was 17,526 bytes. Upstream added
5,367 bytes and the terminal fix added 125. Moving the shared refusal constant
into the existing error leaf deferred 4,195 bytes of operator helpers while
preserving its exports. The final entry is 721,172 bytes, with the same eager
third-party dependencies; ceiling 721,200 leaves 28 bytes. The 640,000 goal
and 20,000 jump guard remain unchanged.

### Surface obligations and remaining work

All six AGENTS obligations were touched: bounded operations, matching
CLI/API geometry and layout verbs, agent-guide command documentation, shared
core computations, product README, and production tests plus real browser
interaction proof. Existing area and sharing-group meanings remain intact.
Creation is still opt-in. Phase 4 owns frozen group context, context consumers,
copy/export and lifecycle completion; phase 5 owns conversion and normal
release creation. No credential, paid resource or human-only gate is pending.

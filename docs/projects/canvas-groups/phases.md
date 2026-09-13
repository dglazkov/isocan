# Canvas groups — the walk

[`journey.md`](journey.md) is the acceptance suite and [`design.md`](design.md)
the mechanism. This is the conduct contract for implementing the reviewed
plan. The conductor owns these documents and the release record; builders
own only their assigned code, tests, CLI guide and product README changes.

**Where we are:** all five phases are NOT STARTED (12 Sep 2026). Canvas-groups
phase 1 is next: shared membership, operations and exact inverses. The
reviewed design has been reconciled with the current main checkout before
briefing. No phase waits on another project's implementation or on a person.

**Rules for every phase.** Work on main. Every structural act is atomic,
undoable and shared by both surfaces; a log undo label is not atomicity.
Use the group's explicit relation after conversion, never geometric fallback.
Fixtures and walkthrough canvases are synthetic. Builders do not edit files
under docs/projects/, docs/changelog/ or WHATSNEW.md, and do not commit. A
phase closes only after the conductor runs its commands and observes its
named walk. Relevant failures return to the builder, not a conductor code fix.

**Deployment boundary.** Phases 1–4 may land incrementally, but group creation
is gated to a declared group-capable canvas/client mode until phase 5 enables
the release path. Tests may explicitly enable that mode on synthetic local
canvases. Old clients must not receive operations their reducer cannot apply.
This project does not require provisioning or a new paid service. Local real
daemon/browser acceptance is the release proof; the existing green/release
pipelines handle normal deployment after each main push.

**Proof commands** are run from `/Users/dionalmaer/code/isocan`, with exit
codes captured directly. Every phase also runs `npm test` and `npm run
typecheck`, checks its diff, and reruns both after rebasing onto fetched main.
The named focused files below are part of the implementation deliverable;
they must import real production code and assert the journey, not a copy of
the implementation. Browser walks run a fresh build and a new/restarted
synthetic local daemon, never the user's existing canvas daemon.

## Phase 1 — Shared membership and atomic operations

**Status: NOT STARTED (2026-09-12).** Nothing built.

Establishes the mechanism of journeys 1, 2, 5 and 6; the pointer walks close
in later phases. Mechanisms: design sections Membership, Moving and resizing,
Operations and consistency, and the annotation/trash rules in UI entry points.

**Work:** typed `containerId` and group layout metadata; membership validation
and traversal; content boxes, footprints and nested/annotation transform
helpers; bounded atomic group operations with exact inverses and resolved
geometry; structural conflict handling through actual Undo/Redo; shared
primitive coverage for create/reparent/ungroup/transform/frame/layout/delete
and restore. Complete operation consumers, serialization, API request types
and the protocol capability needed to keep incompatible clients out. Ordinary
historical operation replay stays unchanged. Choose concrete operation shapes
in the core boundary and report any design contradiction before coding around it.

**Ownership:** packages/core/src and test, packages/server/src and test,
packages/api/src and test; minimal protocol plumbing in web/CLI only when
needed for capable-client negotiation. Any other path needs conductor
assignment. No feature UI/CLI command family yet; phase 2 owns that surface.
The operation counter and its tests in scripts/ and test/ are also assigned
for an explicit, justified vocabulary-bound adjustment, if required.

**Proof:** run `npm test -- packages/core/test/canvas-groups.test.ts packages/server/test/canvas-groups.test.ts`, then `npm test`, then `npm run typecheck`. Core cases prove forest/cross-canvas/cycle validation, explicit non-members, nested geometry, all anchor corners, minimums and annotations in both insertion orders. Real engine/HTTP tests prove one entry/inverse, no partial failures, retry, conflict with zero appended entries and the same undo candidate, unaffected earlier work, and creation undo/redo preserving IDs/authorship. Existing ordinary-item repair/replay tests stay green.

**Trajectory:**

- **2026-09-12** — Resize scales the native frame plus its fixed external label reservation, then subtracts that reservation. A conductor probe showed that scaling the native frame alone made a fitted 400×400 card unable to shrink vertically; the corrected numeric case binds geometry tests.

## Phase 2 — Membership on both surfaces

**Status: NOT STARTED (2026-09-12).** Nothing built.

Closes journey 1 and the membership/navigation parts of journey 3. Mechanisms:
design sections Joining/moving/leaving, Selecting a group, CLI/API surface,
and UI entry points. Geometry preview and smart placement close in phase 3.

**Work:** `isocan canvas group` new/wrap/ls/show/add/remove/ungroup, API helpers,
JSON/dry-run/unique-ref behavior; browser create/wrap/add/remove/ungroup,
activeGroupId, scoped click/marquee/Enter/Escape, group/ink/member menus,
shortcuts and inspector/navigation. Retain sharing-group and text-selection
verbs. Document every registered command in agent-guide quick reference and
the product README. Use the core operations and respect reader capabilities.

**Ownership:** packages/cli/src and test, packages/api/src and test,
packages/web/src and test, README.md. Core/server fixes exposed by the phase
are assigned explicitly by the conductor to avoid overlapping ownership.

**Proof:** run `npm test -- packages/cli/test/canvas-groups.test.ts packages/web/test/canvas-groups.test.ts packages/cli/test/surface.test.ts`, then `npm test`, `npm run typecheck`, and `npm run build`. Walk journeys 1 and 3 in a real browser against a fresh local daemon: create synthetic cards, wrap via menu and shortcut, enter/select/remove/add/ungroup, exercise ink detach and keyboard menus, and read/change the same relation via the real CLI binary. Confirm each mutation/undo from both clients and save actual observations in verification.md.

**Trajectory:**

*nothing yet — the phase has not started.*

## Phase 3 — Transforms, frame fitting and label-safe layout

**Status: NOT STARTED (2026-09-12).** Nothing built.

Closes journey 2 and the remaining insertion/gesture parts of journeys 3 and
6. Mechanisms: design Moving/resizing and Layout sections, existing-command
dispositions, and numbered verification gates 2 and 3.

**Work:** group drag/nudge/corner resize preview, commit and cancellation;
shared CLI `mv`, `set --size`, `fit`, align/distribute/tidy dispatch; frame-only
fit/size controls; title/brief and grid gutters; all add/text/file/site/paste/
Google Doc/module/sprint placement routes; drop target feedback and reparent;
annotation placement-unit semantics. Update tests, agent guide and README.
Include sandbox transcript creation, which inherits its program's group;
later transcript versions keep the transcript's existing membership.
Geometry changes on a stale dependency refuse as a whole and clear previews.

**Ownership:** packages/web/src and test, packages/cli/src and test,
packages/core/src and test placement/area/group/layout helpers,
packages/api/src and test and affected module producers. Split builders by
path, not by gesture, so no two own ItemView or main.ts concurrently.

**Proof:** run `npm test -- packages/core/test/canvas-groups.test.ts packages/cli/test/canvas-groups.test.ts packages/web/test/canvas-groups.test.ts packages/server/test/canvas-groups.test.ts`, then `npm test`, `npm run typecheck`, and `npm run build`. Walk journey 2 and gate 3 with actual hit-tested pointer events at multiple zooms, every resize corner, Escape/cancel, nested groups and overhanging ink. Inspect exact committed boxes via CLI. Exercise receipt/echo order and unrelated-text versus structural races through real production APIs; measure the 1,000-item synthetic case and record observations.

**Trajectory:**

*nothing yet — the phase has not started.*

## Phase 4 — Group context and lifecycle

**Status: NOT STARTED (2026-09-12).** Nothing built.

Closes journeys 4 and 5. Mechanisms: design Selecting/context, lifecycle,
request provenance, and numbered verification gates 4 and 5.

**Work:** shared complete context manifests, frozen version references,
composer chip/disclosure and exclusions, CLI say/comment/ask context, API and
read-only MCP retrieval; pinned-group ambient context; retained source/visual
bytes across GC/backup. Complete copy/paste ID remapping, intentional overlap,
trash-cohort restore, native backup and JSON Canvas projection, deck/sprint/
memory/module consumer coverage. Do not add MCP writes or JSON Canvas import.
Retained context stays inside operator purge's deletion boundary; new reads
honor takedown/purge and requests retain the existing summon authority policy.

**Ownership:** relevant context/model/ops/GC/export helpers in core/server,
API/CLI/MCP context and lifecycle clients, web composer/item actions, and
affected module consumers with non-overlapping builder assignments.

**Proof:** run `npm test -- packages/core/test/canvas-group-context.test.ts packages/server/test/canvas-group-context.test.ts packages/cli/test/canvas-groups.test.ts packages/mcp/test/tools.test.ts`, then `npm test`, `npm run typecheck`, and `npm run build`. Walk journeys 4 and 5: browser preview IDs/versions match the sent request and CLI manifest, exclusions are explicit, group-plus-child deduplicates, copy and restore preserve ownership. Execute design gates 4 and 5 through real daemons, GC/restart and two-daemon native export/import. Retrieve distinct source/visual bytes after the original items and versions are gone; verify a complete manifest for a large group.

**Trajectory:**

*nothing yet — the phase has not started.*

## Phase 5 — Legacy conversion and release

**Status: NOT STARTED (2026-09-12).** Nothing built.

Closes journey 7 and the complete product walk. Mechanisms: design Converting
existing areas, undo boundary, compatibility and numbered gates 6 and 7.

**Work:** migration preview/apply/undo and mode/boundary bookkeeping; live and
legacy-trash conversion, annotation ownership and declared grid repairs;
already-connected old-client/replica and queued-write handling; enable normal
creation on capable canvases, area compatibility aliases, legacy consumers,
examples/README/guide and release notes. Never reinterpret historical ops or
discard post-boundary trash/redo state to force migration rollback.

**Ownership:** core/server migration and protocol tests, API/CLI migration
surface, web migration/compatibility feedback and all remaining area consumers.
The conductor updates project/release/changelog records after verification.

**Proof:** run `npm test -- packages/core/test/canvas-group-migration.test.ts packages/server/test/canvas-group-migration.test.ts packages/cli/test/canvas-groups.test.ts`, then `npm test`, `npm run typecheck`, and `npm run build`. Walk journey 7 with the real CLI and browser and execute gates 6/7 through connected clients and two real daemons. Compare native export/import before/after/undone migration, snapshot+tail and restart. Repeat journeys 1–6 with ordinary creation enabled, verify sharing-group commands unchanged, and report all six AGENTS surface obligations.

**Trajectory:**

*nothing yet — the phase has not started.*

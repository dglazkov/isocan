# Anatomy port: implementation phases

Plan completed 11 September 2026 before implementation, on branch `anatomy`.
Read [analysis.md](analysis.md), then [design.md](design.md).

**Where we are:** phases 1–8 built, including recoverable reads and targeted request receipts on 12 September 2026, on branch `anatomy`.
The plan below was completed before implementation; acceptance evidence is
collected in [verification.md](verification.md).

The [12 September usability review](usability-review.md) records remaining
workflow gaps. Phase 7 implements the motion work and its two edit-preservation
fixes. Phase 8 adds read recovery and the request lifecycle; the wider review’s
semantic editing, graph update previews and transactional updates remain follow-ups.

## 1. Built — File model and portable graph

Build the module package, strict import/body validation, canonical field
mapping, graph reconstruction, deterministic non-overlapping layout, native
edge contribution and core context. Support fresh projects and prototype JSON
import/export, including checkpoints, optional assessments, historical
comments and mocks. Add CLI create/import/export/list/show/layout.

Gate: synthetic round trip preserves graph content; duplicate/dangling/cyclic
graphs are rejected before writes; two imports cannot cross-link; unrelated
canvas items survive. Native rename/move and removal fallback work.

## 2. Built — Workspace API and native Blueprint

Add proposed workspace registration, routing/launcher integration, host read
and navigation capabilities, native selection facts, optional item renderer
facts, and stage bounds measured from the workspace's native canvas slot.
Build concept/project cards and hierarchy/inspector chrome with collapse,
search, focus and native comments. Keep one canvas and one socket.

Gate: browser-driven tree→card and card→inspector selection, drag, pan/zoom,
sidebar collapse, Back, input shortcuts, and read-only handling. Existing
module pages/renderers remain compatible. Runtime build declares proposals.

## 3. Built — Exploration lenses and edits

Build Overview, Open Decisions and Coverage; goal/brief editing, concept
creation/editing, resolution options, evidence preview and explicit source
attachment. Add matching CLI verbs and shared write helpers. Unknown discipline
assessment remains unknown. Preserve source snippets when source bytes have
not been attached.

Gate: CLI edits update the live UI; UI edits read identically through CLI;
one Undo reverses each edit; coverage does not invent reviews; user-provided
text is escaped and arbitrary source URIs do not execute.

## 4. Built — Evolution and proposals

Checkpoint save, preview/export and explicit project-scoped restore. Mock
proposal, sandboxed preview, promotion to an ordinary source item. Native
discussion in the inspector, imported discussion labelled historical. Complete
CLI parity and agent guide, reusing normal wait/history/presence rather than
another notification protocol.

Gate: restore leaves unrelated items intact and can be undone; a proposal
cannot escape its frame; promotion updates source coverage and is undoable;
no imported activity is shown as current agent presence.

## 5. Verified — Integration and handoff

Run meaningful reducer/round-trip and CLI integration tests, runtime module
build, the complete `npm test` and `npm run typecheck`, production web build,
and a real-browser journey on a disposable canvas using synthetic data. Check
small-window layout, text overflow, empty state, and module removal boundary.
Update README, module authoring docs, project index and the day's changelog.

Gate: report the commands and browser interactions actually verified; leave a
reviewable branch and working preview, with limitations stated precisely.

## 6. Built and verified — Navigation and a project's own analysis

Port the prototype's selection-versus-neighborhood navigation, clickable links
and hierarchy breadcrumbs. Make the inspector resizable in both orientations,
replace oversized history buttons with standard shortcuts, and add a project
card door back to the workspace. Attach analyses and repository references to
native project properties. Add generic workspace menu/rail entries and a
native Chat `/anatomy` request, with matching CLI verbs and shared helpers.

Gate: browser double-click/connection/breadcrumb navigation, pointer and
keyboard resize, text-versus-canvas undo, card/menu/rail return paths, empty
repository analysis request, and persisted native project association. Run the
full suite and typecheck; analyze the actual repository only into a separate
local canvas, keeping fixtures synthetic.


## 7. Fluid exploration and edit preservation

The [step-by-step implementation and acceptance record](fluid-exploration.md)
covers guarded drafts, temporary native geometry, focus-dependent detail,
addressable navigation, local camera/pane continuity and scale verification.


## 8. Recoverable reads and targeted analysis requests

[Recovery and request design](recovery-and-requests.md) covers item-scoped
read failures, version preview/recovery, consistent analysis/repository targets,
native request files, dispatch receipts, guarded executor claims and outcomes,
cancellation acknowledgement and linked retries. Both surfaces use the same
helpers and existing native operations. The module does not own worker dispatch
or claim that an executor remains alive after reporting work.

# Anatomy port: acceptance record

11 September 2026. Synthetic projects only. The sibling Anatomy application
was read and run from a temporary copy; its checkout and project data were
not modified. The plan in [phases.md](phases.md) preceded implementation.

## Automated verification

The module tests exercise the actual reducer and inverse operations: portable
round trips, invalid input before uploads, repeat imports without cross-links,
native rename/move, grouped undo, source/graph scope, checkpoint restore,
proposal promotion, and content-versus-geometry stale-edit checks. The CLI
integration runs commands against a real disposable daemon and reads its
results back. The runtime build checks declared proposals and CSS loading.

Host tests cover measured stage bounds and cover shortcut routing, the API
proposal list, CLI guide completeness, module dependency boundaries, runtime
compatibility, and both JSON and text uploads. Final results:

- `npm test`: **4,157 passed, 70 skipped**, across 416 passing test files and
  five skipped files. The full suite ran after the final host changes.
- `npm run typecheck`: passed across all workspaces.
- `npm run build`: passed; workspace, parser, renderers and styling are lazy.
- Module runtime build and its integration test: passed.
- ESLint on the new module source and workspace host: passed.
- `git diff --check`: passed. The existing unused/undocumented export ceilings
  remain at 39/331; neither was raised.

## Browser journey

The production build was served by an isolated daemon and driven through a
real browser. Checked:

- Hierarchy selection frames a native card and fills its inspector. Clicking
  and dragging a card writes ordinary `item.move`; the CLI reads the new
  coordinates. The native cards, versions and anchored comments also remain
  visible after Back returns to the ordinary canvas.
- All four lenses render. Coverage keeps absent assessments as **Not assessed**.
  A decision resolution changes convergence and queue counts; one Undo returns
  the decision. Overview edits save and render Markdown.
- A CLI concept edit arrives in an open browser. A browser edit reads back
  identically through the CLI. Saving an older browser draft is refused and
  retains the draft. A subsequent fresh edit succeeds.
- Inspector comments create native anchored threads. The imported discussion
  stays labelled history. Editing a concept does not copy live comments into
  its body.
- Checkpoint save, snapshot preview, and explicit restore work. Preview says
  the live canvas has not changed. Restore and mock promotion use native undo.
- A cited source attached explicitly from the CLI appears as source text in
  the evidence dialog. Mock HTML renders and its button works inside a frame
  with `sandbox="allow-scripts"`, without same-origin access. Promotion makes
  an ordinary HTML source item; Undo returns the draft.
- A live downgrade to read-only leaves reports, checkpoints and evidence
  readable and removes write controls. The original editable test grant was
  restored after checking.
- Native Chat, Files, Agents, Context and Personas remain available through
  the host; the workspace bar also exposes Chat and Agents directly.
- Native hand pan and zoom were verified by changes to the world transform.
  Switching report lenses preserves that transform. Canvas gestures return
  focus from sidebar buttons to the native stage.
- Sidebars collapse. At 390 × 800, the inspector occupies a lower panel and
  the selected native card remains visible above it. A second empty project
  can be created, selected and given a Markdown overview. Viewport overrides
  were reset after testing.
- The launcher lists and opens Anatomy alongside Documents. A browser
  `Control+k` event opens it; Delete on a report leaves the selected concept
  intact. Mac modifier synthesis did not open the launcher in this harness;
  the platform-neutral shortcut did.
- A standalone runtime build loads its workspace and stylesheet from
  `/modules/…`, including its lazy report views. For this check only, the
  temporary built copy used a different module name and route so the shipped
  registration could not win by name. No source registration was changed.

## Fixes the journey forced

The first conflict check used `updatedAt`. Native movement and a redundant
metadata echo stamp that too, so a fresh text form could be refused. It now
compares version, title and properties; geometry can change independently.

Fastify's built-in `text/plain` parser was turning source bytes into a string,
which the blob endpoint refused as “empty blob body.” The existing blob-only
parser scope now treats both JSON and plain text as bytes; API JSON parsing
elsewhere is unchanged. This adds no endpoint.

The runtime builder emitted CSS but a JavaScript import had no HTML entry to
load it. The generated web entry now loads its emitted stylesheet before
registration and propagates the package's proposed API declarations.

## Both surfaces

| Surface | Change |
| --- | --- |
| Operation vocabulary | No additions. File, version, metadata, move and thread operations; one group per compound act. |
| CLI | `anatomy` family covers every durable exploration act; ordinary comment/history/undo/wait remain the collaboration protocol. |
| Agent guide | Module-owned quick reference and workflow, included by `isocan --agent-help`. |
| Shared helpers | Generic workspace types in core. Anatomy schemas, reads, layout and writes in the module, shared by CLI and web; core imports no module. |
| README | Feature entry, entry points and link to the plan. Module authoring and architecture docs updated. |
| Tests | Reducer, CLI and runtime integration plus host regressions; browser interactions above were driven, not replaced by source assertions. |

## Deliberate bounds

Repository analysis remains work an agent performs through the CLI; imported
activity never claims a live agent is working. Source attachments are UTF-8
text, and portable JSON preserves citations rather than bundling source bytes.
The graph uses native cards and explicit arrangement, without the prototype's
Pixi physics or alternate Three.js camera.

The stale-edit check is a client-side check before sending. A group is one
undo, not a server transaction or compare-and-swap. Large repository-scale
performance and the hosted/cloud deployment were not measured in this local
journey. The production entry remains above the standing 640 kB performance
goal; the existing budget guard was not relaxed.

## Follow-up acceptance: exploration and project-owned analysis

The original live renderer selects on single tap and navigates on double tap
(`SpatialStage.attachNodePointerEvents`); its refocus links call `setFocalNode`.
The native port now preserves that distinction and frames the immediate graph
neighborhood, keeping saved card geometry intact.

Browser-driven checks on synthetic data:

- Double-clicked the native Request workflow card; its breadcrumb and inspector
  changed, and the camera framed it with its parent and child. Clicked the
  rendered updates connection to Request record; the breadcrumb gained that
  concept. Connection activation is also keyboard reachable.
- Dragged the desktop inspector from 340 to 420 pixels; the native stage
  contracted from 700 to 620. In a 650-by-850 viewport, dragged the bottom pane
  from 280 to 350 pixels, then used ArrowDown to reduce it to 330. The stage
  retained 232 pixels of height; viewport restored afterwards.
- Removed the large Undo/Redo buttons. Control-Z from a workspace button undid
  a repository association; CLI readback confirmed the property was absent.
  Control-Shift-Z restored it. Meta-Z in a repository input undid a typed
  character without undoing project state.
- Attached an existing graph, associated a synthetic repository and clicked
  Ask agent. Native Chat opened with `/anatomy`, the analysis item attachment,
  and the honest nobody-listening state. More → View Anatomy and the right
  rail's View Anatomy both returned to the workspace. A project card carries
  an explicit link selecting that analysis.
- Opened a fresh repository-associated canvas: its right rail offered Analyze
  repository before any analysis existed.

Final checks after the follow-up implementation: `npm test` **4,161 passed,
70 skipped**, 416 passing files and five skipped; `npm run typecheck` passed;
production build passed; hooks lint and module CLI/runtime tests passed.
The entry bundle is about **660.4 KB**. It remains over the 640 KB goal but
below the existing jump guard; the ceiling was not raised. Connections, card
bodies and workspace UI load lazily. The prior performance debt remains.

Both surfaces: existing `project.update` and thread operations own association
and requests; no new operation or server endpoint. CLI adds repository,
attach, analyze and show --node; its guide documents each. The shared module
core owns the neighborhood query, and shared operation helpers own imports and
analysis requests. README and module authoring docs cover the new doors.
Native gestures and pane size stay local UI state; they need no durable op.

## 12 September — Sidebar consistency and usability review

Module project entries now use the rail's ordinary icon-only button, preserving
the accessible name and hover/focus tooltip. The browser measured View Anatomy
at 38 × 38 pixels with only its glyph as visible content; clicking it opened
the rich workspace. The More menu retains its label. This presentation fix
changes no operations, CLI commands, agent guide, shared core logic or README
feature description. No implementation-mirroring test was added.

The broader [usability review](usability-review.md) records browser and synthetic
reducer probes, the issues they established, and follow-on acceptance gates.
It does not claim those proposed fixes are complete. The final full suite
passed **4,161 tests, 70 skipped**, across 416 passing and five skipped files;
typecheck and production build passed. The generated roadmap was refreshed to
include phase 6, which its earlier committed note omitted. An unrelated agent
teardown assertion failed on the first full run and passed on the full rerun.

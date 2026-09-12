# Anatomy integration: usability and operation review

12 September 2026. Reviewed branch `anatomy` at `d3895819`, plus the icon-only
project shortcut fix made during this review. This is a review of how Anatomy
fits isocan, not another analysis of the repository's product architecture.

**The native-canvas foundation is the right one. The experience is ready for
guided exploration, but needs another pass before unattended analysis updates
or everyday editing can be called dependable.** The largest debts are a
readable entry view, an explicit analysis lifecycle, and preservation of work
across edits. Adding more graph features would not discharge those debts.

## What was checked

Read the workspace, renderers, schemas, graph reconstruction, shared mutation
helpers, CLI registration and guide, slash-command instructions, module host,
project navigation, and module tests. Ran the actual CLI help for the command
family, analysis request and checkpoints. The full suite includes a real
daemon/CLI journey through import, edit, request, comment, restore and undo.

Drove the built app in a real browser at the existing 639 × 734 viewport and
at 1280 × 850: project shortcut, concept selection, neighborhood exploration,
decision queue, evidence dialog, coverage, editing-mode switches, and leaving
and returning to the workspace. No analysis content was changed in these
browser probes. Separately used the real reducer and module helpers against
synthetic in-memory data to exercise stale files, independent concurrent edits
and a malformed native concept. Prior acceptance evidence for dragging,
keyboard undo, resizing, import/export, runtime loading and read-only access
is in [verification.md](verification.md); it was not all repeated here.

This is an implementation-informed usability assessment by one reviewer.
There was no recruited-user study, screen-reader session, hosted execution
exercise, large-corpus benchmark or new agent model run. Findings distinguish
observed failures from behavior established by source inspection.

## What fits well

- Concepts are real items. Movement, selection, versions, comments and actor
  attribution use the same system as other project artifacts. The module does
  not fork the daemon, replica or canvas into a second collaboration product.
- Blueprint, Decisions, Coverage and Overview answer different questions about
  the same content. Selecting from the hierarchy reliably exposes a readable
  inspector; evidence clearly distinguishes recorded snippets from attached
  files. Missing discipline judgments remain **Not assessed**.
- UI and CLI writes share `operations.ts`. Validation, project scoping and
  undo grouping do not have separate client implementations. Portable files
  remain accessible if the module disappears.
- Analysis requests are normal Chat requests, with honest wording about needing
  an agent. Chat and agent presence remain native. This is a useful foundation
  for execution visibility, even though the full lifecycle is not yet modeled.
- The right-rail fix now uses the ordinary 38 × 38 icon button. “View Anatomy”
  remains its accessible name and hover/focus tooltip; the More menu retains
  a text entry. Canvas-authored tool labels retain their existing behavior.

## Findings, in order of consequence

P1 means resolve before routine collaborative editing or unattended updates;
P2 means a material usability gap for the next integration pass. These are
priorities for this feature, not claims of a production security incident.

### 1. P1 — A fresh canvas snapshot does not make an older input file safe

**Reproduced with real shared helpers.** Writer A reads a concept. Writer B adds
evidence. A changes the summary in its older JSON file and runs the equivalent
of `anatomy node`. The command reads the *current* graph before saving the
*older* file, so the freshness check passes. B's evidence is replaced: the probe
went from two citations to one. Prior native versions remain recoverable, but
the current result silently loses the other writer's work.

There is also an opposite failure: saving one browser concept checks the
project item and **every concept**. A change to an unrelated concept rejects
the draft. The synthetic probe edited “Access boundary” and then rejected a
draft for “Request workflow.” Finally, checking before sending is not an atomic
precondition; another writer can still intervene between check and apply.

Use a version token captured when the draft is read, accept it in both clients,
and enforce it at the authoritative write boundary. Compare only the replaced
fields/items plus actual graph dependencies. Offer a conflict comparison that
keeps the draft. Field patches improve ordinary edits, but do not replace the
version check for whole-body replacement.

Evidence: [CLI node](../../../packages/modules/anatomy/src/cli.ts#L229),
[freshness check](../../../packages/modules/anatomy/src/operations.ts#L113),
[whole-graph guard](../../../packages/modules/anatomy/src/operations.ts#L266).

### 2. P1 — Switching editor modes discards a valid unsaved draft

**Reproduced in the browser.** Edit complete JSON, change a title, uncheck the
JSON option: the form shows the old title. Recheck JSON: the changed JSON has
been overwritten. The two editor states only synchronize from form to JSON.
This is particularly costly because citations, assessments and options require
the complete-JSON path today.

Use one canonical draft, parse and validate before leaving JSON mode, and keep
invalid text in place with an inline explanation. Closing or changing views
also needs an explicit draft-preservation policy. Do not require a user to
learn which direction a mode switch preserves their work.

Evidence: [NodeEditor](../../../packages/modules/anatomy/src/workspace.tsx#L1580).

### 3. P1 — One malformed concept can prevent the analysis from opening

**Reproduced with real reducer/read helpers.** An ordinary native version update
containing invalid concept JSON caused the whole `readProject` call to reject.
The UI catches that as a project error; on first load no project is available,
while after a successful load an older graph can remain displayed. The same
strict reader is used by most CLI editing commands, making repair awkward.
Checkpoint bodies are also loaded as part of every project read.

Keep strict validation for writes/import, but make exploration return healthy
items plus item-scoped diagnostics. Name the broken item, link to its native
versions/editor, retain a retry action, and label any retained snapshot as old.
Provide an agent-readable validation/repair report. A corrupt optional
checkpoint should not make the current graph unreadable.

Evidence: [readProject](../../../packages/modules/anatomy/src/core.ts#L26),
[workspace loading](../../../packages/modules/anatomy/src/workspace.tsx#L137).

### 4. P1 — Analysis targeting and execution status are incomplete

**Established by source inspection; the native Chat request was verified in
the earlier acceptance journey.** The project owns one repository and one
attached analysis, while the workspace permits several analyses. The UI uses
the selected/fallback analysis; the CLI requests an update only for the item
named by `anatomy.analysis`. If that property is absent or stale, the UI may
update an existing analysis while the CLI asks to create a new one.

Selecting a different analysis and pressing Ask agent also changes the attached
analysis, even though a separate Attach action exists. Importing any analysis
changes the attachment and may replace the repository property. Changing the
repository then asking for an update can target an analysis of the previous
repository without explaining that mismatch.

After submission, the module has a temporary message and a Chat comment, but
no durable request identifier returned to the caller, no module-level claimed /
running / completed / failed state, and no result link tied to that request.
Repeated requests are allowed. Native Chat already supplies useful dispatch
and presence feedback; the module should derive from that evidence, not invent
another activity channel or interpret a submitted request as running work.

Create one shared target resolver and make “view this analysis,” “attach this
analysis,” and “request an update” distinct intentions. Show the repository and
analysis that will be used. Add a native request/run record linked to its Chat
comment, executor, reviewed revision, result and failure. A retry must name the
earlier request; cancellation must be an explicit request to the worker, since
undoing a Chat message cannot undo work already performed elsewhere.

Evidence: [UI target](../../../packages/modules/anatomy/src/workspace.tsx#L73),
[CLI target](../../../packages/modules/anatomy/src/cli.ts#L88),
[request operations](../../../packages/modules/anatomy/src/operations.ts#L601).

### 5. P2 — “Fit graph” is technically complete but often unreadable

**Observed in the browser.** The 31-concept graph appeared as a long, narrow
column of tiny cards; the main canvas showed 8% zoom. Opening Anatomy retained
that camera in a smaller canvas area. At narrow width both exploration panels
start closed. At desktop width, open panels leave a 700 × 633 stage inside a
1280 × 850 window. Selecting a hierarchy row restores readability, but a new
visitor must first discover that escape route.

The layout places every item at a given depth in one column. Neighborhood
navigation frames the world bounds of its members without hiding other items
or changing their positions. Distant relatives therefore still force a broad
zoom. “Arrange” repeats the same layout strategy.

Land on the root plus its immediate children at a readable scale, or offer the
Overview when no useful saved exploration state exists. Keep Fit all as an
explicit overview action. Add hierarchy-aware placement with subtrees kept
together, then measure 30-, 100- and 300-concept graphs. Preserve native geometry
and collaboration; local emphasis/depth visibility need not mutate the graph.

Evidence: [layout](../../../packages/modules/anatomy/src/manifest.ts#L158),
[choose/jump/fit](../../../packages/modules/anatomy/src/workspace.tsx#L176).

### 6. P2 — Navigation loses the context the user wants to return to

**Reproduced in the browser.** Decisions → Canvas → View Anatomy returns to
Blueprint with “All concepts.” Lens, focal path, panel sizes and search live
only in component state. The picker reads `?project=` at initialization but
does not update the URL when another analysis is selected. A copied address
cannot identify a specific concept or decision view.

Put analysis, lens and focal concept into a module-scoped navigation state and
shareable URL. Keep panel sizes as local preferences. Back/Forward should walk
exploration, while returning to the canvas preserves its own useful camera.
Do not write personal navigation or pane sizes to shared operations.

Evidence: [initial state](../../../packages/modules/anatomy/src/workspace.tsx#L73),
[picker](../../../packages/modules/anatomy/src/workspace.tsx#L272).

### 7. P2 — The command family covers primitives better than complete tasks

**CLI help and implementation inspected.** There are 20 subcommands, but most
edits require the analysis item ID, original concept IDs and a temporary JSON
file. Read output does not consistently include the native item mapping needed
to comment on a concept. `sample` provides only a concept shape, while a first
analysis requires a complete project shape. `analyze` always prints prose,
`node`/`source` print plain IDs, and checkpoint save returns no checkpoint ID;
global `--json` is not a uniform mutation receipt contract.

Relationship creation is available in the UI, upsert in the CLI, but removal
has no module command or inspector action. Renaming an existing edge is also
absent from the UI. Raw native property edits remain possible, which is useful
for recovery but too low-level for the routine intention. There is no concise
concept patch, decision resolution, project metadata/source-catalog edit, or
analysis validation/diff workflow.

Default an omitted analysis argument to the attached analysis when unambiguous;
accept both logical and native concept IDs. Return structured receipts and
mapping fields. Add focused verbs for patch, resolve, relationship removal,
validation and previewing a proposed update. Keep the existing file-based
import/upsert path for bulk work. Clearly distinguish `--canvas` from an
analysis selector, and call the inner object an **analysis** in UI/help rather
than another “project.”

Evidence: [CLI](../../../packages/modules/anatomy/src/cli.ts),
[agent guide](../../../packages/modules/anatomy/agent-guide.md),
[relationship form](../../../packages/modules/anatomy/src/workspace.tsx#L1275).

### 8. P2 — Shared undo groups do not provide an all-or-nothing update

**Established by source inspection.** Import, edit, restore and promotion send
several native operations sequentially. Group IDs provide one undo experience,
but there is no transaction around the group. A disconnect or rejected later
operation can leave a partial result. The analysis attachment happens last on
import; a partially imported graph can exist without being the attached result.
This is already acknowledged in the design and must stay explicit in the API.

For automated updates, validate and preview the complete change set first.
Use native idempotency plus a durable request/change-set receipt so a worker
can resume and report exactly what applied. If all-or-nothing updates are
required, add a generic conditional batch at the core/daemon boundary, with
defined inverse and replay behavior. A module-local “transaction” that merely
loops over `send` would repeat the same problem.

Evidence: [CLI IO adapter](../../../packages/modules/anatomy/src/cli.ts#L42),
[import](../../../packages/modules/anatomy/src/operations.ts#L140),
[restore](../../../packages/modules/anatomy/src/operations.ts#L386).

### 9. P2 — Checkpoints need a change preview and a precise recovery promise

**Source inspection, supported by existing restore tests.** A checkpoint stores
concepts and edges, not the overview, repository, source catalog, source bytes,
positions or native discussion. The dialog correctly says it is a saved
snapshot and labels the action “Restore these concepts,” but offers no list of
what will be added, changed or removed. A removed concept restored later gets
a new native ID because the restore only matches live items; restoring all of
that concept's previous native anchors is not part of this implementation.

Name these **concept checkpoints**, show a diff before applying, and explicitly
describe preserved versus restored content. Prefer native identity recovery
where a matching trashed concept exists. Whole-analysis recovery should be a
separate deliberate scope, using the native backup/history capabilities where
appropriate. The CLI needs the same diff and scope contract.

Evidence: [checkpoint shape](../../../packages/modules/anatomy/src/schema.ts#L130),
[restore matching](../../../packages/modules/anatomy/src/operations.ts#L394),
[restore dialog](../../../packages/modules/anatomy/src/workspace.tsx#L913).

### 10. P2 — Settled, reviewed and current are different facts

**Observed in the report; semantics confirmed in code.** The 84% figure counts
top-level settled statuses. It does not measure discipline coverage, evidence
quality or freshness. Choosing a resolution or promoting a mock settles the
concept while existing discipline assessments may remain in conflict. The
decision queue sorts status then title, ignoring recorded priority. Concept
updates also leave the project body's `lastUpdated` unchanged, as the synthetic
probe confirmed. There is no structured reviewed-revision/freshness contract.

Keep “settled” as a decision state with its definition nearby. Show review
coverage and last analyzed revision separately; mark assessments needing review
after relevant changes. Sort the queue by explicit priority within a stated
policy. Record an analysis run's time/revision on successful completion rather
than treating any content edit as a fresh repository analysis.

Evidence: [convergence and decisions](../../../packages/modules/anatomy/src/manifest.ts#L106),
[resolution](../../../packages/modules/anatomy/src/workspace.tsx#L1336),
[promotion](../../../packages/modules/anatomy/src/operations.ts#L493).

### 11. P2 — Discovery and accessibility need to follow intent and space

The icon-only rail is fixed. Remaining source-level gaps: the rail is hidden
for read-only collaborators even though opening an analysis is a read action;
the More menu and launcher still work. With neither a repository nor analysis,
the project has no Anatomy entry in its menu/rail, so users must discover the
launcher before associating the repository. “Analyze repository” is a navigation
entry into the workspace, not an immediate analysis start.

In the workspace, long titles truncate in a fixed hierarchy panel, evidence
buttons include long snippets in their accessible names, and all connections
become Tab stops. The resizer supports keyboard control, but its reported ARIA
maximum does not match its actual stage-dependent clamp. These are inspection
findings, not a completed assistive-technology audit.

Keep a readable project-level setup entry, expose navigation to readers, and
separate frequent exploration controls from import/export/checkpoint actions.
Give evidence buttons concise labels and roving keyboard navigation to the
graph/tree. Measure the real available stage when reporting resize bounds.

Evidence: [project entry](../../../packages/modules/anatomy/src/web.tsx#L57),
[rail permission gate](../../../packages/web/src/pages/CanvasPage.tsx#L956),
[resizer](../../../packages/modules/anatomy/src/inspector-pane.tsx),
[connection keyboard behavior](../../../packages/modules/anatomy/src/edges.tsx).

## UI, CLI and operation contract

| User intention | Current UI / CLI | Shared operation path | Next contract |
| --- | --- | --- | --- |
| Associate repository | Repository form / `repository` | `project.update` | One validation/clear policy; explain local path access and analysis mismatch |
| Choose default analysis | Attach / `attach` | `project.update` | Shared target resolution; requesting work should not unexpectedly reattach |
| Request analysis | Ask agent, `/anatomy` / `analyze` | Project property update + native thread create/reply | Request ID, explicit target, executor/status/result, retry/cancel semantics |
| Explore | Card/tree/edge / `show --node`, `decisions`, `coverage` | Reads and local UI state | Readable entry; URL state; native/logical ID mapping |
| Edit concept | Form or JSON / `node` | `item.addVersion` + metadata update, or `item.add` | Draft version, conditional apply, field patches and conflict recovery |
| Edit relationship | Add form / `edge` | `item.update` on source items | Edit/remove parity; affected-relationship preview |
| Resolve decision | Choose option / whole `node` replacement | Same concept operations | Named resolution action and consistent review-state effects |
| Analyze again | Agent composes imports/upserts | Several item/property operations | Validate/diff/apply preserving stable IDs, comments and unrelated work |
| Arrange | Arrange / `layout` | `items.move` | Hierarchy-aware placement; preview when rearranging substantial work |
| Attach evidence | File chooser / `source` | `item.add` or `item.addVersion` | Versioned source provenance; independently editable source catalog |
| Checkpoint/restore | Snapshot dialog / checkpoint flags | Snapshot item; grouped concept writes/deletes | Same scoped diff and recovery promise on both surfaces |
| Discuss/recover | Native Chat/comments/history / native commands | Existing thread and undo vocabulary | Keep native ownership; link outcomes to the request that caused them |

## Module API recommendations

Keep Anatomy-specific concepts in its module. The existing `projectEntry`,
workspace facts, activation subscription, read/upload/send host and native
canvas slot are sufficient foundations. The sidebar fix needed no API change.

Expand APIs only where another workspace could need the same capability:

1. **Navigation state:** module-scoped URL/query updates and local preference
   storage, with Back/Forward semantics. Selection/focus remain native; richer
   framing can accept readable-scale or padding preferences without writing
   item geometry.
2. **Work requests:** a native Chat request/result receipt and observable
   execution evidence. The module specifies task inputs and result type; the
   host/agent owns dispatch, permissions and honest activity. Repository access
   is a worker capability, not arbitrary filesystem access granted to web code.
3. **Conditional writes:** expected version/metadata revisions enforced with
   operations, plus a generic batch/change-set facility only if the product
   needs atomic multi-item updates. Both clients must share the same semantics.
4. **Capability facts and diagnostics:** separate read/navigation from editing,
   and expose item-scoped read failures with host routes to repair/version
   history. Keep schema-specific validation in the module.

Most missing semantic CLI actions should compile to the existing native
operations. They do **not** justify Anatomy-specific daemon routes or a second
mutation reducer. Any new generic precondition or batch operation needs CLI,
reducer, inverse, replay and agent-guide coverage together.

## Suggested implementation phases

| Phase | Deliverable | Acceptance gate |
| --- | --- | --- |
| 1 — Preserve work | Single draft model; version-bound edits; narrower conflict scope; item-scoped read errors | JSON/form round trip preserves draft; stale agent file cannot replace newer evidence; independent concepts can be edited concurrently; one malformed item stays repairable |
| 2 — Make entry and return useful | Root-level landing, improved hierarchy layout, persistent view state, reader-visible navigation | First visit is readable for 30/100/300 concepts; copied decision URL opens that decision; Canvas → Anatomy restores context; narrow stage retains useful content |
| 3 — Complete the analysis workflow | Shared repository/analysis resolver; request/run receipts; explicit provenance and result links | No-agent, inaccessible-repo, failure, retry and completion states are understandable; multiple analyses resolve identically in UI/CLI; request does not imply execution |
| 4 — Finish semantic editing and recovery | Patch/resolve/edge removal; structured CLI receipts; validate/diff/apply; checkpoint diff | Every listed intent has equivalent UI/CLI outcome; preview matches applied operations; partial failure is resumable or explicitly rolled back; comments/IDs survive supported recovery |
| 5 — Validate with collaborators | Keyboard/assistive-tech pass, real multi-writer review and graph-scale measurements | Observe a person and agent completing analysis → critique → update → recover without undocumented steps; report latency, failures and remaining limitations |

The earlier implementation phases describe what was built and exercised.
These follow-on gates test whether that implementation is comfortable and
dependable in the larger workflow; a passing component test is not evidence
that every gate here is already satisfied.

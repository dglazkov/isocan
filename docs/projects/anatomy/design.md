---
status: built
since: 2026-09-11
see: anatomy, modules, atlas
note: phases 1–5 built and verified on branch anatomy; native file graph, proposed workspace API, four lenses, CLI parity, evidence, native discussion, checkpoints and mock promotion; full suite, typecheck, production/runtime builds and desktop/phone browser journey passed
---
# Anatomy on an isocan canvas

This discharges two debts: Anatomy keeps a second canvas/state system, and
isocan modules cannot yet compose a complete workspace around the native
canvas. The module owns the exploration UI; isocan owns every durable change
and the canvas people and agents work on.

## Scenes that decide the design

1. A person opens Anatomy from the canvas launcher, imports an `.anatomy.json`
   export and sees independently selectable concept cards. Dragging one moves
   the same item `isocan get` describes. A note placed beside it remains there.
2. Selecting a tree row selects and frames that card. Selecting a card updates
   the inspector. The two sidebars can collapse on a small window. Switching
   lenses preserves selection and canvas camera; Back returns to the canvas.
3. A decision shows the concern, the axes in tension, each assessment that
   actually exists, evidence and possible resolutions. A resolution edits that
   concept, and one Undo reverses the act. Coverage and convergence immediately
   read the result from the same files.
4. An agent changes a concept through the module's CLI. The UI updates through
   the ordinary replica. A person comments in the inspector; an ordinary
   `isocan wait` sees an ordinary item-anchored thread. Imported marginalia is
   labelled history; it does not impersonate those writers.
5. The module is absent. Its concepts, project record and checkpoints remain
   downloadable JSON files, with their versions, positions and comments intact.

## Data model

Several Anatomy projects may share a canvas. Each has a visible project item
with a vendor JSON mime; its item id is the membership key. Concepts are
separate vendor JSON items. Checkpoints are separate snapshot JSON items.
All use `item.add`, `item.addVersion`, `item.update`, `items.move`, and native
threads. **No new Operation or server route.**

Each fact has one canonical home:

| Fact | Home |
| --- | --- |
| Project/concept name | Native item title |
| Project metadata, goal, brief, source catalogue, analysis settings | Project JSON body |
| Concept category, status, summary, reason, assessments, citations, options, imported marginalia, mock proposal | Concept JSON body |
| Original project/concept id | Namespaced item property, preserved for export |
| Membership | `anatomy.project` item property |
| Parent, parent relation, outgoing labelled/coupled edges | Namespaced item properties referring to native item ids |
| Card geometry | Native item geometry; layout is an explicit `items.move` |
| New discussion | Native anchored comment threads |
| Checkpoint | Immutable JSON snapshot in a versioned item |
| Attached source bytes | Ordinary file item with project and source-id properties |

JSON body schemas omit facts owned by item metadata. Export reconstructs the
prototype's graph from those homes, including native discussion as comments.
Import validates before upload, remaps all native ids, rejects duplicates,
missing edge endpoints, and parent cycles. A repeated import creates a new
project, never silently replaces somebody's existing work. Unsupported data
is refused explicitly rather than silently dropped. Layout remains stable
until asked for. Blob reads are cached by hash and invalidated by versions.

Sources stay citations until explicitly attached through a file picker or
`anatomy source`. No repository crawl is hidden behind opening a project.
Mock HTML renders in a sandbox without same-origin access; promotion adds a
normal HTML item as a source, updates the concept, and groups the changes for
undo. It does not run server-side code.

## The module API extension

Add a proposed `workspaces` contribution to `WebModule`. It has a route segment,
label, hint, CLI equivalent, and component. It uses the existing `/p/:id/x/:segment`
address vocabulary and launcher; pages continue to be covers.

`WorkspaceFacts<Surface>` carries the canvas, selection, a `WorkspaceHost`,
and a host-created `canvasView`. The module places that view in its layout;
it cannot instantiate a second transport or import web stores. Only one
native viewport is mounted. The module marks its canvas container so the
host measures the actual visible rectangle for focus, zoom and radar.

`WorkspaceHost` extends the write/upload host with explicit capabilities:

- read a blob by hash, using the authenticated canvas blob client;
- select item ids and frame item ids on the native canvas;
- open an ordinary item in the host viewer;
- obtain the latest canvas snapshot before committing a draft.

`WorkspaceFacts.canEdit` reports the effective capability; it is false in history.

The shell owns the route, Back action, native Chat/Agents access, Undo/Redo controls, loading/error boundary, stage
measurement, selection subscription and read-only gate. Module inputs do not
reach hidden canvas shortcuts. Native comments remain reachable through the
module's inspector using the same operations and via the ordinary canvas.
Navigation is local UI state, never an operation.

Renderer facts gain an optional `item` so a structured file renderer can
display its native title and metadata without a private store import. Existing
renderers keep working. Workspace capabilities are additive and proposed;
raise the API patch version, and ship `isocan.proposed` through the module
builder so runtime installs enforce the declaration. No global sidebar
registry, server hooks, arbitrary filesystem access, or new framework.

## Module boundary and UI

`packages/modules/anatomy/` contains schemas, graph/adaptation functions,
layout, reads/writes, React UI, styles, CLI, agent guide and tests. The shell
imports it only in its web and CLI module lists. The web workspace and
renderers load lazily. Build/runtime packaging and module removal are tested.

The workspace contains a project picker, goal/convergence header and four
lenses. Blueprint frames the native canvas with a searchable hierarchy on
the left and the selected concept's inspector on the right. Overview is the
goal and narrative brief. Decisions uses a concern queue and report. Coverage
is an axis-grouped matrix with discipline and source columns. Checkpoints are
readable snapshots with explicit restore; they never claim live state changed
merely because a snapshot was opened.

The existing isocan project switcher replaces Anatomy’s separate global home.
The workspace's project picker handles several analyses on one canvas.
Existing agent enrolment/presence and comments replace the prototype's activity
socket and prompt queue. Automated repository analysis stays work an agent
does through documented verbs; the module never claims to have performed it.

## Agent parity

The command family covers create/import/export/list/show, goal/brief edits,
concept and edge upserts, layout, decision/coverage queries, source attachment,
mock proposal/promotion, and checkpoint save/inspect/restore. Shared pure
builders and graph functions drive web and CLI. Standard `get`, `set`,
`comment`, `undo`, `history`, `session`, and `wait` cover native acts.

## Risks and bounds

Many concept files mean many first-load reads. Cache by content hash, fetch
concurrently, and never reload all bodies for selection or movement. Invalid
files show an actionable error without crashing the canvas. Writes operate
on the selected project/concept and refuse stale bodies before replacing a
version; grouped operations provide undo, not transactional isolation. No
concurrent-edit guarantee stronger than native item versions is implied.

Checkpoint restore is scoped to its project's concepts and relationships;
unrelated notes and projects survive. Restore preserves existing matching
items where possible, so positions and discussion follow their concepts.
Imported snapshots are provenance, not isocan operation history.

The graph will use native cards and explicit layout, rather than copying
Pixi's depth shrinking and physics. The aim is the exploration workflow with
native canvas affordances. Pixi, Three.js, and their alternate cameras are
deliberately excluded.

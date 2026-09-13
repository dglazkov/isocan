---
status: partial
since: 2026-09-12
see: sprint, context, mindmap, 2026-08-28-op-grouping.md
note: phase 1 has verified explicit membership, shared transforms, exact inverses and protocol gating; client surfaces, context and migration remain in phases 2–5
---
# From areas to groups

An area looks like a container but does not own anything. This plan discharges
that mismatch: a **group is an item with explicit members**, and working on
that item acts on the things it contains. Membership, movement, resizing,
context and layout must mean the same thing in the browser and the CLI.

The shared foundation is implemented and verified in phase 1; the client
commands and complete experience below remain the implementation contract.
The initial review used `main` at `ed1520a6`;
the checkout was subsequently updated to `19355501` on 12 September 2026.
The conduct contract is now [phases.md](phases.md), with the user-visible
acceptance in [journey.md](journey.md). The phase contract carries current
status and exact proof commands; the table below remains the design outline.

## What exists, and what must change

| Today | Consequence for the plan |
| --- | --- |
| [`core/area.ts`](../../../packages/core/src/area.ts) represents an area as a Markdown item with `kind=area`. Its body is the area's explanatory card. | Keep the group's identity, title, description, card, versions, comments, tint and grid. This is more than renaming a label. |
| `inArea` tests the item's centre against the rectangle; `itemsIn` excludes areas; `areaOf` chooses the smallest enclosing area. | An overlapping item can belong to several area queries, nesting is absent, and a node cannot be detached while remaining in the rectangle. Replace geometric membership with an explicit relation. |
| Browser dragging in [`ItemView.tsx`](../../../packages/web/src/components/ItemView.tsx) expands an area into its geometrically contained items. CLI `mv` expands annotations only. | Fix a present surface disagreement by putting the expansion and transform rules in core. |
| Browser resize changes the area's box only. A northwest resize can send separate resize and move operations. | Resizing a group must transform its members in one atomic, undoable act, including an origin change. |
| `areaInner` reserves 56 units for a title, 120 for a card, and 24 at the edges. Placement helpers use this, but membership tests the outer box. Grid row labels are drawn inside the cells. | Preserve the existing effort to reserve text space, make it cover every placement route, and give grid labels their own gutters. |
| [`MainThreadPanel.tsx`](../../../packages/web/src/components/MainThreadPanel.tsx) attaches the selected IDs to a message. | Selecting a container needs a deliberate expansion for context, distinct from its selection outline. |
| `isocan group new/list/add/remove/delete` manages groups of **people**. `LogEntry.group` groups undo steps. | Neither is canvas membership. Keep both meanings and their existing APIs intact. |

The [operation-grouping research](../../research/2026-08-28-op-grouping.md)
already establishes that an undo label is not a transaction. A loop of
`item.update` calls with the same undo label cannot safely establish a group.

## The experience to build

1. Select three cards and choose **Group selection**. A titled frame encloses
   them, leaving room above the first card. The cards keep their positions.
   One undo removes the frame and restores the prior memberships.
2. Drag that group's title or nudge it with the keyboard. Every descendant and
   its attached ink travels once. Another card merely overlapping the frame
   stays put. `isocan mv <group> --by 100,40` produces the same result.
3. Drag a resize handle. Member positions and dimensions change in the
   preview, and one undo restores the whole arrangement. **Fit frame to
   contents** is a separate action which changes the frame without resizing
   the cards.
4. Enter the group, select one card and choose **Remove from group**. The card
   stays where it is, but subsequent group moves and resizes leave it alone.
   **Ungroup** dissolves a selected group and keeps all its children.
5. Drop a new card into a highlighted group, paste while working inside it,
   or choose **Add to group…**. The group makes room for it without shrinking
   its existing children or putting the new card over the title.
6. Select the group and write “review these.” The composer says
   **Acme ideas · 8 items**, lets the person inspect those eight, and sends
   their contents and the group's own brief as context. An agent can request
   exactly the same scope without driving the browser.

## Membership is a canvas fact

Add an optional typed `containerId` to `Item`. It names another item in the
same canvas whose kind is `group`; absent means the canvas root. Derive child
lists from that field. Do not also store an authoritative member array on the
group. Do not reuse `parent` (lineage), `mapParent` (mind-map structure),
`annotates`, an identity group's ID, or the log's undo-group ID.

The reducer enforces these invariants:

- Every live member has zero or one live group parent, on this canvas.
- Self-membership, cycles and membership in a non-group are refused.
- Groups may contain groups. Traversals deduplicate IDs and operate on
  selected roots: selecting a group and one of its descendants never moves,
  deletes or copies the descendant twice.
- Coordinates remain in world space. Entering, leaving and dissolving a
  group do not require rewriting coordinates or introduce a second coordinate
  system into every existing renderer and module.
- Geometric overlap is useful for a **drop target**, never an ongoing source
  of membership. Moving a group over unrelated items does not collect them.
- Empty groups are valid. Removing the last member leaves the named frame;
  only an explicit Ungroup or Delete removes it.

**Attached ink has one transform owner.** A live annotation and its live
target share `containerId`; a mark on a nested group's frame is that group's
sibling, not one of its children. Reparenting, wrapping, removing, copying or
deleting a target carries its attached marks atomically. A membership-only
edit that would separate a mark from its target is refused; the person can
detach the annotation relation first. Annotation-only geometric editing is
still possible. Generic edits to `annotates` must validate and reconcile this
invariant too. Ink-to-ink attachment remains unsupported.

Expose **Detach from annotated item** on the ink menu and document
`set <ink> --rm-prop annotates --rm-prop region` as its CLI equivalent.
Both clear the attachment metadata in one operation while preserving
`containerId` and world geometry; one undo restores the attachment if its
preconditions still hold. The mark can then be removed from its group as a
separate explicit act. Verify refusal → detach → remove → undo on both
surfaces, including undoing the detach after membership is restored.

Use a derived parent/children index per canvas revision for traversals. The
group relationship is independent of module-specific relationships: grouping
mind-map nodes does not change their edges. Modules should use the same native
container relation, rather than invent their own canvas-membership property.

### Joining, moving between groups and leaving

**Group selection** wraps the normalized selected roots in their existing
positions. For siblings, the new group has their common parent. For a mixed
selection, place it under the lowest common containing group (or the canvas)
and explicitly reparent the selected roots there; unselected siblings stay.
Show the affected roots in the preview and keep nested selected groups intact.

**Add to group…** and `group add` preserve positions by default and fit the
destination frame around the resulting members. A `--place` option arranges
the additions at clear positions inside it. Moving an existing member from
another group is one reparent operation, not remove-then-add requests. The
source frame keeps its size until explicitly fitted.

**Remove from group** reparents a selected child to its current group's
parent, preserving its entire subtree and world position. `--to-root` offers
the canvas itself when the group is nested. A mixed selection can have several
destination parents: resolve them from one starting state in one `remove`
intent, rather than issuing a reparent request per destination. **Ungroup** reparents all direct
children to the dissolved group's parent, keeping nested groups intact.
The frame goes to trash, with its own card, versions and comments recoverable.
Marks attached to that frame go to trash with it; marks attached to promoted
children follow those children. Undo restores the frame and its own marks as
well as the prior memberships.

A member dragged within its current group keeps its parent. Dragging it out
does not silently detach it: the frame grows on commit to enclose it. An
explicit Remove action is always available; a drag into another group's
highlighted content region is an explicit reparent. Holding Alt suppresses
the drop target. A detached node still inside a frame stays detached until a
later deliberate add/drop. A group dragged as a whole never acquires members
from the rectangles it passes over.

Overlapping drop targets choose the deepest eligible content region, then
paint order; show the target name before release. Exclude the moving subtree
and anything that would create a cycle. Dropping over a title does not put a
card on the words; it offers a clear position in that group's content region.

## Moving and resizing

`groupTransform` in core owns the calculation. The browser uses it for the
preview and the daemon uses it for the committed result. Capture starting
geometry once per gesture; derive every preview from that starting geometry
to avoid accumulated rounding drift. Escape or pointer cancellation commits
nothing. A completed gesture is one operation and one undo.

**Move:** translate the selected roots, all descendants, and attached
annotations by one delta. Deduplicate the full closure, including an
annotation reached both by membership and by attachment. Arrow keys, drag,
CLI `mv`, API callers, align, distribute, and whole-canvas tidy use this same
rule.

When a target participates, normalize it and its attached marks into one
placement unit for move, align, distribute and tidy as well as resize. Marks
receive no independent layout slot or competing delta, even if explicitly
selected too. Its footprint includes their overhang; the target's resolved
geometry determines their movement. Selecting only a mark may still perform
an explicit annotation-only geometric edit and refresh its region metadata.

For resize, resolve target boxes first and then transform attached ink from
its target's old outer box to its new outer box. This takes precedence over
the parent's content-box transform. Use the ink's actual starting box and
unclamped offsets so a stroke extending beyond the target stays intact;
`annotationRegion` is rounded/clamped context metadata, not sufficient
geometry for this calculation. Traversal or item insertion order must not
change the answer. Frame-only changes also move/resize marks attached to the
frame they describe, while preserving member geometry.

**Resize:** resize member frames, not just the container. Normal handles
allow independent width and height changes; Shift keeps the starting group's
outer aspect ratio. CLI accepts a destination size and anchor corner; the
op records the complete destination box, including x/y.

For an old content box `(cx, cy, cw, ch)` and new content box
`(nx, ny, nw, nh)`, transform each direct child's frame together with its
persistent external label reservation `L` (24 units for labelled cards,
zero for text, ink and groups):

```text
sx = nw / cw                         sy = nh / ch
x' = nx + (x - cx) * sx             y' = ny + (y - cy) * sy
w' = w * sx                        h' = (h + L) * sy - L
```

The label keeps its world-space height inside the transformed placement
footprint. Scaling only the native frame while reserving an unscaled label
afterward prevents a fitted group from shrinking at all: the bottom card
would always hit the label boundary. Minimum constraints therefore compare
`minimumHeight + L` with `height + L`. Attached ink overhang remains governed
by the target-box rule above, not by an additional label-footprint transform.
For example, a single 400×400 labelled card produces a default 448×528 fitted
group; resizing that group to 336×396 produces a 288×268 card, preserving the
56-unit title, 24-unit insets and 24-unit external card label.

Nested groups receive a destination outer box from their parent, then apply
the same rule to their own content boxes. Do not additionally apply the outer
transform to their leaves. Each level reserves its own label space. Round at
commit using one shared policy; preview uses the same final constraints.

The piece's existing rendering semantics apply to its resized frame:

| Kind | Result of a group resize |
| --- | --- |
| Text / Markdown / sticky note | Frame resizes, text reflows at its existing text style. No content-version rewrite or implicit font-size edit. |
| Image, video, SVG, ink | Frame and placement resize; preserve the renderer's aspect/fit behavior. Attached ink follows the target's box transform, even when the ink lies outside it. |
| HTML, site, document or other embedded item | Resize its viewport using the existing renderer; no injected scaling or source edits inside an embedded app. |
| Nested group | Recursively transform its members, preserving that group's own label gutters. |
| Connectors and annotations | Recompute derived edge endpoints from the new geometry. Preserve normalized anchors/reaction positions and transform independent attached ink exactly once. |

Thus “resize” means resizing the native item frames. Uniformly scaling font
sizes and every visual detail like a flattened image would be a separate
future **Scale artwork** mode, not an implicit rewrite of text and embeds.

Compute the smallest valid destination from the header, gutters, and the
minimum dimensions of every affected descendant. Clamp the whole requested
transform; do not independently clamp some children and break their relative
layout. Empty groups use a documented minimum frame size. Refuse non-finite,
negative, or otherwise invalid boxes at the reducer boundary. Legacy members
which intrude into reserved label space require the layout repair below
before a scale transform; do not scale an already-invalid content box.

**Frame adjustment is a different operation.** Fit to contents, manual
“Resize frame only,” adding an item, and editing the header may change the
outer box while preserving existing child geometry. Fitting computes all
four edges, including space above and to the left; the current
`areaEnclosing` only grows right/bottom. Automatic growth never scales the
children and never pushes unrelated groups across the canvas. Propagate
necessary frame growth through ancestors in the same operation.

## Layout must make room for words

Define a shared `groupContentBox` and `groupFootprint` in core. The same
metrics drive rendering, creation, insertion, drop placement, grid cells,
tidy, resize constraints and fit. CSS consumes the constants instead of
carrying its own version. Reserve a fixed world-space band for persistent
child labels in the placement footprint, not merely the artifact's rectangle.
Start with 24 world units below cards that display a separate label; nodes
whose text is their content need no duplicate label. Labels truncate/hide
within that reservation at low zoom. Existing counter-scaled hover/selection
chrome is transient UI and is not an input to saved layout; zooming never
changes membership, frame sizes or child positions.

Start with explicit, deterministic geometry:

- Title band: 56 world units, with a single-line title that truncates within
  its band. The full title is accessible in rename/details and its tooltip.
- Brief/card band: absent when empty; 120 units when shown. Display a bounded
  preview and an explicit way to open the full Markdown card. Long content
  does not overflow into members. A manually enlarged band is saved as group
  layout metadata and is equally available to the CLI.
- Outer content inset: 24 units. Use the existing placement clearance/gap
  constants for spacing rather than a new independent set of distances.
- Named grid columns have a separate top gutter; named rows have a separate
  left gutter. Start with 32 and 120 units respectively, with bounded labels
  and explicit size controls. A cell's own usable box excludes its labels.

These are starting product defaults, to be checked visually at several zoom
levels. Membership and placement must never depend on DOM text measurement
that a CLI cannot reproduce. Show the complete title/brief in the inspector
and context even if the on-canvas preview is bounded.

**Creation:** wrap the complete selected footprints; place the header above
them, so the top-left item does not move or end up behind a label.
**Insertion:** find a free spot within the content box, ignoring the moving
subtree; if necessary extend the frame downward or outward. Every producer
must use this path: text, files, paste, duplicates, URLs, Google Docs, module
commands, and sprint hand-in. A requested grid cell may grow the frame to
fit or report the constraint; it must not silently place outside that cell.
Sandbox transcript creation is a producer too: inherit the program's group
explicitly when creating the transcript, and preserve the transcript's own
membership when adding later versions.
**Header edits:** grow the frame upward when more header space is needed,
leaving members in place; fit ancestors as necessary. **Tidy contents:** lay
out direct children as units below the header, then fit the frame. An inner
group's layout is changed only when it is itself the target.

Free positioning remains supported. Existing intentional overlaps between
members are preserved unless Tidy is chosen. Prevent overlap with the
group's own labels on every committed placement, including explicit CLI
coordinates: return the adjusted position, or a precise refusal when a
caller requires an exact position. Selection handles and drop highlights
must not become content obstacles.
Attached ink is also exempt from normal label-space placement: a deliberate
mark across a target's header must not be tidied away from what it annotates.

## Selecting a group and supplying context

Keep three different sets explicit in core:

- `selectionRoots`: what the person actually selected; normally one group ID.
- `transformClosure`: roots, descendants and attached annotations, deduplicated.
- `contextClosure`: group briefs, all descendants and their relevant attached
  annotations, in deterministic hierarchy/reading order, deduplicated.

Selecting a group must not rewrite the browser's selection to hundreds of
IDs. Draw one outer selection and a count; **Select contents** is an explicit
way to select its direct children for editing. Enter/double-click enters a
group, breadcrumbs show the active scope, and Escape returns to its parent.
Store this as a separate `activeGroupId`; existing `enteredItemId` belongs
to interactive embedded content and must retain that meaning. Enter on an
ordinary item still opens full screen; double-click retains that item's
existing behavior. Menus/editors handle Escape first, then an active gesture
is cancelled, then existing embedded/tool/rename/follow modes are dismissed,
then group scope moves up, then root selection clears. Removing the active
group repairs scope to its nearest surviving ancestor without changing an
unrelated selection.

Within a scope, clicking a descendant selects the direct child/group on its
path from that scope. Alt-click cycles overlapping eligible roots in that
scope; Enter/double-click descends. Clicking outside the active group exits
to the canvas and selects the outermost eligible item/group there. Marquee
selection obeys the same roots. A title/border of a group exposed in the
active scope selects that group itself. **Select parent group** remains an
explicit route from an individually selected member.

The message composer shows **Group title · N items** and a disclosure of the
actual context. Group selection supplies the whole subtree by default,
including its own brief, current artifact content/visual references, identity,
type, hierarchy and relevant discussion references. Context does not stop at
the frame's Markdown blob. Selecting the group and a child duplicates nothing.
Do not follow lineage, mind-map edges or links into unrelated items/canvases;
those remain references, not implicit recursive context.

An explicit attachment is different from ambient context pins. Include every
member in the manifest; honor existing `context=excluded` content settings by
showing excluded entries and the count, with **Include excluded items for this
message** as a visible override. The CLI gets the same option. Say “6 included,
2 excluded,” not “all 8,” until the override is chosen. Pinning a group makes
its current subtree available as ambient context; it does not stamp pins onto
all children. Excluding a group excludes its subtree from ambient context.

At send time the daemon resolves membership against one canvas revision and
records the selected roots, expanded item IDs and current version IDs/blob
references alongside the message's context. Reuse `Comment.items` for the
expanded IDs and add typed context provenance for roots/revision/versions.
Later reparenting does not change what an old request meant. Historical
version references need retention in blob GC; otherwise the record promises
content it cannot retrieve. Ordinary `#Group` references should use this same
explicit group-context path when attached to an agent request.
Retention stays within the canvas's existing storage boundary: it survives
ordinary GC, but operator purge removes it. Context endpoints honor takedown
and purge, and group selection grants no new authority to summon an agent;
the existing owner-only request policy still applies.

For large groups, keep the complete manifest and expose paged/lazy content
reads at those versions. Report unavailable and omitted content with reasons
and counts; do not silently claim an entire group was read when only the
first items fit the model budget. CLI scoped context and the read-only MCP
surface expose the same manifest and retrieval path. Context reads do not
require a browser selection or a write to presence.

## Operations and consistency

Phase 1 uses one `group.change` operation with a closed, typed action union.
Public actions are `create`, `reparent`, `ungroup`, `transform`, `frame`,
`layout`, `delete` and `restore`; a writer-only `apply` action carries resolved
structural facts and bounded field writes. The shared writer resolver handles
new ordinary geometry/lifecycle requests on group canvases through this same
boundary. Public callers cannot submit a resolved patch.

Phase 2 adds `remove` to this same closed action union. Unlike `reparent`,
which names one destination, removal derives each selected root's destination
from its current parent (or the explicit canvas-root option). It still emits
one bounded resolved change and one exact inverse for a mixed selection.

Keep operation members directly discoverable by `scripts/isomorphism.mjs`.
Any vocabulary-bound adjustment must name the semantic acts it accounts for;
type aliases that hide operation members would defeat that instrument.

| Intent | Operation / shared behavior |
| --- | --- |
| Make a group, optionally wrapping roots | `create`: new group item, membership changes and enclosing frame as one change. |
| Add or transfer one or several nodes | `reparent`: roots, destination group or canvas root, placement policy and required frame adjustments. |
| Remove one or several nodes from their current groups | `remove`: normalized roots and optional canvas-root policy; derive each destination from the same starting relation, preserving geometry in one change. |
| Dissolve a group | `ungroup`: promote children and trash the frame, preserving its recoverable contents. |
| Move or resize | `transform`: normalized roots, move delta or destination box, expected affected geometry/membership, and resolved changes. |
| Fit or resize frame only | `frame`: frame policy/box and ancestor frame changes; member geometry is unchanged. |
| Tidy, change grid or reserve header/gutters | `layout`: layout configuration and resulting geometry together. |
| Create a normal item inside a group | Extend `item.add` with typed destination/placement intent; adding, attaching and growing frames is one operation. |
| Rename, tint, replace the brief | Existing item metadata/version verbs, with header geometry changes compiled into the same atomic change when needed. |
| Delete/restore, copy/paste | Extend the existing intents to understand normalized subtrees, producing an atomic resolved change when membership is affected. |

Resolve intent through shared core helpers at the authoritative writer, then
record the concrete affected IDs, field changes and geometry. The shared
reducer validates the entire change before applying any of it; replicas
replay that concrete operation without rerunning geometric membership or
placement searches. If there is no suitable atomic item-change primitive on
the implementation branch, add one as part of phase 1 with a bounded schema
and first-class inverse. Do not make atomicity depend on a client request loop
or an unrelated unmerged feature branch.

Every semantic act has one envelope, one inverse and one undo. Upload blobs
first; a failed upload creates no partial group. Restore inverses capture
previous parent IDs, touched geometry, layout settings and trash transitions,
not whole-canvas snapshots. Validate the resulting forest for every path,
including low-level API writes, trash restore, property/kind changes and
inverse application. Generic property updates cannot bypass typed membership.

Route **new requests** for `item.move`/`item.resize` targeting groups through
the semantic resolver, including raw API calls. Do not reinterpret old log
entries: their explicit per-item effects must replay as originally recorded.
Audit generic `items.move`, align/tidy, fit, duplicate, delete and import
paths for the same distinction. Group-aware clients must not pre-expand a
selection and then have the server expand it a second time.

Concurrent writes follow the single writer's order. A transform captures the
complete descendant ID sets, parent and attachment relationships, geometry,
layout/header settings and minimum-size inputs it depends on; if those
changed during a drag or CLI plan, refuse the whole stale transform and
refresh the preview. A newly added descendant is a conflict even though none
of the previously captured members changed. Compare relevant fields rather
than `updatedAt` or the whole canvas revision.
Unrelated text edits must not block movement. A stale destination or deleted
member is a specific conflict, never a half-applied transform. Retry by op ID
is idempotent. Undo/redo validates the complete resulting relation and refuses
a conflicting structural inverse atomically rather than restoring a broken
tree or overwriting unrelated collaborator edits.

This requires an explicit change to the existing undo/redo engine:
`Engine.undo`/`redo` currently catch `OpValidationError`, discard the target
and continue to an older action. A group structural conflict must use a
distinct non-discarding path: return the conflict, append nothing, preserve
the same undo/redo candidate, and leave every earlier action untouched.
`repairInverse` must not shrink a structural group inverse. Keep the existing
repair behavior for ordinary item batches. Creation/copy redo uses the
inverse recorded during undo to restore original IDs, versions and authorship
from trash; add the relevant cases to `redoOpFor` instead of replaying an add
which collides with those trashed IDs.

Extend the operation plumbing beyond the reducer: inverter, runtime request
validation, `touches`, operation wording, recap/timeline, eval classification,
blob references/GC, undo stacks, optimistic application and API types. Report
all affected items for subscriptions and activity. These operations use canvas
edit authority; grouping does not grant or change access to anything.

## CLI and API surface

Use **`isocan canvas group`** as the canonical namespace. The browser says
**Group**. Preserve `isocan group` for sharing groups of people, and keep
`isocan area new/ls/grid` as documented compatibility aliases for canvas
groups once migration is enabled. Do not dispatch the same command based on
whether its operands look like email addresses or item names.

All commands below are proposed. IDs are stable; title prefixes must be
unique and ambiguous names list candidates instead of choosing the first.

| Command | Browser equivalent |
| --- | --- |
| `canvas group new "Acme ideas" [--at x,y] [--size WxH] [--note text]` | Create group on blank canvas / Shelf. |
| `canvas group wrap <items...> --title "Acme ideas"` | Group selection. |
| `canvas group ls` / `show <group> [--recursive]` | Group navigator / inspector with direct and total counts. |
| `canvas group add <group> <items...> [--place] [--cell r,c]` | Add to group… / Move to group… with placement preview. |
| `canvas group remove <items...> [--to-root]` | Remove from group; no deletion. |
| `set <ink> --rm-prop annotates --rm-prop region` | Detach from annotated item, preserving group membership and geometry. |
| `canvas group ungroup <groups...>` | Ungroup; preserve members. |
| `mv <group> x y` / `mv <group> --by dx,dy` | Drag or nudge group with all descendants. |
| `mv <item> --in <group> [--cell r,c]` | Existing spelling for atomic reparent-and-place; includes required frame growth. |
| `set <group> --size WxH` | Existing resize spelling; same resize-with-contents operation, with northwest fixed by default. |
| `canvas group resize <group> WxH [--anchor nw\|ne\|sw\|se]` | Resize with contents; anchor is the fixed corner. |
| `canvas group frame <group> --fit` or `--size WxH` | Fit frame to contents / Resize frame only. |
| `fit <group>` / `fit <group> --size WxH` | Fit the frame to its members / request a frame-only size. Reject a frame too small to enclose its members and label space. Browser Shift+F and Fit dispatch here for groups; ordinary items retain their current content-fit behavior. |
| `canvas group layout <group> ...` | Header, brief and grid gutter settings. |
| `canvas group grid <group> RxC [--rows names] [--cols names]` | Grid settings; existing area grid behavior gains protected gutters. |
| `tidy --in <group>` / `align <items...> --to <edge>` | Tidy contents / align selected roots; nested groups move as units. Preserve existing command syntax. |
| `distribute <items...> --axis h\|v` | Distribute selected roots, moving every selected group as a unit. |
| `ls --in <group> [--recursive]` | Select contents / inspect membership; direct children by default. |
| `context --in <group> [--include-excluded]` | Inspect the exact group context manifest. |
| `say ... --in <group>` and `comment` attachment equivalent | Send a message/agent request with group context using existing addressing semantics. |
| `ask ... --in <group>` | Ask the person a question about the group and mark the agent waiting, preserving the existing `/ask` behavior. |
| Existing add/text/copy/import verbs with `--in <group>` | Create, paste or drop into the active group, with explicit membership. |
| `canvas group migrate [--dry-run]` | Preview/apply the versioned conversion of a legacy canvas; report the undo boundary. |

Offer JSON results for all of these; structural/layout commands also offer
`--dry-run` with affected roots, parent changes, final boxes and constraints.
`show --json` reports IDs, direct members, descendant counts, parent, outer and
content boxes, and layout settings. Reading context does not change selection.
`session select` already means a quoted text selection; do not repurpose it.

Expose the same semantics in `@isocan/api`, make the CLI consume them, and
extend the existing read-only MCP tools with membership and scoped context.
This project does not silently turn MCP into a write surface. Teach every
new verb in the CLI agent guide's quick reference and update the surface
test, help, README and synthetic examples in the same phase as its release.

## UI entry points, including the menus

| Where | Actions and behavior |
| --- | --- |
| Multi-selection menu | **Group selection**; **Add to group…**; **Remove from group** for members. Mixed selections name the affected count. |
| Group title/border menu | **Enter group**, **Select contents**, **Rename**, **Edit brief**, **Add items…**, **Tidy contents**, **Fit frame to contents**, **Resize frame only**, **Grid / Layout…**, **Use as context**, **Ungroup**. Keep applicable tint, copy, duplicate, link and export actions. |
| Member menu | **Select parent group**, **Move to group…**, **Remove from group**, plus normal item actions. A nested group also gets the group actions. |
| Attached ink menu | **Detach from annotated item**, before an independent membership change; preserve the mark and its geometry. |
| Blank canvas / blank group content | **New group**; **Paste here**. Inside an entered group, new items acquire that parent and respect its content box. |
| Inspector / navigator | Editable name/brief/layout; parent breadcrumb, direct/total counts, member list, fit/tidy controls and context preview. |
| Toolbar / Shelf / command palette | Discoverable Group selection, Ungroup, Enter group, Select parent, Add to group and Fit frame commands. |
| Keyboard | Register Cmd/Ctrl+G and Cmd/Ctrl+Shift+G if free; Enter enters, Escape leaves. Scope shortcuts away from text editors/iframes, and use the shortcut registry/help rather than component-local bindings. |

Group backgrounds remain behind content, and their titles, borders and resize
handles remain reachable. Keep creation tools working in empty interiors;
an invisible full-frame hit target must not swallow clicks on children.
Nested paint order must keep a child's label above its parent's background.
At small zoom levels, selection/drop targets remain usable without growing
the actual layout gutters. Menus work by keyboard and touch, show focused and
hovered rows on the existing opaque menu surface, and stay within the window.
Read-only users can navigate and inspect context; editing entries follow the
existing menu capability filter. Disabled actions explain a current invalid
selection instead of silently doing nothing.

**Delete must say what it deletes.** Selecting a group and pressing Delete
moves the group and its full subtree to trash in one undoable act. Its menu
says **Delete group and N items**. Ungroup is the separate, non-destructive
way to discard the frame. Deleting one child affects only that child's
subtree and attached annotations. Restoring a group restores its captured
subtree; restoring a child whose parent is still trashed places it at the
nearest live ancestor/root and reports that choice. Undoing Ungroup restores
the original structure if its structural preconditions still hold.

**Copy and duplicate** include the selected subtree, remap all internal
container IDs and attachment references, preserve external reference policy,
and give the copied root its destination parent. Copying only one member does
not carry its source group along. Cross-canvas paste never keeps a parent ID
from the source canvas. Place the copied root as a unit and mark the resolved
child coordinates as intentional: per-item collision searches must not
scatter overlaps already present within the group. Native backup export/import
and deck extraction must use explicit membership; JSON Canvas remains an
export-only projection and reports any hierarchy it cannot retain.

Persist a deletion-cohort ID on each affected trash entry, derived from the
deleting operation ID, with the deleted roots and captured membership
available to subtree restore. `canvas.groupCohorts` stores that immutable
deletion roster once, including original parents and attachment targets;
it is history, not a second source of live membership. Both storage backends,
snapshots and native export/adoption preserve it, including after a member
has independently left trash. Restoring a group selects only entries still
in that same cohort. A child independently restored, moved elsewhere or
deleted again under a newer cohort is left alone; report skipped IDs rather
than stealing it back. Restore required ancestor frames first in one atomic
change. A direct restore may report such omissions, while exact structural
Undo refuses a changed cohort under the conflict rule above. Test both paths.

## Converting existing areas without losing their history

Introduce a versioned, explicit canvas migration once every writer and
replica understands groups. Upgrade readers/reducers first; enable group
writes only after capability/version negotiation can refuse an old client
cleanly. Keep old log reduction unchanged, including old geometric-area ops.
Capability negotiation must cover already-connected browsers and replicas,
snapshot adoption and log-tail resumption, not just new HTTP writes. A client
which cannot reduce groups must stop before group state/ops reach it and
show an upgrade requirement. Reconcile/reject queued legacy writes explicitly
at cutover; do not let a new meaning silently attach to an old queued request.

The migration is one recorded, idempotent change per canvas, with a preview:

1. Read all live and trashed legacy areas/items at one authoritative revision.
   For each live ordinary non-annotation item, choose the smallest live
   containing area's rectangle
   using the existing centre rule; break equal-size ties by stable ID.
   Overlaps resolve to one owner, and the preview names ambiguous cases.
2. Keep legacy areas as root groups; do not infer nesting merely because two
   rectangles overlap. Convert their kind, preserve their IDs and all card,
   grid, tint, sprint/board properties, versions and discussion, and write
   typed membership. Uncontained items remain root items.
   Assign attached ink after its live target and use the target's parent,
   ignoring the ink's centre. Preserve dangling annotation links as dangling,
   exclude them from target-driven closure, and report them for repair; do
   not silently attach them to a nearby item. A later target restore must
   reconcile its live marks atomically before the live invariant applies.
3. Leave item positions unchanged. Expand frames upward/leftward as needed
   for the header/footprints. For a legacy grid whose labels overlap cells,
   the preview shows a label-gutter repair; apply that geometric repair in
   the same recorded conversion rather than hiding it in render-time CSS.
4. Store the migration version and exact prior values for undo. Replaying
   or retrying the conversion does not assign members a second time. Undo
   leaves the canvas explicitly in legacy mode; it is not auto-migrated again
   on the next read.

Convert trashed area records to group frames too, preserving their trash
state and exact originals in the inverse. Legacy trash has no reliable
deletion cohort or historical membership: mark converted trashed groups as
frame-only restores and restore other legacy trashed items at the canvas
root. Do not guess a historical subtree from today's rectangles. When a
legacy trashed annotation and its target both become live, reconcile their
parents by the target rule above.

The conversion records an **undo boundary** at its log sequence for every
actor. Ordinary Undo/Redo never crosses that boundary into pre-conversion
operations while group mode is active; return a non-consuming
`migration-boundary` result instead of replaying an old inverse that can
resurrect `kind=area` or split membership. Historical timeline/replay remains
available and unchanged. Undoing the migration itself is allowed only when
its exact structural preconditions hold and no later group-dependent state
would be stranded; otherwise explain which later work must be undone first.
In particular, post-boundary group-dependent **live, trash and redo state**
must all be absent: creating a group and undoing that creation still leaves
a group in trash and a redo candidate. Refuse migration undo in that case
and name the remaining dependencies; undoing visible changes alone is not
necessarily enough. Never purge trash or discard history merely to make
rollback pass. Its inverse clears the active boundary and restores the
previous mode only when these checks pass.
The preview explains this history boundary before conversion.

After conversion, never fall back to geometric membership for an item with
no `containerId`: that would immediately undo the meaning of Remove.
Legacy areas remain readable before conversion, and group mutations on a
legacy canvas offer the migration explicitly rather than mixing models.
New canvases start in group mode.
New writes in group mode also refuse creating a `kind=area` item through raw
add, metadata, restore or import paths; aliases submit group intents instead.

Audit every area consumer: sprint boards/hand-in, storyboard and deck export,
memory/context sheets, grid cell placement, Google Doc insertion/listing,
module commands, `add/text/mv/ls/tidy --in`, canvas thumbnails/navigation,
generic copying, JSON Canvas/native export and saved snapshots. Historical
journeys remain historical; active guide/help surfaces explain the new model.
Sharing groups and undo-group IDs require regression coverage through this
rename because they already own the word “group.”

## The implementation walk

| Phase | Deliverable | Gate before moving on |
| --- | --- | --- |
| **1. Shared model and operations** | Typed membership, core traversal/content-box/transform helpers, atomic validation and inversion, operation plumbing, API types, protocol capability. Keep writes gated. | Reducer tests prove a forest and one transform per descendant. Real undo/redo endpoints prove non-discarding atomic conflict refusal and restore-based creation redo. Main's existing move/resize replay remains identical. |
| **2. Membership on both surfaces** | Create/wrap/add/remove/ungroup in CLI and browser, menus, shortcuts, active scope, navigator and membership-aware selection. | A person creates and detaches; a CLI agent reads and changes the same relation; reload and undo preserve it. No phase ships a browser-only intent. |
| **3. Geometry and layout** | Move/resize previews and commit, frame-only operations, protected headers/gutters, all insertion paths, tidy/align, annotation and nested-group behavior. | The same requested operation gives identical geometry from CLI and browser. Real resize/drop/cancel interactions pass the browser acceptance below. |
| **4. Context and lifecycle** | Composer expansion/preview, versioned request context, CLI/API/MCP reads, pins/exclusions, copy/paste/delete/trash/export, sprint and module consumers. | A group request's preview matches its agent payload; copy/restore never creates dangling parents; existing consumers all have a disposition. |
| **5. Migration and release** | Migration preview/apply/undo, old-client refusal, area aliases, README/agent guide/examples, changelog and rollout. Enable by default only after the previous gates. | Migrate a synthetic legacy canvas with overlapping areas, a grid and annotations; replay, reload, undo, and use it through both clients. |

Keep the initial release focused on explicit free-layout groups, nesting,
native frame resizing, deliberate tidy and grid guides. Continuous auto-layout,
collapsed groups, clipping masks, proportional typography scaling and
cross-canvas membership are later work. None is a prerequisite for the five
behaviors that motivated this plan.

### Implementation map

| Home | Work to put there |
| --- | --- |
| `packages/core/src/model.ts`, `ops.ts`, `reducer.ts`, `invert.ts` | Typed parent relation, structural operations, validation and exact inverses. New canvas-group helpers get a distinct name from identity/undo groups. |
| `packages/core/src/area.ts`, `placement.ts`, `format.ts`, `duplicate.ts`, `annotation.ts` | Replace live geometric membership; share content boxes, transform closures, placement and copied-reference remapping. Preserve old-area behavior for historical replay/migration. |
| `packages/core/src/context.ts`, `contextmark.ts`, `model.ts`, `ops.ts` | Shared context expansion, exclusions, group pins and typed request provenance. |
| `packages/server/src/engine.ts` and operation/GC consumers | Authoritative resolution, conflict checks, atomic commits, protocol gating and retained context versions. |
| `packages/api/src/`, `packages/cli/src/main.ts`, `packages/cli/src/agent-guide.md`, `packages/mcp/src/server.ts` | Semantic client methods, canonical commands and compatibility aliases, complete help, scoped read tools. |
| `packages/web/src/components/ItemView.tsx`, `MainThreadPanel.tsx`, `stores/uiStore.ts`, `lib/menuentries.tsx`, `lib/itemactions.ts` | Group interaction/preview, scoped selection, context chips, menus and lifecycle actions. Use shared helpers rather than additional membership calculations. |
| `packages/core/src/sprint.ts`, `memory.ts`, `jsoncanvas.ts`, `deckexport.ts`, and their client callers | Explicit membership for existing sheets, boards, export and context consumers. |

## Verification and acceptance

Use synthetic fixtures only. Pure logic tests import production helpers;
source-text assertions do not stand in for an interaction test.

| Layer | Cases that matter |
| --- | --- |
| Core | Self/cycle/cross-canvas/dangling-parent refusal; nested closures; group-plus-child deduplication; overlapping non-members; detach in place; reparenting and all four enclosing edges; old/new content-box transform with every anchor; asymmetric x/y scaling; minimums; zero/invalid sizes; title/brief/grid gutters; nested and external annotations. |
| Reducer/server | One log entry and inverse per structural act; no partial update on an invalid child; replay and retry; stale geometry vs unrelated text edits; move/delete/reparent races; complete structural undo refusal on conflict; correct touch sets, GC retention and permission checks. |
| CLI/API | Create → add → move → resize → detach → context → ungroup round trip; JSON and dry-run agree with committed results; ambiguous names fail clearly; ordinary low-level move/resize cannot bypass group semantics; legacy area aliases and sharing-group commands both retain their meaning. |
| Context | Roots and descendants deduplicate; nested briefs/current versions are represented; excluded content is visible and overridable; requests retain send-time membership/versions after later edits; unavailable/large content produces an honest manifest and retrieval path. |
| Lifecycle/migration | Copy/paste internal ID remapping; child-only copy; group delete/restore; missing-parent restore; migration ties, boundary centres, legacy grid repair, idempotence and undo; old-log replay; old-client rejection; sprint/memory/grid/export consumers. |
| Real browser | Wrap via menu and shortcut; title remains above top-left item; drag carries descendants; corner resize previews every child; Escape/pointer-cancel restores the start; one undo restores geometry; enter/select/remove/add/drop; context preview matches the sent request; nested hit targets, touch and keyboard menus, low/high zoom, light/dark themes and long labels. |

Walk the browser against a real daemon and verify its committed state with
the CLI; repeat representative CLI operations while the browser is watching.
Measure a synthetic 1,000-item nested canvas: selection/context listing must
not mount 1,000 previews or refetch content every pointer frame; movement
should update geometry without rereading blobs, and idle must remain idle.

The following are required phase gates, not optional extra coverage:

1. **Phase 1 — actual undo/redo endpoints.** Create a group after an earlier
   unrelated action, change its membership from another actor, then undo the
   first actor's grouping. Assert the structural conflict appends zero log
   entries, preserves the same undo candidate and leaves the earlier action
   untouched. Exercise redo conflicts and creation → undo → redo with original
   IDs, versions and authorship. Keep ordinary-item inverse repair tests green.
2. **Phase 3 — transform ownership and stale dependencies.** Resize an
   asymmetric nested group with child-attached and frame-attached overhanging
   ink, in both item insertion orders, and compare exact boxes. Separately
   race the gesture against a new member, gutter edit, attachment edit and
   unrelated text edit; the first three refuse atomically, the last succeeds.
3. **Phase 3 — real browser commit pipeline.** Run `npm run build` first when
   testing through the daemon, which serves `packages/web/dist`. Exercise
   actual hit-tested pointer events and cancellation; deliver HTTP receipt
   and WebSocket echo in both orders. A refusal clears the preview/queued
   operation and leaves no descendant drift or duplicate transform. Zoom
   changes no committed geometry; persistent labels remain in their bands.
4. **Phase 4 — context beyond the undo horizon.** Send group context; replace
   and remove those versions, delete/empty the items, advance GC beyond their
   originating operations, restart, and retrieve the request's original
   source and distinct visual face. Native-export/import into a second daemon
   and retrieve them again. Each saved content reference must carry the
   metadata required by both GC and backup discovery, not just a bare hash.
5. **Phase 4 — overlap and trash cohorts.** Copy intentionally overlapping
   ordinary cards inside a nested group into another group and another canvas;
   preserve offsets/overlap and remap IDs before the atomic apply. Delete a
   group, restore one child elsewhere, then restore the group; the child is
   not moved or stolen back. Repeat with that child deleted a second time.
6. **Phase 5 — already-connected old clients.** Cut over with an old browser
   and home replica already connected, including queued legacy writes.
   Exercise snapshot adoption and tail resumption; unsupported clients stop
   before applying group state. A fresh-request-only rejection test is
   insufficient; existing field-spelling checks are not feature negotiation.
7. **Phase 5 — persistent migration round trip.** Use two real daemons and
   native export/import before conversion, after conversion and after its
   undo. Compare IDs, live/trash membership, geometry, versions, comments and
   mode; include restart and snapshot-plus-tail replay. Include legacy trash,
   dangling annotations and a second actor's pre-boundary undo/redo attempt.
   Also run migrate → create group → undo creation → undo migration: the last
   step refuses without changing mode/history while the new trash/redo state
   still depends on groups, and names those dependencies.

Coordinate each phase as a bounded builder assignment followed by an
independent reviewer who checks the changed code and observes/runs the gate.
Give concurrent builders disjoint file ownership; the coordinator owns shared
operation/model integration. A builder's summary is evidence to inspect, not
the release decision. Record findings, dispositions and observed checks in
[`verification.md`](verification.md); rerun affected gates after fixes and
advance only after remaining findings are explicitly resolved or deferred
with a reason. The review of this plan is the first entry there.

Run `npm test` and `npm run typecheck`, including the CLI guide/surface guard.
Report actual browser actions and observed results separately from unit
coverage. The feature completion report must name all six repo obligations:
operation vocabulary, CLI verbs, agent guide, shared core helpers, README and
tests. This planning change touches documentation only; it makes no claim
that group behavior or browser acceptance has been implemented.

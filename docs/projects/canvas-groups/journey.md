---
status: designed
since: 2026-09-12
see: sprint, context, design-competition
note: canvas groups are designed; phase 1 builds the shared membership and operation foundation before both client surfaces, context and migration
---
# Canvas groups — the experience

The debt is visible in a simple gesture: a named area looks like it owns the
cards on it, but moving it from the CLI leaves them behind. The group owns
its membership, and the same intent has the same result from either surface.
[`design.md`](design.md) gives the mechanisms; [`phases.md`](phases.md) names
the work and proof. All acceptance canvases and artifacts below are synthetic.

## Journey 1 — Put these together

A person selects three Acme cards and chooses Group selection. A named frame
appears around their arrangement, with the title and brief above the first
card. The cards keep their positions. The inspector and CLI name the same
three members. Another card overlapping the rectangle is not a member.

The person enters the group, selects a card and removes it from the group.
It stays where it was. Moving the group later leaves it there. They add the
card back using the menu, then move another card in using CLI `mv --in`.
Membership, required frame changes and placement arrive as one change.
Undo restores the previous relationship. Nested groups keep their identity.

## Journey 2 — Move and resize the work

Dragging the title moves the group, all its descendants and their attached
ink once. Keyboard nudges and CLI `mv` do the same. Selecting a group and a
child does not double the child's movement. Align, distribute and tidy treat
a target and its attached marks as one unit.

The person drags a corner. Every child frame changes position and size in
the preview; nested groups reserve their own labels. Text reflows in its
new frame. Ink preserves its overhang and stays with its target. Escape or
pointer cancellation changes nothing. One undo reverses the entire resize,
including the origin of a northwest drag. `set --size` yields the same boxes.

Fit frame to contents adjusts the frame around the arrangement without
scaling its children. Adding a fourth card makes room without shrinking the
first three. Title/brief and grid labels have their own space at every
committed placement. Zoom changes no saved geometry.

## Journey 3 — Work inside, and leave deliberately

At the canvas root, clicking or marquee-selecting a group's contents selects
the group as a unit. Enter opens its scope, the breadcrumb shows the parent,
and selection then reaches direct children. Enter on an ordinary artifact
retains its existing full-screen meaning. Escape first dismisses a local
editor/menu or cancels a gesture, then moves up the group scope.

The person can create text, drop a file or paste into that scope. A highlighted
drop target names the group before release. The context menu provides Add,
Remove, Select parent, Select contents, Tidy, Fit, Rename and Ungroup, with
keyboard access. Detaching a piece of annotated ink first clears its
attachment deliberately, in one undoable act, before independent membership
changes are allowed.

## Journey 4 — Review everything in this group

Selecting a group shows one composer chip with its title and item count.
Opening the chip reveals the complete hierarchy and content manifest,
including the group's own brief and attached annotations. A child selected
again is included once. Exclusions are visible and have an explicit override.

Sending a message records the selected roots, expanded IDs and content
versions at one revision. A collaborator subsequently moves a member out
and edits another. The old message still means the same set of versions.
CLI/API context reads expose that same manifest without driving a pointer;
MCP remains read-only. Large groups expose the complete manifest and paged
content rather than silently truncating the scope. Retained requests can
still retrieve their source and distinct visual bytes after GC and restart.

## Journey 5 — Keep the contents, or delete them

Ungroup removes the frame and its own attached marks, promoting children and
their marks without moving them. Delete instead explicitly names the group
and the number of items it sends to trash. Both have exact undo when their
structural preconditions hold. Restoring an ancestor does not steal a child
which somebody restored and moved elsewhere, or deleted again later.

Copying a group preserves nested membership, relative positions and deliberate
overlaps. Cross-canvas paste remaps all internal IDs. A member copied alone
does not drag along its source frame. Native backup round-trips the complete
record; JSON Canvas export names what its projection cannot preserve.

## Journey 6 — Two clients, one committed act

A person starts resizing while an agent edits unrelated text. The resize
succeeds. If the agent instead changes membership, geometry, attachments or
the reserved header, the stale transform refuses as a whole and its preview
clears. HTTP receipt and WebSocket echo can arrive in either order without
applying the transform twice.

A conflicting structural Undo returns a conflict and preserves its candidate.
It does not skip that action and undo something older. Redo of group creation
restores original IDs, content and authorship from trash. Retry with the same
operation ID produces one committed effect. Existing ordinary-item inverse
repair keeps its previous behavior.

## Journey 7 — Bring an existing canvas forward

A legacy synthetic canvas contains overlapping areas, a labelled grid,
overhanging annotations and trash. The migration preview shows one explicit
owner for each live item, required label repairs, ambiguous geometric cases,
and the history boundary. Conversion preserves IDs, versions, discussion,
board properties and ordinary item positions wherever no declared repair
is needed. Legacy trash is not assigned an invented historical subtree.

Already-connected incompatible browsers and replicas are stopped before
unsupported group state reaches them. Queued legacy writes have an explicit
refusal/reconciliation path. Old timeline replay is unchanged. New writes
cannot recreate legacy area semantics after conversion. Migration undo is
available only when no later group-dependent live, trash or redo state would
be stranded. Native export/import, snapshot-plus-tail replay and restart
preserve the chosen mode and relationships. Sharing groups of people and
undo-group labels keep their meanings.

## What the scenes force

One explicit parent per item, a validated forest, one atomic operation per
structural gesture, shared geometry/context helpers, protected world-space
label bands, discoverable and equivalent CLI/UI acts, precise lifecycle and
compatibility rules, and proofs that observe the real writer and browser.
No cloud provisioning or paid plan is required for these local proofs.

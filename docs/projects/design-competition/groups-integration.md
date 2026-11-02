# Competition on explicit canvas groups

PR #264 was built before canvas-groups phases 1–5 landed. Its arena uses
geometric areas, while a new canvas now uses explicit membership. This
integration closes that mismatch without introducing another operation type.
The original journey remains the acceptance suite; the historical `area`
spelling in that journey names a lane, not a second membership algorithm.

## Membership and scope

On a group-mode canvas, the Brief and each lane are sibling canvas groups.
The target reference belongs to Brief; each fighter card, design system and
reference shelf belongs to its lane. Generated entries carry membership at
insertion. Moving a frame cannot silently recruit an overlapping rival item.

Design-system selection, `wait --in`, the curtain and competition reads use
shared core membership. A nested item's lane is found through its explicit
ancestors. Geometric membership remains only for a legacy-mode canvas.
Canvas-wide design selection ignores lane-scoped systems, preserving the
canvas's own system even when another system is newer.

## One arena, one accepted operation

All required blobs are prepared before submission. The arena is a bounded
forest of fresh items submitted through the existing group copy resolver,
which already validates complete forests and resolves them to a creation
intent. `sourceCanvasId` names the current canvas for the resolver's external
reference policy; no fictitious source canvas or original item is invented.
The writer stamps the records and keeps explicit relationships in one change.

The creation must be one operation and one undo/redo, including its Brief,
lanes and contents. A malformed forest or unavailable required content must
leave the log tip unchanged. A series of individual writes sharing a gesture
label is insufficient. If the existing resolver cannot uphold these bounds,
change this mechanism before introducing a replacement operation.

## What integration retains

Retain the PR's existing module assets, contribution points, dialogs,
templates, casting, voting and already-built take/remix/rematch/standings
verbs. Template enrolment still goes through the rc owner's gate. Hosted
casting uses a person's parked rc; it does not create hosted compute.
Blind mode remains refused until its private desks are implemented.

## Verification and remaining human proof

Prove group and legacy arenas, overlapping unrelated items, nested members,
scoped systems, group-aware waiting/curtain behavior, complete undo/redo and
unchanged state on refusal. Then play the terminal and browser exhibition
flow and the module removal/reinstallation proof on a disposable image.

The three-person phase-0 distinctiveness measurement and real-fighter token
bill remain unmeasured until actually run. Hosted phase 5.5 still requires a
dev walk followed by a production walk. Neither a synthetic fighter nor a
local daemon closes those acceptances.

# Anatomy: reviewed semantic updates

Phase 9, planned 12 September 2026 before implementation.

The recovery work keeps a damaged file from hiding the graph. This phase makes
healthy graphs easier to change deliberately: patch a concept, choose a decision
option, edit a relationship, or review a replacement graph before applying it.

## 1. One native atomic change

Add a bounded `items.change` operation containing only non-nested item content,
metadata, creation, deletion and restoration operations. The reducer validates
preconditions against the original state, computes the whole next state, and
publishes one result. The daemon persists one entry and one inverse. An error
in the last change must leave the first change unapplied. This is distinct from
existing undo groups, which continue to describe several independent entries.

Preconditions cover item identity, live/trash/absent location, current version,
title and properties. An optional property/MIME scope checks graph membership,
including additions since review. Moving an item or commenting must not make a
review stale. Internal inverse operations remain forbidden to clients, including
inside the new operation. Placement, replay, undo/redo, blob retention, filtered
wait, presence and history must understand the new vocabulary.

Gate: reducer failure isolation, stale guards and membership, inverse/redo,
daemon persistence and observer delivery, replay and internal-op refusal.

## 2. Semantic edits on both surfaces

Share concept patching and decision resolution helpers between CLI and browser.
Accept native item IDs and portable concept IDs. Preserve fields a patch does
not name. Relationship upsert/removal uses one guarded native change, including
a relationship whose source changes. Return explicit item/concept/edge receipts.

Gate: unknown references and invalid graphs fail before writes; a moved edge
never exists at both sources; edits preserve evidence and unrelated fields;
resolution and relationship edits have one undo.

## 3. Review and apply a concept graph

Produce a portable review plan from the live graph and a proposed graph or saved
checkpoint. Show added, changed, removed and restored concepts and relationships.
The plan captures its exact base and desired graph; applying it must reject a
changed base and require a fresh review. Both the CLI and browser use the same
planner and application helper.

This action changes concepts and their relationships only. It preserves the
overview, attached sources, native positions and discussions. Match portable IDs
to live native items first, then unambiguous matching items in trash, so restoring
a checkpoint reconnects the original item's comments and version history. A
matching ambiguity is an error, never permission to pick an arbitrary item.

Gate: a preview accurately predicts the resulting graph; unchanged concepts do
not gain versions; trash identity survives; stale review applies nothing;
undo/redo restores the whole graph; unrelated canvas work remains intact.

## 4. Integration and verification

Document commands and API version requirements. Run focused checks after each
step, then the complete test suite, typecheck and production build. Drive the
browser through decision resolution, relationship editing and reviewed checkpoint
restore on synthetic data. Record the actual results in verification and the
daily changelog. Collaborator studies remain a separate phase requiring people;
automated checks must not be described as recruited-user validation.


## Acceptance, 12 September 2026

Implemented on `anatomy` after pushing the previous recovery/request phase.
All four steps above are complete. Mock promotion also uses the bounded atomic
operation; hierarchy changes guard the graph against concurrent parent edits.
CLI mutation reads now reject diagnostic subsets, including broken native
relationship metadata. Existing complete-file drafts still use `item.edit`.

- Core tests prove failure isolation, content/trash/absence guards, membership,
  reverse-order inverses, redo, geometry/comment independence and filtered wait.
- Real daemon tests prove one emitted event, one durable entry, concrete
  sequential placements, replay/restart, original version authorship, retained
  blob reachability and refusal of nested/internal or stale operations.
- Module tests prove explicit patches preserve omitted evidence, options and
  assessments; invalid input writes nothing; moving a relationship removes its
  old source copy; graph reviews preserve unchanged versions and unrelated work;
  trash identity/comments/position survive; stale submission changes nothing;
  ambiguous trash and tampered/cross-canvas plans are refused.
- The real CLI journey covers patch, resolve, relationship removal, checkpoint
  diff/apply, native-ID restoration, undo/redo and a stale proposal.
- Real browser checks on the disposable synthetic canvas cover choosing an
  option, evidence/assessment preservation, repeated relationship saves, removal
  and Cmd-Z, checkpoint field comparisons, stale review refusal followed by an
  explicit refresh, and restoring a concept labelled “Restore from trash”.
  The comparison shows changed fields with readable Before/After values.
  Shift-Tab from Close wraps to Apply inside the dialog. The final synthetic
  graph was restored to its baseline. No real repository analysis was modified.

Final `npm test`: **4,206 passed, 70 skipped** (425 passing files, five skipped).
`npm run typecheck` and `npm run build` passed. The first full run exposed
tracked-file export accounting and a placement source assertion, fixed before
this final run; no metric ceiling was raised. The entry bundle is approximately
**667.5 KB**, about 2.5 KB above the prior phase. The reducer/validation vocabulary
accounts for the entry change; review/semantic UI remains lazy. Existing bundle
size debt remains below the hard jump guard.

The browser's viewport override reported success but its measured viewport
remained 1280 × 720, including in a fresh tab. It was reset, and no new narrow
viewport verification is claimed for this phase. Earlier pane checks are in the
fluid exploration record. No recruited-user study or hosted deployment occurred.

Both surfaces audit: new native operation/inverse; matching module CLI verbs;
module and base agent guides updated; guards/atomicity in core and semantic
planning in shared module helpers; README/API docs updated; reducer, daemon,
CLI and real-browser verification above. Pointer gestures remain local UI facts.

Fresh imports and independent analysis-request/Chat writes retain their existing
undo-group behavior. `items.change` does not promise transactions across projects
or external workers. The immediate CLI checkpoint restore remains available;
`checkpoint --diff --out` then `apply` is the review-first path. Settling a decision
preserves assessments and does not claim they are current or newly reviewed.

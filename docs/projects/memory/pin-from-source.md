# Pin from a source — make one deliberate local copy

This discharges the original `context pin --from` promise. Inheritance keeps
following a source; this act takes one of its current context pieces and makes
an editable, pinned copy here. The source is unchanged. The copy keeps where
it came from and does not follow later edits, unlinking or source deletion.
Memory phase 6 builds this contract after the inherited recap acceptance.

## The choice on both surfaces

An editor opens an ordinary inherited layer in Context and chooses **Copy a
piece here**. The picker names the source and its eligible current design and
pin contributions; the editor selects a piece and presses **Copy and pin**.
It says that this copies the current version, including a group's contents,
and future source edits will not update it. The resulting local Context entry
shows its source beside the copied piece. A group choice also says how many
items will be copied. The controls work on desktop and a 390px phone.

The same act is `isocan context pin <item> --from <canvas> [--canvas <target>]`.
`--from` resolves only among the destination's visible ordinary inheritance
links, by exact canvas/card ID or unambiguous title/ID prefix. The item is an
exact ID or unambiguous title/ID prefix among that source's eligible pieces.
Refusals name the candidates or why the source/piece is unavailable. Without
`--from`, the existing local pin command retains its meaning. The existing
Context summary on CLI and MCP carries the copied piece's provenance too;
this phase adds no dedicated MCP mutation tool.

## A bounded source and destination

The destination must be an editable canvas with native groups enabled; an old
legacy destination receives the existing explicit conversion guidance before
source content or uploads. This feature does not silently migrate a canvas.
The source must be an ordinary readable canvas at the same authoritative home,
reachable through a currently visible, non-excluded `memory=inherit` card.
Another home's address, an excluded card/ancestor, an unlinked address, a
personal source or an unknown classification refuses before source content.
Relabelling a personal card as inherited cannot make it eligible.

Choices are the current design and ambient pinned contributions, with the
existing ancestor exclusion rule. They are not the source's full item list.
Selecting a group uses the existing explicit membership and attached-mark
closure. A closure containing an excluded item, a missing current version or
a canvas-link item refuses as a whole, with a reason. Canvas links are not
copied through this act: their saved preview and inheritance/personal
semantics require a separate choice. No geometric neighbors, comments, past
versions, raw history or transitive linked canvases are included.

## One existing copy act

Reuse `groupCopySource` and `groupCopyAction`, including relationship remapping,
current source/visual faces and writer placement. Share the byte-transfer and
hash-verification path with the existing `CanvasGroups.copyFrom`; put the
portable orchestration in an API leaf with injected transport, not a second
copy algorithm in the browser. The clients keep their own transport adapters.

The chosen source snapshot freezes the current versions. Every required face
is read and verified, then uploaded before one `group.change` copy is submitted.
The copied root receives the existing `context=pinned` property in that same
act. Default placement uses the existing copy resolver on clear destination
ground. One undo removes the complete copy and its pin; redo restores it.
Missing/mismatched bytes, cancellation or a refused write leaves no visible
partial copy. Already uploaded unreferenced blobs use existing GC behavior.

Copying a design piece must not make it the destination's governing design.
Strip the `design-system` and legacy `house-style` role from every copied
item, including descendants, while retaining the content as a pin. Preserve
the existing copy rules for files, lineage, annotations and group membership.
No new reducer path or permission-bearing operation is introduced.

Each copied item records a `contextSource` JSON property containing the
original authoritative home, canvas ID/title, item ID/title and current
version ID. It contains no badge, credential or private data. This is durable
copy provenance, never permission or a live reference to fetch. Core validates
and formats it for local Context, CLI and MCP; malformed provenance is ignored
as metadata. The immediate selected source is recorded when copying a copy.

## Authority and change while the picker is open

Source reads use the existing immutable automatic-exclusion policy with
expected home and cancellation on the actual snapshot and every blob request,
including badge recovery and replica forwarding. A preflight classification
is not a replacement for these checks. Direct caller restrictions, when
present, retain their actor/capability ceiling. Private authority is never
borrowed from the badge's other claimed identities.

On Copy, reload the destination and source rather than trusting the picker's
list. Validate the concrete inheritance edge, selected contribution and current
version. After byte transfer, recheck destination editability and the same
visible edge before submitting. A deleted/excluded link or cancelled/changed
browser identity refuses the pending action. The writer remains authoritative
for the accepted destination operation and placement. This is the existing
copy model, not a new cross-canvas transaction: later source changes do not
revoke bytes already deliberately copied with valid access.

## Proof

Actual CLI and browser copy the same synthetic pin and a group with a nested
piece and a distinct visual face. Verify exact source bytes, provenance,
current-version-only copies, membership/annotations, one accepted operation,
one undo/redo, local editing and unchanged source state/history. Edit and
remove the source afterward and unlink the inheritance card: the local copy
and its saved bytes remain. Copy a design piece without changing the governing
local design. Desktop and phone show the source beside the copied piece.

Failing cases include ambiguous selection, legacy/read-only destinations,
unlinked/excluded/foreign sources, copied personal cards, excluded descendants,
canvas-link descendants, missing/corrupt source or visual bytes, revoked source
access, link removal during a held transfer and browser identity change.
Refusals leave destination operations and visible items unchanged; private
source refusals perform zero snapshot/blob reads. Actual authoritative-home
forwarding retains exclusion and cancellation. Existing group-copy behavior,
ordinary inheritance and personal Context continue to pass.

Run full tests with deep, Firestore and bundle checks required, workspace
typecheck, build, real CLI and browser acceptance, all standard browser
journeys and the personal/recap regressions.
No login, paid service, cloud resource or real personal data is needed.

**The entry ceiling, corrected 18 Sep 2026.** This paragraph said "keep the
734,200-byte entry ceiling", and by the time the phase was built that number
was eleven and a half kilobytes stale — `scripts/bundle-ceiling.mjs` stood at
745,900, raised twice by other work since this was written, with a clean entry
of 745,811 and **89 bytes of margin**. So the instruction could not be run as
written: any eager byte at all exceeded it, and this phase has an eager byte by
its own requirement two paragraphs up, that *local Context* show a copied
piece's provenance. `contextPieces` runs on every canvas, so the reader has to
be parseable in first paint.

The ceiling is therefore **747,000**, and what this paragraph asks for instead
is the thing it was always trying to protect: that the eager cost be the READER
ONLY, measured rather than assumed. It is 1,080 bytes — `parseContextSource`,
`copiedContextItems` and the row they produce. The picker, the eligibility
rules, the copy act and its transport are all behind `import()` and cost a
first visit nothing. GOAL 640,000 and JUMP 20,000 are unchanged.

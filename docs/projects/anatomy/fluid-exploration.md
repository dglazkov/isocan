# Fluid exploration on native items

Implementation plan, 12 September 2026. Builds on the usability review and the
original Anatomy renderer's focus-dependent card sizes, moving neighborhoods
and connected motion. Work stays on `anatomy`.

## 1. Preserve edits

Unify form/JSON drafts. Bind whole-body CLI edits to the version originally
read, and apply version plus metadata together with an authoritative
precondition. Independent concepts must not conflict. Test stale input,
intervening writes, inverse/replay and retained geometry before proceeding.

## 2. Native presentation capability

Add a workspace-scoped, temporary presentation of native item bounds and
detail. The host owns animation and resolved geometry. Native item selection,
edges, comment anchors and agent indicators consume that same geometry.
Exploring creates no durable move operations. Returning to the ordinary canvas
restores its saved view. Free-space presence must not pretend different
workspace layouts share coordinates; item-focused presence remains native.

## 3. Dynamic Anatomy focus

Compute a deterministic, collision-free neighborhood: detailed focal card,
compact immediate neighbors, distant context markers. Animate bounds and
camera coherently from their current positions; user gestures can interrupt.
Use progressive detail and stop animation when settled. Test layout at 30,
100 and 300 concepts, rapid retargeting, reduced motion and small stages.

## 4. Navigation and change continuity

Persist analysis/lens/focus in the address; browser Back restores exploration.
Remember local pane preferences and separate workspace/canvas cameras. Keep
the reader's focus during incoming edits; highlight changed/new concepts and
place newly appearing relationships without restarting the whole scene.

## 5. Acceptance

Exercise root → child → connection → Back in a real browser, including comments,
native selection, keyboard navigation, responsive resizing and another
client's content updates. Verify canonical geometry and operation history are
unchanged by exploration, and explicit native edits still round-trip through
the CLI. Run focused tests at each phase, then the full suite, typecheck and
production build. Record measured outcomes and limitations here.

This plan implements fluid exploration and the two edit-preservation fixes
called out with it. The broader review's run lifecycle, complete semantic
editing command family and checkpoint diff remain separate follow-up work.

## Implementation and acceptance record

All five steps are implemented on `anatomy`. API 0.2.2 adds host-owned temporary
presentation and addressable view state. The spring engine is loaded with the
workspace; ordinary cards only carry the small geometry-consumer bridge.
The reducer owns `item.edit` preconditions and atomic body/metadata replacement.
Anatomy’s CLI exports a guarded draft; JSON/form mode switches share one draft.

Focused tests cover stale versions, metadata-only conflicts, unrelated concept
edits, intervening writes during upload, undo/redo, preserved native geometry,
comment-coordinate round trips, remote item work, frame-rate-independent
convergence, interrupted/retargeted animations, idle scheduling, reduced motion,
repeated content updates after a native drag, and camera resizing during its
initial glide. Graph tests cover 30/100/300 concepts, reordered input, incoming
additions without displaced homes, deleted focus and separate project/concept
ID namespaces.

Local browser acceptance used synthetic graphs and the native CLI/daemon:

- Root → concept → rendered connection → browser Back restored the intended
  focus and URL. Native card double-click and Enter also navigated correctly.
  The navigation-only journey left the 51-entry operation log **byte-identical**.
- All three sizes rendered their own isolated analysis: 31, 101 and 301 native
  items including the project. At most one full card and eight compact cards
  render detailed content. Distant markers retain native identity and can be
  reached through the hierarchy or native spatial navigation.
- The 300-concept check caught distant edges intercepting focal-link clicks.
  Suppressing marker-to-marker edges and painting focal connections last reduced
  the focused example from hundreds of paths to 25. Its connection click then
  opened the intended concept.
- A real card drag moved its saved native coordinates by **67 × 28 world units**,
  as read from the CLI. The discussion pin stayed at the card’s corner; Cmd-Z
  restored both positions. Opening the pin showed the existing native discussion.
  Test discussion state was restored after exercising its retract control.
- A form summary survived the switch to JSON. A JSON reason survived the switch
  back. Invalid JSON remained in its editor with an error. With that editor open,
  another CLI client saved a newer concept: the stale browser save was refused,
  its draft remained visible, and the newer content and reader’s focus survived.
- Returning to Canvas and reopening View Anatomy restored the focus. The
  ordinary canvas camera’s transform matched exactly on return. Pane preferences
  survived reload; the inspector also resized with its keyboard separator.
- At **390 × 844**, no horizontal document overflow occurred. Testing caught a
  ResizeObserver cancelling initial camera framing; the fix preserves the glide
  and accounts for already-measured stage changes. The focal card now fits inside
  the small stage after reload. The temporary viewport override was reset.

Layout-only measurements over 100 focus calculations per graph on this machine
were approximately **0.03 / 0.07 / 0.22 ms median** for 30 / 100 / 300 concepts
(300-concept p95 approximately 0.41 ms). These measure the deterministic layout,
not browser frame rate. The browser tooling waits for actions to settle, so
intermediate animation timing and reduced motion are verified with controlled
frame tests; no device-wide frame-rate claim is made.

Final validation: **4,176 tests passed; 70 skipped**, plus typecheck and the
production build. The production entry is
approximately **664 KB**, about 3 KB above the previous port. The bundle ceiling
now explicitly accounts for the accumulated port; graph layout, structured
renderers and the spring engine remain lazy. The standing 640 KB goal remains.

### Both surfaces

| Contract | Result |
| --- | --- |
| Operation vocabulary | Added conditional `item.edit`; inversion, replay/redo, blob retention, presence, timeline and evaluation readers handle it. |
| CLI | Added `anatomy draft`; existing concept saves require its preserved base. New concepts still accept plain JSON. Daemon integration verifies refusal and undo/redo. |
| Agent guide | Updated module quick reference and edit workflow; updated the command prompt. |
| Shared helpers | Conditional writes live in core. Anatomy’s read/edit model stays shared by both clients. Layout is a local gesture presentation; `anatomy show --node` already exposes its navigation intent. |
| README and API docs | Updated discovery, behavior and the generic workspace contract. The isomorphism audit now follows each module’s web/CLI imports into shared helpers. |
| Tests | Pure logic, real daemon/CLI integration, and browser gestures as recorded above. |

Saved resizing, free-space pins and unscoped cursors retain their ordinary
canvas meanings. An isolated exploration view shows anchored discussion,
native selection outlines and work labels; it does not invent a shared pointer
position across different focus layouts. Hosted deployment, device frame-rate
profiling and the remaining broader usability-review phases are outside this
local acceptance run.

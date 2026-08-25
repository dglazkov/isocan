# The workbench

*Drafted 25 Aug 2026, from a five-lens design fan-out and three adversarial
reviews. Every claim about the codebase below was read in it, not remembered.*

A second top-level view that flips from the canvas: **agents | files |
artifact | editor**. The agent view is the point — talk to every agent on the
project by @name, see what each is doing right now, expand a row for the
record. Panes collapse. And, like the canvas, the CLI can drive it, so agents
can change what a person sees — within rules this document exists to state.

The one-sentence summary of everything below: **the workbench is a projection,
not a product.** It renders the same ops, the same presence, the same threads
and the same items the canvas renders, through different chrome that answers
different questions. Almost nothing in it is new state, and that is the
finding, not a disappointment.

## The law it inherits

The repo has already ruled on this feature's central question — where does UI
state live — three times, in three files, with one answer:

- **Operations** for shared facts. ~28 op types in `ops.ts`; none about UI.
  Every op carries an actor and an inverse; undo is per-actor; replay is
  deterministic.
- **Routes** for what you are looking at. `address.ts` on full screen: *"your
  zoom is not my zoom, and an `item.focus` op would drag every open tab to the
  same screen"* — yet not merely local, *"because then only the person whose
  finger was on the key could ever reach it."* `isocan open [item]` states the
  CLI half: *"there is no op to send… but there IS an address, and handing
  over an address is something a terminal is good at."*
- **Presence** for gestures. *"Daemon memory + WS fan-out only — never the
  oplog, never storage, never undo"* (`protocol.ts`). Client-asserted, honest,
  ephemeral.
- **Local state** for ergonomics. Panel widths and collapse flags are
  per-browser zustand + localStorage (`uiStore.ts`, `lib/panels.ts`), keyed
  per canvas, *"deliberately per-client."*

Sorting every workbench noun into that table designs most of the feature. And
it sharpens the isomorphism into a sentence worth keeping:

> **"Nothing exists only in the web app" is a claim about facts and addresses,
> not pixels.** Every shared fact is an Operation either surface can send;
> every view is an address either surface can hand you; what remains — panes,
> widths, drafts — belongs to the screen it is on, where no operation may
> follow it.

The CLI's parity with a pane is the *question* the pane answers: the file
tree's parity is `isocan ls`/`tree`, the agent view's is `who`/`activity`/
`wait`, the stage's is `open --workbench`/`get`, the editor's is `edit`.

**Consequences, decided here:**

- **Zero new Operation types.** Everything below maps to `item.*`,
  `project.update`, `thread.*`. All five design lenses and all three reviews
  converged on this independently; the tempting ops (a workspace-layout
  manifest, a `view.register`, a persisted work-log) were each proposed and
  each killed by the proposer's own argument.
- **Layout is never shared.** A workspace-manifest item ("agents edit the
  layout with ordinary ops!") fails on every law at once: Dion's collapse
  becomes Kenny's collapse; every pane toggle wakes every `wait --all-ops`
  agent on a pixel event; and ⌘Z after collapsing a pane un-collapses a pane
  instead of reverting work — breaking the one promise per-actor undo makes.
- **New protocol messages need the same two-real-needs discipline as ops.**
  The ClientMessage/ServerMessage union is also a contract between surfaces.
  This design adds exactly one field (§ agent view) and zero new message
  pairs.

## The flip

Four architectures were considered:

- **A sibling page** (`/w/:canvasId`, own element): tears down the socket,
  the replica, the presence session and the viewport on every flip — the
  exact architecture `App.tsx`'s own comment warns against. Rejected.
- **A client mode** (a `workbenchOpen` flag): no address. The CLI cannot open
  it, a link cannot carry it, Back does not leave it. This is the design
  `address.ts` spends a page arguing against. Rejected.
- **Growing FullScreen**: an item-rooted route has no address for the
  workbench's own empty state, and the agent view must exist with nothing
  focused. Rejected as the door in — kept as a destination (see the stage).
- **A cover route inside `CanvasPage`** — FullScreen's exact architecture,
  widened. **Chosen.**

`address.ts` gains one spelling: `WORKBENCH_ROUTE = ${CANVAS_ROUTE}/w` and
`${CANVAS_ROUTE}/w/:itemId`, with `workbenchPath`/`workbenchItemPath`/
`workbenchUrl` beside their item-route siblings. Both routes map to the
already-mounted `CanvasPage` element (the `ITEM_ROUTE` trick, verbatim);
`CanvasSurface` renders `{wb && <Workbench/>}` beside its FullScreen mount, as
a **lazy chunk** — the bundle is past its 600KB warning and the canvas path
pays nothing. The viewport gets `visibility: hidden` while covered: state
survives, paint stops. Both route levels ship on day one — URL shape is
forever, and retrofitting `/:itemId` breaks shared links.

The CLI story is a flag on an existing verb: **`isocan open --workbench
[item]`**, built from the same address functions, endowing the same one-use
pass. An agent that wants a person to see something hands them the exact
address of the exact view.

**What carries across the flip — one-way, at the boundary only.** Flipping in
with a single selection lands focused on it (`/w/:itemId`). Focusing an
artifact inside the workbench does **not** write `selectedItemIds` or publish
presence: browsing must never become assertion, and Back must never replay a
selection history. (An earlier draft chained route → selection → presence
broadcast; review killed it — a remote follow-navigation would then produce
*presence about you caused by somebody else*, the exact thing client-asserted
presence exists to make unrepresentable.) An explicit "reveal on canvas"
affordance does the reverse trip deliberately.

**Esc pops one level**, bound as FullScreen binds it (window keydown, capture
phase): transient chrome first (expanded row, picker, find bar), then
`/w/:itemId` → `/w`, then `/w` → the canvas — by explicit address, not
`history.back()`, so a long browsing trail is not replayed in reverse. `W`
flips from the canvas (the letter is free in the key handler; verified).

**A mandatory non-feature shipped ahead of the cover.** `CanvasSurface`'s
window keydown had an `isTyping` guard and **no route gate** — Delete and
arrow-nudge fired under FullScreen, with the viewed item still selected, so
Delete under full screen deleted the thing you were looking at. Landed
independently (it was a live FullScreen bug, not a workbench prerequisite):
the handler now gates on the item route through `crossesCover` in
`lib/keys.ts`, where the cover policy has its one home — only ⌘K crosses, Esc
belongs to the cover itself — and `test/cover.test.ts` guards both the rule
and the wiring. The workbench's routes must sit under the same gate; extend
`crossesCover` there rather than growing a second policy in the handler.

## The frame

Three regions. The stage carries modes; there is no fourth pane.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Canvas   Atlas of the Lakes                      ⌘K   ◔◔◔ (facepile)  │
├────────────────┬──────────────┬──────────────────────────────────────────┤
│ AGENTS         │ FILES        │ hero-section.html · v4     Preview│Edit  │
│ ● Charlie      │ ▾ Documents  │ ┌──────────────────────────────────────┐ │
│   tidying the  │   DESIGN.md  │ │                                      │ │
│   hero       ▸ │ ▾ Pages      │ │        (rendered artifact —          │ │
│ ◍ Kenny        │  ▸ hero.html │ │         entered, always)             │ │
│   waiting 12m ▸│   about.html │ │                                      │ │
│ ◌ Nico · away  │ ▾ Images     │ │                                      │ │
│────────────────│   logo.png   │ │                                      │ │
│ MAIN THREAD    │              │ │                                      │ │
│  Dion: @Charlie│              │ │                                      │ │
│   fix the hero │              │ └──────────────────────────────────────┘ │
│  Charlie: on it│              │                                          │
│ [@… composer ↑]│              │                                          │
└────────────────┴──────────────┴──────────────────────────────────────────┘
```

- **Agents (left, primary — never fully hidden).** The roster above, the main
  thread and composer below, one column. Collapsible to a rail of faces, not
  removable: it is the reason the view exists.
- **Files (second column).** Collapsible to nothing; a labeled edge tab
  reopens it.
- **Stage (center).** Takes the rest. Its empty state is designed, not blank.

V1 ships a **fixed CSS grid** — no resizers, no collapse persistence, no
keyboard map beyond Esc and W. The full chrome (a generalized `PanelResizer`
with `{value, min, max, onChange}` props, per-canvas collapse keys on the
`panels.ts` pattern, ⌘1/2/3 focus, ⌘B tree toggle — all verified free of
collisions) is V2, built on the existing patterns *after* somebody has spent
an hour in the room. Widths, when they land, inherit the `innerWidth: 0`
guard so a backgrounded tab cannot destroy a stored width.

## The agent view

The heart of the feature, and it costs **zero new state**. Every element is a
render of things that exist; the work is composition, plus one honest
protocol field.

**A row is an actor, not a session.** `facepile.ts` exists because that rule
was once broken (one agent = terminal + browser drew twice — a recorded bug).
The workbench groups sessions by `actor.id`, makes the **cli session
primary** (it is the acting surface; a `kind:"web"` session is a person
watching), and renders extra surfaces as chips on the row. But it does not
copy `facesFor` verbatim — that function is first-push-wins, which would let
whichever surface connected first own the row. The grouping goes in **core**
(`roster(sessions, canvas)`), so `isocan who` gains the same state column
from the same function and the two surfaces cannot disagree.

**Roster membership: presence ∪ canvas memory.** Live sessions first; then
every actor the canvas remembers (`who --all`'s `knownNames`) with no
session, marked **away** — because "talk to Kenny" must not require Kenny to
be awake; a main-thread message waits on the thread for the next wake. There
is no "agents set up in the project" registry today (verified — the only
agent-shaped records are presence, claims, canvas actors, and harness
detection), and this design does not add one. A stored roster item
(`role=agent-roster`) is the documented escape hatch if a canvas ever needs
*intent* ("we run a design auditor here") rather than history — deferred on
the two-real-needs rule. Note: the home-wide "on call" state is **retired**
(#60 — an agent belongs to the directory it works in); a stale comment in
`Presence.tsx` still describes it and should be fixed before it misleads a
third design.

**Row states, derived — never asserted:**

| State | Derivation (all existing signals) |
| --- | --- |
| **Blocked on you** | `openAsk` — the last `/ask` in a thread with no non-asker reply (the-ask research; not yet in core — small, real work). Sorts first; clears on *answer*, not on read. |
| **Working** | `activity != null` (item / point / thread); `onThread` names what it is answering. |
| **Parked** | `wait`'s lifecycle status. Honest only once `statusSource` is on the wire — see below. |
| **Quiet** | live cli session, no activity, `lastSeen` past the 35s threshold (`quietFor`) — thinking, not frozen. |
| **Away** | no session; known from canvas memory. A claim younger than 30 min adds "recently here". |

**The one protocol change: `statusSource` on `PresenceSession`.** It exists
on the update side and the daemon then **destroys the tri-state on arrival**
(folded to a private boolean), so today a client cannot distinguish a parked
agent from a working one except by matching the literal string `"waiting for
you…"` — a lie waiting for the day the copy changes. The fix is storage plus
protocol (store the source on the session, carry it on the roster and through
relay), sized honestly as more than "one field" but still small. Until it
lands, V1 renders status strings **verbatim** and classifies nothing;
string-matched semantic badges are banned outright.

Sharpened by the security review: within its own vouched actor an agent
freely self-asserts `status`, `harness`, `label` — and `statusSource` is
itself a self-report. The trustworthy row facts are the **vouched actor id**
(every beat and every relayed roster is checked per-actor against the badge's
claims; forging *another* actor's status is structurally impossible), the
**server-chosen color**, **lastSeen** (server clock), and **attributed oplog
ops**. So: identity renders primary and unforgeable; free-text status renders
as what it is — the agent's claim about itself.

**The trail: *did* and *said*, honestly labeled.** An expanded row shows the
status line with its quiet-gap age; the thread it is answering (`onThread` →
excerpt → open); a live `ItemThumb` of its working locus; and the trail —
**did** (per-actor ops from the log the CLI's `tail` already reads, degrading
honestly at the gc horizon: "history before op N is archived", never an empty
lie) interleaved later with **said** (a daemon-held ring of recent statuses
that dies with the session — presence's contract applied to a short history
instead of one instant; deferred until wanted, and it lands on both surfaces
or not at all). A **persisted work-log op is rejected permanently**: it makes
narration replay forever, and the field's own correction (Linear's rule,
already adopted in the-ask research) is that state derives from activity,
never assertion. V1 ships `recentActivity` (already rendered by `FaceCard`)
and calls it a trail without shame.

**No undo buttons on another actor's ops.** Undo is per-actor by contract.
The honest affordance on a bad op is a prefilled message asking its author —
which keeps the whole panel read-only except the composer.

**The composer is the same main thread, projected twice.** Not a copy, not a
fork: `MainThreadPanel` rendered in the column — same component, same
`MentionField`, same unread store, so reading in one view clears the badge in
the other. Broadcast is the default (a main-thread comment already wakes
*every* parked agent); directed talk is a reply in the agent's own work
thread (`onThread`), which wakes that agent alone under `wait`'s existing
rules. **Per-agent DM channels are rejected** — the field's costliest
anti-pattern (Devin's session silos force reviewers to "reconstruct intent";
Amp and Copilot are retrofitting shared threads to undo it), and isocan's
one-channel law already prevents it. One inherited contract needs a tweak:
`markRead` currently fires when the panel opens — right for a deliberately
opened panel, wrong for a permanently docked column, which would mark
messages read the instant you flip. Decide once in `unreadStore`: mark on
column focus or scroll-into-view.

**Orchestration falls out for free.** Drag an item onto Kenny's row →
prefills `@Kenny #Item ` and focuses the composer — never auto-sends (the
consent rule the ask research fixed). The row state answers "will a nudge
land?" before you type: parked wakes now, quiet sees it next lap, away waits
on the thread. "Ask to stop" reuses OnIt's `/cancel`. Blocked-on-you pins to
the top.

## The stage

**One `ArtifactStage`, three routes.** The tell of the two-products disease
would be the same artifact rendering differently at two of the product's own
addresses — which is exactly what a workbench-only tab strip would create
against `/i/:itemId`. So the renderer grows out of `VersionContent` +
FullScreen's frame into one component mounted by full screen and by the
workbench stage from day one. "FullScreen is the workbench with every pane
collapsed" stops being a someday-sentence and becomes the component boundary.

V1 is **preview only** — `isocan edit` already speaks `item.addVersion`, so
CLI parity exists before the web editor does. When Edit lands (V2): modes on
the one stage (Preview / Edit / Split), gated by MIME — a png has no Edit
tab, not an empty box; CodeMirror over Monaco, lazy-loaded inside the
workbench chunk; ⌘S = `item.addVersion`, the identical op the CLI sends.

**Drafts persist and restore silently.** The sketch precedent (`placeSketch`
on unmount — ink is never quietly lost, and never asked about) beats an
"unsaved changes?" dialog: the buffer lives in memory, mirrored to
localStorage keyed by item+baseVersion; Esc never traps; an explicit Discard
clears the storage too. Saving is an op and leaving is a route — the two
layers never hold each other hostage.

**Version chrome tells the convergence story.** The stage wears the version
stack (`S` to fan, promote to choose) so an agent's proposals land as
versions the person flips through *in place* — the convergence gesture the
research kept finding missing, given a room of its own.

## The file tree

Two trees, staged, because "files in the project" is ambiguous and the two
readings have different owners:

- **T1 — the canvas as files (V1).** `FilesPanel` mounted verbatim — kind
  grouping already agrees with `isocan ls --kind` by construction. If it
  wants new grouping code, it is V2; verbatim or not at all.
- **T2 — the bound directory (V3, gated on its own policy).** A read route
  (`GET /api/projects/:id/tree`) answered only by a daemon actually holding
  the binding, refusing honestly (`no-directory`) on a hosted home. The
  security review's rules are binding, not advisory: **canvas admission must
  NOT imply tree-read** — every canvas is born with a link grant, and a tree
  endpoint on the admissions door hands anyone with the link a listing of
  your working directory, `.env` included. Tree-read is scoped to the
  daemon's **own person** and local clients; realpath-jail the root and
  re-realpath every entry (a symlink inside the dir must not walk out);
  honor `.gitignore` *plus* a hard non-negotiable exclusion of dotfiles and
  known secret names; a listing is not content — **file contents are served
  only through add-to-canvas**, which is the existing, deliberate line
  between "on my disk" and "shared".

Clicking a tree file that is an item focuses it. A repo file that is not an
item shows name-only with one affordance: add it to the canvas.

## Custom views

The extensions doc's tier 3, made load-bearing — built on it, not re-derived.

**A view is an item.** `role=view` is the third instance of the move
`role=design-system` already made. Manifest in `Item.properties` (three
fields, defined once in core beside `ROLE_PROP`):

```
role       = "view"
view.for   = a core kind name ("screen", "document") or a mime ("text/html", "image/" prefix)
view.slot  = "artifact" | "side"
```

The item's own `title` is the tab label; icons come from the named set tier 1
mandates. Discovery is one pure function, `viewsFor(canvas, item)`, the only
reader of the schema, called by the tab strip and the CLI both. Registration
is `isocan add colors.html --prop role=view --prop view.for=screen` — so a
view **versions** (a bad one rolls back with `S`), **undoes** per-actor, is
**commented on**, **trashes and restores**, carries **lineage**, and travels
with the canvas: open somebody's canvas and their views are there, because
the views are *on* it. One read verb ships for symmetry (`isocan views
[item]` — `viewsFor` with a formatter); no verb family before need.

**Which view you are looking through is an address** (`?view=<ref>` on the
workbench item route — the first query-carrying builder in `address.ts`, when
it lands), because "hand somebody the exact view I mean" is the agent
scenario and local-only state forecloses it. **Precedence, written once:**
route beats viewer-local sticky beats the shared per-kind binding beats
built-in Render. The shared binding (`project.update {"view.screen": <id>}`)
exists only as an explicit curatorial act (`--use`), and a binding to an
absent or trashed item renders as unbound with fallback — the dangling
reference is legal state and must be handled, since no reducer invariant
cleans canvas properties.

**The bridge is ext-apps, not a private vocabulary.** `measure.ts` already
implements the frame pattern (sandboxed frame, correct source guard,
timeout); it widens into the ext-apps method names, per the standing
instruction in the ask research. Three methods at v1 — the colors scenario
end-to-end and nothing else:

```jsonc
// view → host, once            { method: "ui/initialize" }
// host → view: who the frame is, and the subject (content PUSHED as a string)
// host → view, on any version  { method: "subject/version-changed" }
// view → host, the one write   { method: "subject/propose-version" }
```

Content is host-pushed, never fetched: the frame gets no ambient network
toward isocan at all. Deliberately absent: reading other items, listing the
canvas, **threads and comments** (the main thread is where humans hold agents
to account; software silently reading it makes the one channel less honest,
and a view that reads @mentions is an injection surface pointed at every
parked agent), presence, navigation, storage. A method is added when two real
views need it.

**Writes ride as the view's extension actor** — extensions.md's whole model:
attributed (`isocan activity <view>`), revocable (the door refuses a revoked
actor's op server-side, no host cooperation needed), visible in presence.
Never as the viewer — the codebase already ruled on that shape
(`comment.update`: "nobody else gets to put words in your mouth"). The
undo edge this creates is solved *without* impersonation: **discard is
`item.setCurrentVersion(prev)` sent as the viewer** — targeted, attributable,
an existing op, landing in the viewer's own undo chain so the ⌘Z instinct
actually works; the proposed version stays in the stack, which is the
checkpoint story. (A host control that "sends the undo as the view actor" is
broken twice over: the viewer's badge holds no claim to that actor, and
per-actor undo is one chain per actor — two viewers would discard each
other's tweaks.) The remaining server-side dependency is named, not assumed:
*who stamps a view-originated op with the extension actor* is extensions.md
stage 4 machinery — plausibly the daemon holding extension grants and
re-stamping after the grant check — and no view HTML executes before it and
the content origin both exist.

**The artifact pane is a bigger lie surface than a side panel**, and the
mitigations are all host-drawn, outside the frame's reach: the host owns the
tab strip (the honest Render tab is always one click away — VS Code's
"Reopen With" rule, load-bearing); a permanent made-by strip in the extension
actor's color (never a person's — "that is somebody's face"); writes have
effects the frame cannot fake or suppress, because every proposal is an op
and the version chrome updates outside the frame.

**Two security findings from review are now requirements:**

1. **The content origin stops inbound theft, not outbound exfiltration.**
   Blobs ship `CSP: sandbox allow-scripts` and nothing else — no
   `connect-src`, no `form-action`, no `default-src` (verified in
   `http.ts`). An opaque-origin frame can still `fetch`/`sendBeacon`/
   `Image().src` anything it was handed — including what a user types into a
   fake form — to anywhere. Views get a served CSP of `default-src 'none';
   connect-src <content-origin>; form-action 'none'` as a **new,
   load-bearing control**; the sandbox tokens stay exactly `allow-scripts`.
2. **The install ceremony guarded the wrong door.** The author's `--yes`
   consents the author; the *viewer* whose stage will host foreign HTML never
   consented, and "no install without reading" has no landing site when a
   canvas carries its own UI. Tier-3 views get a **first-render capability
   card per viewer** — what this view is, who made it, what it may do
   ("proposes versions of the item it is viewing") — accepted once per view
   per browser, remembered locally.

Trashed while displayed: kill the frame, refuse in-flight proposals, show a
host-drawn note ("This view was trashed by dion — Restore, or Render"), fall
back to Render. Rolled back: remount on the older blob — the S-fan doing
what the extensions doc promised.

Some "custom views" deserve to be **built-in instead**: version-diff, JSON
tree, CSV table — read-only, universal, small. Color and theme editors and
everything that writes belong as extensions.

## Attention: addresses, not intents

Can an agent change what you are looking at? The design answer is the
sharpest cut in this document: **no new channel.** An addressed, deniable,
TTL'd "UI intent" message was fully designed and then rejected on three
grounds: it is a fourth plane wearing presence's clothes (addressed at you ≠
asserted about me); it is the product's first web-only receive path; and it
fails the history test the codebase itself wrote for `/cancel`-as-comment —
"why did my tab end up looking at X" deserves an answer in the record and an
ephemeral intent leaves none. Everything it does, a comment already does
better: durable, attributed, and it *wakes* the target.

So: **`isocan show <item> [--say <note>]` is sugar that posts a main-thread
comment carrying the workbench address.** The workbench renders item and
address references in comments as click-to-focus chips. An agent that wants
your attention has three honest channels — say so in the thread, set its
status, hand you an address — and all three exist today.

The one pre-granted consent stays what it is: **follow mode**. Following a
session is "show me what you're doing", viewer-granted per sender, revoked by
Esc and by any manual movement. When workbench follow lands (V3: pinned row,
auto-focusing what the agent's locus names), it inherits the
grabbing-the-wheel rule explicitly: follow navigates with `replace` (Back is
yours, not a replay of Kenny's afternoon), and any user-initiated navigation
clears it. Nothing an agent can send may ever turn follow **on**.

## What this must never become

- **No per-agent DM channels.** The record is one channel; expansion is a
  filter over it, never a private inbox.
- **No layout in the oplog.** A canvas's history reads as what was made, not
  where the furniture stood.
- **No new op types, and no second spelling of the view manifest.** Property
  keys replay forever; `view.for` is defined once, in core, next to
  `ROLE_PROP`.
- **No view HTML before the content origin and extension actors exist.** The
  srcdoc interim is exactly the pressure the content-origin doc warns about.
- **No string-matched status semantics.** Show the string, or ship the field.
- **No undo affordances on another actor's ops.** Anywhere.

## Staging

**V1 — the agent room.** The route family in `address.ts` + two App.tsx
lines; the lazy cover with viewport hidden beneath; the key-handler gate
(mandatory, fixes FullScreen too); the roster component (rows from grouped
presence, expand = status + onThread excerpt + `recentActivity` + ItemThumb +
Ask-to-stop); `MainThreadPanel` mounted verbatim; the stage as
`ArtifactStage` (Preview only) shared with FullScreen; FilesPanel verbatim if
truly verbatim; `isocan open --workbench`; the two-silences empty state (a
quiet roster renders the copyable `isocan wait` line, not a blank).
`statusSource` lands when convenient; until then, verbatim strings. Zero new
ops, zero new message pairs.

**V2 — the working surface.** Edit/Split modes (CodeMirror, lazy); ⌘S;
resizers and collapse persistence on the generalized `PanelResizer` +
`panels.ts` patterns; away rows (presence ∪ canvas memory); `openAsk` in core
and blocked-on-you sorting; `roster()` extracted to core and shared with
`who` (which gains a state column); the markRead refinement; drag-to-prefill.

**V3 — the extensible bench.** Each piece gated on its own dependency, not on
each other: `role=view` + `viewsFor()` + the tab-strip picker + `?view=`
addresses + the ext-apps bridge (gated on the content origin, extension
actors, the viewer capability card, and the exfil CSP); the repo tree
(gated on settling owner-scoped read, jail, and dotfile rules); workbench
follow; `isocan show` sugar; the narration ring if the trail's *said* layer
is wanted — on both surfaces or not at all.

Enforcement, per the house rule that both-surfaces is a test and not a
promise: a workbench test that fails if the bundle references an op type
absent from `ops.ts`, or if a workbench gesture lacks a CLI row in the
parity table above.

## Open questions

- **Who stamps a view's ops with its extension actor?** The daemon holding
  extension grants and re-stamping after the grant check is the plausible
  shape; it is stage-4 machinery nobody has budgeted, and tier 3 does not
  ship until it is designed.
- **Does a canvas ever need a stored agent roster** (intent, not history —
  "a design auditor runs here")? Deferred until one real canvas asks.
- **The gc archive is still write-only** (the Headlong finding): the trail
  renders the horizon honestly, but nothing yet reads what was archived.
- **Agent lineage** (a coordinator's sub-agents indenting under it — the
  Devin pattern): attractive, and isocan has artifact lineage but no agent
  lineage. A data-model question for its own document, not a panel checkbox.
- **First-visit layout hints** (a canvas suggesting an arrangement once,
  never syncing after): declined now; if it returns it must answer the
  wrong-ledger arguments in § the law, which it currently loses.

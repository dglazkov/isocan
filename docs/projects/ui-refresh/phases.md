# The UI refresh — the walk

**28 August 2026.** The canvas `prj_trml8m4Zfh` holds the design: seven
screens, a rationale (`The thinking`), and an implementation spec for two of
them. This is the order to build it in, and what each step has to be true
before the next one starts.

**Where we are: phase 0 answered and phase 1 landed (28 Aug 2026), with one
acceptance item outstanding — see phase 1.** The three
questions took an afternoon and would have cost a week if answered by
building.

## What was verified before planning

The spec was checked rather than trusted, and it held on every claim that can
be checked:

- `lib/stage.ts` owns `dockEdges`/`stageRect`; `.main-panel` is at
  `styles.css:1719`; `panelwidth.test.ts` and `PANEL_MIN_WIDTH` exist;
  `stage.test.ts` and `worldchrome.test.ts` exist.
- **The panel already overlays the canvas** — `position: absolute; top: 48px;
  left: 0; bottom: 0`, above the viewport, with `dockEdges.left` telling
  framing to avoid it. So opening the Chat covers the canvas today rather than
  reflowing it, and §1 really is a restyle.
- **`followViewport` already exists** as "the one mutation that does not read
  as *the user grabbed the wheel*". The spec's §2.3 question — how to pan
  without dropping follow — is already answered by the codebase.
- **`shortcuts.test.ts` really does only check single letters**
  (`/^[A-Z]$/`), so `⌘J` is genuinely uncovered. The spec is right to say so.

Three things the spec does not say, found while checking it:

1. **`--panel` already exists in both themes** (`rgba(255,255,255,.92)` /
   `rgba(23,26,31,.9)`) and is **already paired with `backdrop-filter` in four
   places**. The frosted treatment is not new; it is unspent. §6 says to add
   `--float` only if `--panel` does not measure the same — it does not measure
   the same (the proposal is more transparent), but the spec's own rule
   applies: *a second token for one surface is how a palette starts to drift*.
   **Start with `--panel`.** Add `--float` only if the built thing is wrong,
   and say what was wrong.
2. **The blur is unmeasured over a live canvas.** The four existing uses are
   small: a toolbar, popovers. A full-height rail at `blur(20px)
   saturate(1.3)` sits over a dot grid, animated cursors and a canvas being
   panned and zoomed. That is a different proposition and it is the one thing
   here that can be *right in a screenshot and wrong in the hand*.
3. **`⌘J` is free in the app and taken by the browser** (Chrome's Downloads).
   It is overridable, but that has to be verified rather than assumed, on the
   browsers people use.

## The constraints, which are gates and not cleanup

The person asking for this said it plainly: **keep light and dark, keep the
grid and the cursor bling, do not lose features.** Both the rationale and the
spec defer light mode ("the screens are dark… a default worth arguing about"),
and deferring it is how it ends up broken.

So, for every phase below:

- **Both themes resolve, in the same commit.** Not a later pass. The screens
  being dark is a choice about a default; it is not permission to build one
  theme.
- **Contrast is measured, not eyeballed** — the repo has `contrastRatio` and
  `checkDesign`, and a frosted ground is exactly where a hairline of text
  quietly fails.
- **No feature leaves.** A surface may move or be summoned instead of always
  present; nothing may become unreachable. The `···` drawer in phase 6 is
  where this is most at risk and it is the reason that phase is last.

---

## Phase 0 — Answered, 28 Aug 2026

1. **The rail stays on the left**, where the Chat is today.
2. **Draw only.** The lane draws the link and moves nothing. `/format` does
   not grow a lane rule, and no `items.move` is written on anybody's behalf —
   where results sit stays the person's own arrangement.
3. **Dark is not the default. System is**, which is what ships today:
   `index.html` resolves `localStorage["isocan.theme"] || "system"` before
   first paint. So this is a no-change, and the screens being dark is a
   description of one theme rather than a proposal about the default.

Answer 3 sharpens the constraint the rest of this document already carries:
the design was drawn in dark, the product opens in whatever the machine
prefers, and **most people will meet these surfaces in light.** A frosted
slab over a pale canvas is the harder of the two to get right, so it is the
one to look at first in phase 1 — not the one to check afterwards.

## Phase 1 — The rail becomes a floating slab

Spec §1 and §6. Purely presentational; the markup does not change.

Inset on all four sides, `--r-float`, frosted ground, one hairline all round,
a real shadow. The resizer keeps working and must inset at top and bottom or
the rounded corner swallows the grab.

**Done when:** it looks right in BOTH themes, text on the frosted ground
passes contrast in both, the resizer grabs at every height, and — the new
acceptance — **panning and zooming with the rail open is measured and
acceptable on the slowest machine that matters.** If blur over a live canvas
costs too much, that is discovered here, cheaply, before three phases are
built on top of it.

**Landed 28 Aug 2026, with one acceptance item OUTSTANDING.**

Chat and Files share one `.dock-panel` frame — they had byte-identical rules
written twice, and restyling one would have left the other clamped to the
edge. `--panel` and a blur, no new colour token, as §6 asked. `railSpan`
carries the 20px inset into `dockEdges`, so framing still refuses to park an
item under the rail.

Contrast measured on the composited ground rather than eyeballed, both
themes, all four inks:

| | light | dark |
|---|---|---|
| `--ink` | 15.14 | 14.50 |
| `--ink-muted` | 5.25 | 5.62 |
| `--ink-soft` | 5.14 | 5.40 |
| `--accent-text` | 7.81 | 7.74 |

**The blur is still unmeasured under motion.** The browser pane this was
built in pauses `requestAnimationFrame` while it is hidden, so frame timing
during a pan could not be taken, and a number that was not measured must not
be reported as one. What was done instead is to spend less than the design
asked for — `blur(12px) saturate(1.2)` rather than 20px/1.3 — and to note
that four other surfaces already blur without complaint. **This is the item
to close before phase 2**, on a real machine, by hand.

**Known interim inconsistency:** the trash and marks panels dock to the RIGHT
edge and are unchanged, so they are still flush while the left rail floats.
Mirroring the arithmetic on `dockRight` is not phase 1's job and those two
surfaces are folded into the `···` handle in phase 6 regardless. Recorded so
it reads as a staging decision rather than an oversight.

## Phase 2 — Opening the rail pans the canvas

Spec §2. Pure mechanic, no pixels change. The riskiest logic in the whole
refresh, because it moves the camera on the person's behalf.

Build the **resize** case first, not the toggle: dragging the resizer pans
continuously under the hand, and that is the version that can feel wrong in a
way no test catches. If it feels wrong, the toggle-only version is still worth
having and the resize case can be dropped.

`followViewport`, not `setViewport` — verified above; the codebase already
made this distinction and named it.

**Done when:** the four transition cases pass (open, close, second rail opens,
second rail closes), a widen of 76 pans by exactly 76 once, follow survives,
and **it does not fire on mount** — a rail restored open has a viewport that
is already correct, and panning it would scroll the canvas sideways on every
load.

**Landed 28 Aug 2026.**

The distance is `dockEdges`, never a fresh measurement — the same derivation
framing uses, so the pan and the framing cannot come to disagree about one
rail. That choice answers the awkward cases for free: Chat→Files changes no
width, so the delta is zero and the canvas does not twitch; widening a CLOSED
rail moves nothing, because a closed rail occupies nothing.

Measured in the browser, all four transitions, at panelWidth 320:

| transition | pan | expected |
|---|---|---|
| Files → Chat (swap) | 0 | 0 |
| Chat → closed | −340 | −340 |
| closed → Files | +340 | +340 |
| Files → closed | −340 | −340 |

A keyboard widen of 128px panned by exactly 128, once. Restoring a remembered
rail on load does NOT pan: it is the one caller that passes `pan: false`,
because the viewport being restored was saved with that rail already open.

**Two findings worth more than the phase.**

`requestAnimationFrame` does not fire in a hidden tab, and the harness these
phases are built in reports `document.hidden === true` permanently. That is
the answer to phase 1's unmeasurable blur — diagnosed rather than guessed —
and it is also a real defect it exposed in this phase: an eased pan started
while nobody is looking does not run slowly, it STOPS half-applied and
finishes whenever the tab is next brought forward. The ease is skipped when
the document is hidden, alongside reduced motion.

A reload drifts the camera by ~15–19px **with the rail shut as well as
open**, so it is pre-existing and not this phase's doing. Recorded rather
than folded in silently: it is small, it is in both directions, and nobody
has reported it — but a canvas that does not come back exactly where it was
left is worth its own look.

## Phase 3 — Closed: the 48px strip

Spec §3. A new persistent surface, and the first place the redesign REPLACES
something rather than restyling it.

The unread count comes from the call `CanvasPage` already makes; the faces and
their working/blocked rings come from the reader `Presence` already uses.
Nothing is computed a second way.

`⌘J` toggles. Verify the browser lets us have it before designing around it,
and either extend `shortcuts.test.ts` to modifier combinations or record that
the gap is knowingly accepted — the spec is right that nothing currently
catches a missing handler here.

**Done when:** the strip shows the true unread count, rings exactly the agents
`isocan who` would call working, `⌘J` works in the browsers people use, and
the entry appears in both `?` and `isocan shortcuts` from one `SHORTCUTS` row.

**Landed 28 Aug 2026, with the ⌘J browser question OPEN.**

48px, inset and floating like the open rail, because it IS the rail in its
other state — a strip clamped to the edge beside a floating panel would read
as two pieces of furniture.

`STRIP_WIDTH` went into `stage.ts`, so `dockEdges().left` is never 0 any more
and framing, the stage rect, the minimap, the hover cards and phase 2's pan
all followed from one line. Phase 2's own numbers changed with it: opening the
rail now pans by 272, not 340, because the shut rail is 48px rather than
nothing. Three tests that encoded the old truth were updated, and one of them
gained a fact worth keeping — the 20px inset CANCELS in the pan, since both
states are inset, and that is now asserted rather than assumed.

Nothing is computed twice: the ring is `sessionState`, the reader `isocan who`
prints from, so "the ring is on" and "the terminal says working" are one
claim. Only `working` and `blocked` ring — a ring that is always on says
nothing.

**A bug found by looking rather than by testing.** The badge sits on the Chat
button but summed unread across EVERY thread, so a comment pin anywhere on
the canvas landed on the Chat's count. Verified live: two Chat messages plus
one unrelated pin read 3 before the fix and 2 after, while the tab title
correctly moved (1) → (2). The tab title counting THREADS is not a
contradiction — it answers "how many conversations want you" across the whole
canvas. Two numbers, two questions.

**⌘J is registered, handled, and unverified in a browser.** The row is in
`SHORTCUTS`, so `?` and `isocan shortcuts` both print it from one place
(confirmed on the CLI). Whether a browser hands the combination to a page
could not be tested here: the harness delivers no key events to the page at
all — a plain `j` never arrived either — so the result was inconclusive, not
negative. **This needs one press on a real machine, in Chrome and Safari.**

The design does not rest on the answer: the strip is a button, so a browser
that keeps ⌘J for its downloads panel costs a keyboard convenience and nothing
else. A shortcut may be unavailable; a feature reachable ONLY by a shortcut a
browser might eat may not be.

The general gap the plan named — nothing catches a documented shortcut with no
handler — is closed for ⌘J and **knowingly left open in general**. A
table-driven check over every row would have to guess how each key is spelled
in a handler, and a guard that guesses eventually passes for the wrong reason.

**Not built, because the spec does not say what it does:** the mock's `+`
button below the faces. Adding a control whose action I would have to invent
is worse than leaving the strip at what phase 3 actually specifies.

**Known interim duplication:** the Chat's unread count now appears twice — on
the strip and on the top bar's `Chat` pill. The mock has no Chat pill, and
removing it is right eventually. It is NOT right now: `PanelSwitch` is a pair,
and dropping half of it leaves a lone `Files` button four phases before phase
6 folds Files, marks, trash and the minimap behind one `···` handle. The two
numbers agree — both read the Chat through `mainThread` + `unreadCount`, which
is also how the duplication was confirmed harmless rather than assumed to be.

## Phase 4 — The lane

Spec §4, and the reason the refresh exists: **isocan already records which
item a message produced and has never drawn it.**

**4a — the data and the chip.** `lib/lane.ts`, a pure function over
`CanvasContents` and a thread, with its own tests: an item a message MADE is
in `m.items`, created at or after the message, by the same author. Everything
else was merely mentioned, and the difference matters — "here is what I built"
and "look at that" are different claims. Then a `→ #Title vN` chip in the
message, using the chip style that exists.

4a is worth shipping alone. It is most of the value and none of the risk.

**4b — the tether and follow.** A dashed screen-space line, drawn only when
it is honest: the item on screen, within ±120px vertically, under 400px of
run. Otherwise the chip and no tether — a line to an item three screens away
is noise, and one drawn to an item that has moved is a lie. Screen space, in
the layer the comment pins already use, never inside `.world`.

Follow is off by default, throttled, and **suppressed entirely during a pan or
a drag** — a canvas that moves under a dragging hand is the worst bug this
feature can produce.

**4a landed 28 Aug 2026.**

`laneFor` went into CORE, not `web/lib` as sketched. What a message made is a
fact about the canvas, not about a panel: `isocan comment` can print the same
lane the app draws, and the alternative is two derivations that agree until
they don't — which is the one thing the isomorphism law exists to prevent.

**The rule gained an upper bound the sketch did not have, and is wrong
without it.** "In the message's `items`, by the same author, at or after the
message" also needs *before that author's next message in the thread*. With
only a lower bound, the first message that ever mentioned an item claims every
version made afterwards, so a long thread grows arrows pointing at work a
later message did. A message owns what its author did between it and their
next word — and the bound is the AUTHOR's next word, not the thread's, so a
person saying "thanks" does not end what an agent is still doing.

Ten tests, each one a way to draw an arrow at work the message did not do.

**The chip is not a duplicate of the card below it, though it looks like one
today.** The card reads `v${versions.length}` — the item as it is NOW. The
chip reads what this message MADE, which stops changing when the author moves
on. They coincide only while the message produced the latest version; on an
item worked since, the card says v7 and the chip still says v2. Verified live
on a real canvas: `→ Lane probe v2`, "Kenny took this to v2 here".

## Phase 5 — Item chrome sheds its box

Spec §5. Last, as the spec says, and for the reason it gives: it touches the
most-tested file in the package and it is the least important change here.

The name floats above the paper, the version count sits beside it, the running
dot joins the name line. **Anchors do not move** — this changes what chrome
looks like, not where it sits or how it counter-scales. If the work reaches
`counterScale` call sites, it has gone past its scope.

## Phase 6 and beyond — the rest of the redesign, not in the spec

The rationale describes six moves; the spec implements parts of three. Naming
the rest keeps anybody from thinking the refresh is finished when §1–5 are
green:

- **The agent tray.** `isocan who` given a home — who, what they are doing,
  what state they are in. The statuses are already computed and already
  correct; they have never been shown. The rationale argues this is the most
  isocan-specific move of the lot, and it is not in the spec at all.
- **One handle, not eight panels.** Files, marks, trash, minimap, design
  system, workbench, help behind a single `···`. There are eight
  always-present chrome surfaces today; this is the move that would repay the
  most canvas. **It is also where "do not lose features" is most at risk**,
  and why it comes after everything above rather than first.
- **The radius ladder and borders-into-elevation**, generalised past the rail.
  Phase 1 proves the language on one surface; this spends it everywhere.
- **The composer question**, which the rationale itself leaves open: a field
  that takes `@Fable`, `/format` and prose has to say which it heard BEFORE
  return. That is upstream of any composer work and is not designed yet.

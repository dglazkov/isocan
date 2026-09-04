---
status: partial
since: 2026-09-04
issue: 134
see: ui-refresh, roles, standing-agents, 2026-09-04-project-and-canvas.md
note: phase 1 built 4 Sep — ⌘O, ⌘K → Switch canvas…, and the caret beside the name open one window that leads with the canvases this browser was on lately, finds one from a few letters, and moves you there; recents on the home screen and in the lens, spaces as headings, a shared "lately", and the project › canvas row are open
---
# The switcher

Going to another canvas, from wherever you are, without the trip through the
home screen. Phase 1 shipped on 4 September 2026; this document is the
research it stood on, the decisions it made, and the walk from here.

## The debt it discharges

The home screen is the only way between canvases. It is a good screen for
CHOOSING — cards, a peek, a sort, a filter above eight canvases — and a bad
screen for GOING: when you already know where you are going, which is nearly
always the canvas you were on ten minutes ago, the `⌂`, the scroll and the
click are a tax on every trip. Two things made the tax visible at once: the
number of canvases at one home passed twenty (eighteen on isocan.io on
3 September, before the day's work), and standing agents made it normal for a
person to be in several at once — an agent parked on `isocan rc --all`
answers on every canvas it is enrolled on, and the person running it follows
it around.

## What the field does (unmeasured; from use, not from an API)

Every app with several documents has converged on the same object, and it is
worth naming because the convergence says what people have learned to expect:

- **A field over a list, opened by a chord.** Slack's ⌘K, VS Code's ⌘P,
  Linear's ⌘K, Notion's ⌘P, Arc's ⌘T, Raycast's window. The list leads with
  the recent, the field narrows it, Enter goes. Nobody makes you pick a mode
  first.
- **Fuzzy, always.** VS Code's `lkh` reaching `LakeHouse.tsx` is the
  canonical example; the ranking prefers word starts and contiguous runs,
  which is what makes three letters enough.
- **The title is a door.** Figma's file name in the bar has a caret that drops
  a list of recent files; Notion and Google Docs put the switcher behind the
  document's own name. It is the one door that needs no key to be found.
- **The commands and the documents share a window.** VS Code separates them
  by a typed prefix (`>` for commands); Linear and Slack list both. Two
  windows is the shape nobody chose.

None of this was measured here — it is what those products do at the time
of writing, from using them — and it is recorded as the shape, not as a
ranking of vendors.

## What already existed

- **A `recent` sort, in core** (`canvassort.ts`): by `updatedAt`, which the
  reducer stamps on every op since 24 August, so "recent" means recently
  active, not recently renamed. The home screen's default order.
- **A term filter, in core** (`filterCanvases`): every word must appear, in
  any order. Deliberately not fuzzy, and the launcher's comment says why: a
  matcher that scores letters anywhere is how a palette starts offering
  "Delete everything" for "de".
- **The launcher** (`CommandPalette.tsx`, ⌘K): actions the app does now, then
  slash commands it hands to an agent, one field, one highlight moved by the
  keyboard. A row already reached the home screen ("All canvases").
- **The list of canvases this origin is the home of** (`listCanvases()`,
  phase 10.3): a client-side navigation never asks the server, so any list
  that turns into a `<Link>` has to be this narrowed one, or a row would open
  a stale local copy of a canvas homed elsewhere.
- **Where an agent stands** (#128, `isocan history <actor>`): a row per canvas
  an actor is enrolled on, acted on, or is on now. The terminal's answer to
  "which canvases am I in", one step from "take me there".

## The decisions phase 1 made

**One window, two faces.** `uiStore.paletteOpen` went from a boolean to
`"commands" | "canvases" | null` — one state that says both whether the
window is open and which face it wears. The switcher is the same component as
the launcher because it is the same gesture, and a second modal over the
first would have had to answer which of two Escapes closes what. Backspace on
an empty field steps back to the commands.

**Three doors, no clutter.** ⌘O (which crosses a cover like ⌘K, since leaving
is the one act that makes sense whatever is covering the canvas and it acts
on nothing here); the "Switch canvas…" row in ⌘K, which flips the window
rather than closing it, so no flash and no lost keystroke; and a caret
beside the canvas's name in the bar, shown to readers too, because switching
is not a write. The commands face also lists up to five matching canvases
under the actions once a letter is typed, so the common trip is ⌘K, three
letters, Enter, with no mode to learn. Nothing was added to the rail or the
drawer: the caret is two glyphs wide and the only thing in the bar that grew.

**Lately first.** The list leads with the canvases this browser was on, most
recent first, then everything else in the home screen's `recent` order. A
visit is a fact only the browser knows — the daemon sees writes, not visits,
and a canvas read for an hour without a change is exactly the kind you come
back to — so it lives in `localStorage` (`isocan.canvases.recent`, twenty
rows, title riding along). The title is what lets the list paint before
`listCanvases()` answers, and instead of it: offline, the recents are the
whole list, and every one opens from the replica.

**Fuzzy here, and only here.** `fuzzyMatch` in `core/canvasswitch.ts` takes
the letters in order from anywhere and scores letters together, word starts
and a prefix above the same letters scattered, so among titles that all
contain the letters the obvious one comes first; a title missing a letter is
not a low score but no match. The launcher's whole-term rule guards against a
wrong match DOING something; a wrong canvas match does nothing and Back
undoes it, so the trade goes the other way — and the code says so where the
two matchers sit.

**A move rather than a cut.** The route element is the same `CanvasPage` for
every canvas, so without anything the surface was simply replaced between
one frame and the next. `lib/canvasswitch.ts` recedes the surface for 140 ms,
navigates, and brings the next one forward for 220 ms; the class is on the
viewport's wrapper and not on the page, because the bar and the rail are the
same chrome on both canvases and chrome that lurched would say the app
reloaded. Under `prefers-reduced-motion` both the keyframes and the wait are
skipped. The durations are held to the CSS by a test; the move itself is
never asserted on, only the state after it (`scripts/journeys.mjs`,
`switcher`).

**No CLI verb, deliberately.** An agent switches canvases by naming one:
every verb takes `--canvas`, and `isocan history <actor>` already leads with
where it stands. A viewport gesture gets no verb (AGENTS.md, "done on both
surfaces", line 2). The ranking is in core anyway, so the terminal could show
the same order the day it wants to.

## Open questions, honestly

- **⌘O in a real browser window.** The journey presses ⌘O through the
  DevTools protocol and proves the handler; it does not prove that a Chrome
  or Firefox window hands the chord to the page rather than opening its own
  file dialog. Both are believed to let `preventDefault` win (unlike ⌘T, ⌘W
  and ⌘N, which are reserved), and ⌘J's note in `CanvasPage.tsx` already
  records the same uncertainty. The design does not rest on it: the caret and
  the ⌘K row are doors a browser cannot eat.
- **Recents are per browser.** A person on two machines has two histories,
  and the person the identity desk lets resume across browsers (multi-identity)
  does not carry their "lately" with them. Whether that should be desk state
  — a per-actor visit high-water mark, the shape the inbox research proposed
  for seen-marks — is the same deferred decision, and it should be decided
  once for both.
- **The word.** The switcher says "canvas" everywhere, which is right today
  and stays right when a project holds several canvases — you still switch
  canvases; the row grows a project above it. See
  [`2026-09-04-project-and-canvas.md`](../../research/2026-09-04-project-and-canvas.md).

## The walk

1. **The window, three doors, lately first, fuzzy, the move.** *Built 4 Sep
   2026.* `core/canvasswitch.ts`, `web/lib/recents.ts`,
   `web/lib/canvasswitch.ts`, the palette's second face, ⌘O, the caret, the
   `?` panel row, the `switcher` journey.
2. **Everywhere a person stands.** The palette is mounted on `CanvasPage`
   only, so ⌘K and ⌘O do nothing on the home screen and on the lens. The
   home screen's filter is a field already; the lens is a list of canvases
   already. Mount the same window on both — the commands face has three
   actions that mean something off a canvas, and the switcher means the
   same thing everywhere.
3. **Spaces as headings.** Roles phase 4 gave a home spaces (`Space`,
   `listSpaces()`), and the home screen draws a heading per space. With no
   query the switcher should too, under Recent: a person who works in a
   space thinks in it. With a query, one ranked list, as now.
4. **A shared "lately".** Decide, once, with the inbox's seen-marks: either
   visits stay a browser's business (and the lens's per-actor rows are the
   cross-device answer) or a per-actor visit mark becomes desk state at the
   home. Not before multi-identity's resume is something people actually use,
   because that is the first time two browsers would disagree.
5. **The project › canvas row.** When a project holds more than one canvas,
   a row is `Project › Canvas`, the fuzzy match runs over both names, and
   Recent stays a flat list of canvases because that is what you go to. The
   address already reads right for it: `/p/<project>` was named for the
   project and can grow a canvas segment without moving.

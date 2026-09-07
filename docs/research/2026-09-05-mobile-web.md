---
status: designed
since: 2026-09-05
issue: 182
see: multi-identity, workbench, on-demand, ui-refresh
note: measured 5 Sep on a 375×812 viewport — the canvas cannot be moved with a finger, the chrome overlaps, the Chat fits by accident and the deck fits on purpose; the field draws one line (a phone views, comments and presents; a tablet edits); recommends touch physics for every coarse pointer, a phone face built from the Chat, the viewer and the deck, and no native app. Nothing built
---

# Mobile web: a phone talks to the canvas

**5 September 2026.** Tracked as
[#182](https://github.com/dglazkov/isocan/issues/182), which holds the
decisions this note leaves open.

The question, as asked: *canvases are hard on mobile, so how do we make
this experience responsive? Do we make it just the chat experience? Think
through a variety of approaches and explore what others have done —
Figma, Miro and the rest.*

The short answer is that the field has already answered the first half and
isocan's own shape answers the second. Every canvas product that has faced a
phone drew the same line — **a phone views, comments and presents; a tablet
edits** — and isocan has, by accident and on purpose, three surfaces that
already fit a phone: the Chat, the viewer face, and the deck. What it lacks
is not a mobile layout but **touch physics**, which is not a mobile feature
at all.

## What was measured

The app was served from `main` at `8a470cde` by `isocan serve` on a scratch
home and opened in a 375×812 viewport under Android Chrome emulation
(`maxTouchPoints` 5, device pixel ratio 2). Every number below is a
`getBoundingClientRect` or a line of source read the same afternoon.

### The canvas page

| What | Measured | Consequence |
| --- | --- | --- |
| Pan | `CanvasViewport.tsx:408`: `wantsPan = e.button === 1 \|\| (activeTool === "hand" && e.button === 0)` | A one-finger drag on empty canvas is a **marquee**. The canvas cannot be moved with a finger unless the Hand tool is up. |
| Pinch | Two zoom paths: a `ctrlKey` wheel (Chrome and Firefox trackpads) and WebKit's `gesturestart`/`gesturechange` (Safari trackpads). No code tracks two pointer ids. | **No pinch.** Zoom is the +/− buttons. |
| Browser gestures | `.canvas-viewport { touch-action: none }` | The browser's own pan and pinch are switched off too, so the page does not even scroll. Correct for a canvas that handles touch itself; a trap for one that does not. |
| Rail | 397px tall, 52px wide, at x 303–355 | Fits vertically at 812 (the 5 Sep short-window fix); covers 14% of the width. |
| Bottom-left and bottom-right | Minimap 168px wide (x 20–188), zoom cluster 194px wide (x 161–355) | **They overlap by 27px.** |
| Touch targets | Smallest eight buttons on the page: 20, 21, 21, 24, 24, 26, 28, 29px | Below the 44px floor both platforms publish. |
| Media queries | One `max-width` rule in the whole stylesheet (`720px`, the front page's grid); no `pointer: coarse` or `hover: none` anywhere | The app has never asked what it is running on. |

The top toolbar (name, Share, live, identity) spans the full 375px and
survives; the left dock strip (Chat, agents) sits at x 20–68 and survives.

### The surfaces that already fit

| Surface | Measured at 375px | Verdict |
| --- | --- | --- |
| **The Chat** (the docked main-thread panel) | 320px wide, 718px tall, leaves **35px of canvas**; composer present; mentions, slash commands and agents' replies all in it | A usable phone surface **today, by accident** — it is nearly full-screen and it is the thing that reaches everyone. |
| **The deck** (`<canvas>/deck`) | Two pages, each 335px wide; `scrollWidth` 375 = viewport | **Fits.** Built 4 Sep for print, it is the one route designed for a page rather than a viewport. |
| **The workbench** (`<canvas>/w`) | Agent column 340px; stage **2px** wide; no inspector | The agent column is another phone-shaped surface; the stage collapses to nothing. |
| **The front page** (the canvas list) | Layout viewport **446px** on a 375px device; one column of 327px cards | A minimum width somewhere forces the page to zoom out. |
| **The viewer face** (#88, a view admission) | Not measured on a phone — it is behind an admission — but read: keys only, `FLIP_NEXT`/`FLIP_PREV` arrow and Page keys, a 2.5s chrome rest | The right face for a phone, with no touch input yet. |
| **FullScreen** (presenting) | Same keys, a Back button and a Notes button; no tap zones, no swipe | Same. |

One more measured fact frames everything: a phone cannot run the daemon.
Mobile web is a question about **hosted homes** — isocan.io, dev, or a
`pass` — and about nothing else. Whatever is built here is reached through
the door multiuser built, never through `localhost`.

## What the field does

Read from each vendor's own documentation on 5 September 2026; quotes are
theirs, verdicts are mine.

| Product | Phone | Tablet | Source |
| --- | --- | --- | --- |
| **Figma** | Browser: "you can only access a View Only version"; "the file browser is no longer supported on mobile phone web browsers". App: search, view, comment on files, boards, decks and prototypes; test prototypes; mirror a frame from the desktop. "It's not possible to edit Figma Design files or Figma Slides decks using the mobile app." | FigJam is editable "within the Figma iPad app"; tablets with a desktop OS edit FigJam in the browser. | [system requirements](https://help.figma.com/hc/en-us/articles/360039827194-What-are-the-system-requirements-for-Figma), [mobile app guide](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app), [prototypes on a phone](https://help.figma.com/hc/en-us/articles/360040321093-View-prototypes-on-a-mobile-device) |
| **Miro** | The app does "create, view, and edit all your boards", reviews and resolves comments, demos a board from the phone, and turns a **photo of paper stickies** into digital ones. Apple's listing: "basic functionality for the iPhone and full-featured app for the iPad". | Pencil, lasso, drawings converted to shapes, highlighter. | [App Store](https://apps.apple.com/us/app/miro-your-visual-workspace/id1180074773) (the help centre refuses automated readers) |
| **Lucidspark** | "If you access Lucidspark using a browser on a phone you will be able to view existing boards but will not be able to edit them or create new ones." "There is not a Lucidspark mobile app; efforts are focused on creating a great browser experience." | "For the best mobile experience we recommend using Lucidspark on a browser on a tablet. There you'll be able to create new boards and edit existing ones with touch capabilities including freehand drawing." | [Lucid community](https://community.lucid.co/product-questions-3/using-lucidspark-on-mobile-devices-5394) |
| **Whimsical** | "You can access your account to view boards and add comments directly from your mobile browser." No app. | — | [Whimsical FAQ](https://whimsical.com/learn/faqs/mobile) |
| **Slack canvas** | Text edits; "not currently possible to add objects or a cover image to a canvas on mobile"; "we strongly recommend using a Bluetooth keyboard". | — | [Use a canvas in Slack](https://slack.com/help/articles/203950418-Use-a-canvas-in-Slack) |
| **tldraw** (the SDK) | One canvas for mouse, touch and stylus; eight portrait breakpoints at **389, 436, 476, 580, 640, 840, 1023px**; on a phone the style panel leaves its corner for a popover off the toolbar, and the toolbar hides while the keyboard is up. | Same code. | [ui components](https://tldraw.dev/sdk-features/ui-components), [`constants.ts`](https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/ui/constants.ts) |
| **Excalidraw** | "Primarily optimized for desktop use." The touch meta-issue's open items: two-finger zoom draws a line between the fingers, palm rejection, context menus, links that do not open, no buttons for keyboard-only features. Touch zoom was **disabled in pen mode** because "hand-triggered zooming occurred too often". | — | [issue #9705](https://github.com/excalidraw/excalidraw/issues/9705), [v0.11.0 notes](https://github.com/excalidraw/excalidraw/releases/tag/v0.11.0) |
| **Apple Freeform** | Native on iPhone: finger drawing, pan and pinch, boards in iCloud. | Pencil. | [Apple newsroom](https://www.apple.com/newsroom/2022/12/apple-launches-freeform-a-powerful-new-app-designed-for-creative-collaboration/) |
| **Linear** (not a canvas) | An inbox and a place to answer — "Tap to take action, swipe to delete, snooze" — explicitly not the desktop's roadmaps and automations. | — | [linear.app/mobile](https://linear.app/mobile) |
| **Obsidian Canvas** | The help page says nothing about touch at all. | — | [help](https://obsidian.md/help/plugins/canvas) |

Three things stand out.

1. **Nobody makes the phone edit an infinite canvas in a browser.** The ones
   with web-only products (Lucidspark, Whimsical, Figma's browser) make the
   phone a viewer with comments. The ones that edit on a phone (Miro,
   Freeform) do it in a native app and still call the phone the basic
   version. Figma removed the file browser from phone browsers rather than
   fix it.
2. **The phone-native gestures are about getting things *onto* the canvas,
   not arranging them.** Miro's photo of stickies; Figma's mirror, which
   makes the phone a display for the desktop. The arranging waits for the
   tablet.
3. **The SDKs that do run one canvas everywhere pay in physics, not
   layout.** tldraw's breakpoints move two panels; Excalidraw's open list is
   almost entirely input: pinch, palm, long-press, links. That is the cost
   isocan would actually pay, and it is the cost that is worth paying for
   the iPad regardless.

## Two findings that decide the design

**The field's line is isocan's line already, for a better reason.** On a
Figma file a phone views because editing needs precision. On an isocan
canvas the thing a phone is *for* is **talking to the people and agents on
it** — asking, answering, reacting, choosing between two versions — and that
surface exists: the Chat reaches every collaborator with no @-mention, `wait`
wakes an agent parked on it, slash commands are comments, a reaction is a
vote, and `choose` is one tap. All of it lands as ops the desktop and the CLI
see. The canvas is where the work lands; the phone is where it is asked for
and looked at. "Just the chat experience" is therefore not a retreat. It is
the product's asynchronous face, and it happens to be the one that already
fits a 375px window with 35px to spare.

**Touch physics is not a mobile feature.** One-finger pan on empty canvas,
two-finger pinch about the midpoint, tap to select, long-press for the menu
that right-click opens, and a drag that starts on an item moving it — these
are the iPad's and the touchscreen laptop's too, and the Hand tool's
existence shows the pan already has a code path. It is all `CanvasViewport`
work on pointer events: **zero ops, no layout change, no new route**, keyed
on `pointer: coarse` rather than on width, so an iPad in landscape gets it
at 1024px and a narrow desktop window does not.

## Approaches weighed

Each costed against what exists. "Ops" is the number of new operations,
which has been zero for every feature this fortnight and should stay so.

| # | Approach | What a phone gets | Cost | Verdict |
| --- | --- | --- | --- | --- |
| A | **Chat-only below a breakpoint.** The route renders the main-thread panel full-width and nothing else. | Ask, answer, react, `/ask`, `/variation`; agents reply. Nothing to look at. | A day. Zero ops. | Right instinct, wrong stopping point: the moment an agent says "done" you want to see the card. The Chat is the spine of the phone face, not the whole of it. |
| B | **The viewer face as the phone's canvas.** The view-only face (#88) — slides, flip, chrome that rests — for everyone below the breakpoint, not just view admissions. | Look at one item at a time, well; flip through the deck. | Touch input for `Viewer`/`FullScreen` (tap zones, swipe): a day. | Part of the answer: the item-at-a-time view is what a phone does best. Not the answer alone — it has no way to ask. |
| C | **A responsive canvas proper.** Touch physics plus a phone layout: the rail folds to three tools, the minimap goes, panels become bottom sheets. | The real canvas, moved by finger, read-mostly; edits possible but fiddly. | Physics two to three days; layout two days; every popover re-anchored. Zero ops. | The physics half is mandatory and pays for the iPad. The layout half is where the field stopped, and for the same reason: a 375px window shows a canvas at 6% (measured: the world transform's scale was 0.06 with a two-slide talk fitted), which is a minimap with pretensions. |
| D | **Workbench first.** Below the breakpoint the canvas route opens the workbench: agents column, stage on tap. | Agents and their files; the stage as a second screen. | The stage already collapses to 2px; making it a tab is a day. | The workbench is for a person *working with* agents on files. On a phone that is the Chat's job with less ceremony. Keep as the agent tab of the phone face, not its front. |
| E | **The canvas as a feed.** A list of items newest-first — the files panel is already "the canvas as a list of files" — each row opening the viewer. | Everything on the canvas, scrollable, tappable. | A day on top of B. | The strip under the Chat in the recommendation. Not a front page: a canvas is spatial and a feed throws the arrangement away, but on a phone the arrangement is what you cannot see anyway. |
| F | **A PWA with a share target.** Install to the home screen; the OS share sheet sends a link, a photo, a screenshot to a canvas as an item. | The one phone-native thing: putting things *on* the canvas from where a phone already is. | Manifest and share-target handler; the service worker exists. Zero ops (`item.add` with a blob). | Miro's stickies-from-a-photo, generalised. Worth doing once the phone face exists; pointless before. |
| G | **Device handoff.** "Open on another device…" — a short link or QR that opens this canvas on the phone as the same person. | Getting to the canvas at all, as yourself, without typing a URL and proving an address again. | multi-identity deferred exactly this pass; the mechanism (resumption across browsers) is built and unreached. | Not a mobile feature but the mobile feature's door. Stage 3. |
| H | **A native app.** | Freeform's physics. | A second codebase, two stores, and the isomorphism broken (the CLI and the web share core; a native app would not). | Refused. Every reason isocan is one product is a reason not to. |

## Recommendation

Staged, each stage a thing a person can use, none needing the next.

**Stage 0 — touch physics for every coarse pointer, and the chrome
un-broken at 375.** *(Built 7 Sep 2026, except the touch targets and the rail
fold — see below.)* In `CanvasViewport`: a single pointer of type `touch`
that lands on empty canvas pans; a second pointer starts a pinch about the
midpoint (replace, do not extend, the marquee — Excalidraw's line-between-
the-fingers bug is what happens when the first gesture keeps running);
tap selects; long-press opens the menu `onContextMenu` opens; a drag that
starts on an item moves it, as today. Keyed on `(pointer: coarse)`. In the
stylesheet, below 640px: the minimap folds (its fold state already exists),
the zoom cluster keeps its place, the rail folds to **Hand · Comment · +**
with the rest under the +, every target 44px. The front page loses its
minimum width. Zero ops. Test: a pointer-event script that drives two
synthetic touches and asserts the world transform, beside the existing
wheel tests.

**Stage 1 — the phone face.** Below 640px the canvas route renders three
tabs on a bottom bar, in this order: **Chat** (the main-thread panel
full-width, the composer above the keyboard), **Canvas** (the stage-0 canvas,
read-mostly, with the strip of what is on it — approach E — as a sheet you
pull up, each row opening the viewer for that item), **Agents** (the
workbench's column, its stage opening the same viewer). The Chat is first
because it is what a phone is for here, and because an agent's "done" in it
is the link to the card. Nothing new is stored; the tab is UI state like the
panel's open-ness today.

**Stage 2 — present from a phone.** `Viewer` and `FullScreen` take a tap on
the right third for next, the left third for back, a horizontal swipe for
either, and the Notes button becomes a sheet. The deck route already fits
and stays the printable, linkable copy. This is the demo-from-your-phone
Miro sells and Figma's prototype link delivers, and it is the smallest
stage.

**Stage 3 — handoff.** The pass multi-identity left for later, built for
the reason a phone gives it: a QR in the Share dialog and an `isocan open
--phone` that print a short-lived link opening this canvas as the same
person, using the resumption mechanism that is built and unreached. Only
meaningful on a hosted home, which is where a phone can reach anyway.

**Stage 4, if the face earns it — install and share target.** A web app
manifest and a share-target handler so a photo, a link or a screenshot from
the phone's share sheet lands on a canvas as an item, into the Chat as a
comment, or both.

**Refused.** A native app (H). Editing an HTML screen's source on a phone —
the stage editor stays a desktop instrument and the phone face never offers
it. A second, mobile document model: the phone reads the same log through
the same reducer, or it is not isocan.

## What the touch half shipped, and what it decided

**7 September 2026.** `pinch` in `web/lib/viewport.ts` and the pointer
bookkeeping in `CanvasViewport`. Driven with real `Input.dispatchTouchEvent`
on a 375×812 Android emulation before it landed: a one-finger drag moved the
world transform, two fingers spreading 80px to 176px scaled by 2.2, and **the
world point under the fingers drifted 0 world pixels**.

Three decisions the recommendation did not settle.

**Lifting one finger ENDS the gesture rather than becoming a pan.** Continuing
as a one-finger pan from a hand that is mid-pinch lurches the canvas on the
frame the second finger leaves, because the remaining finger is nowhere near
where a pan would have started. Ending is a canvas that stops; the person puts
a finger back down, which costs nothing.

**A pinch does not coast.** A flick out of a zoom is a hand leaving the screen,
not a throw.

**Every finger is pruned at the viewport, not inside each gesture.** The pan
and the pinch each forget their own pointer, but a touch that starts something
else — a stroke, an item drag, a tap on a card — reaches neither, and the map
then holds a finger nobody is touching so the next single touch counts as the
second. Found by driving two separate single touches in a row.

The one thing the note asked for and did not get is **long-press for the
context menu**. It wants a device to judge the hold time against, and the
gesture it competes with (a pan that starts slowly) is exactly the one just
built.

## And the chrome, un-broken at 375

Two of the three things this note measured on 5 Sep, fixed the same afternoon
as the touch half.

**The front page scrolled sideways.** Its header row was 428px of content in a
327px box, so the identity button — the way to see who you are and to leave —
sat off the right edge of the phone. `flex-wrap: wrap`, and not a breakpoint:
the row already knows when it has run out, and a breakpoint is a second
opinion about the same fact in pixels that stop being true when somebody adds
a button here.

**The minimap and the zoom row overlapped by 27 pixels.** They stack now below
460px. Two things worth keeping:

- **Stacking, not folding.** This note recommends folding the map, and the
  fold writes `isocan.minimap` to localStorage — so a WIDTH would decide a
  PREFERENCE, which then follows the person to their desktop as a setting they
  never chose and cannot connect to anything they did. Stacking is CSS, holds
  no state, and comes back on rotation.
- **460 is arithmetic, and it is approximate on purpose.** The two meet around
  405 — around, because the zoom row is as wide as the percentage it happens to
  be showing, so "100%" and "25%" collide at different widths, and a breakpoint
  set at the collision would be set at one of them. 460 clears the widest
  reading with 51 measured pixels to spare. Not this note's 640: between 405
  and 640 the clusters sit 231px apart, and moving chrome there is chrome
  moving for no reason.

**Not fixed: the touch targets.** Fourteen controls are still under the 44px
floor, the smallest 20×20. That is not one declaration — at 375px you cannot
give all fourteen 44px without changing the layout, and adjacent ones (the
zoom's − and +) would swallow each other's hit areas if each simply grew. It
wants the rail fold this stage also names, which is a design pass rather than
a fix.

## What this leaves open

Written up as the decisions in #182:

1. **Chat-first or canvas-first.** The recommendation puts the Chat on the
   first tab. It is the one choice here that changes what a person sees
   first, and it is a product decision rather than a measurement.
2. **Width or capability.** Layout by width (`max-width: 640px`, tldraw's
   TABLET_SM line), physics by pointer (`pointer: coarse`), is the
   recommendation; an iPad in portrait at 768–834px sits on the line and
   would get the physics without the phone face, which is probably right.
3. **Sequencing against hosting.** Stage 0 helps the iPad on a LAN today.
   Stages 1–4 only matter where a phone can reach a canvas, which is
   isocan.io, dev, or a pass; the strongest argument for #91 in a while is a
   phone in a pocket and a laptop that is closed.

## What was not measured

A real phone. The emulation gives the right viewport, pixel ratio, touch
points and user agent, and the source reads the same on any device, but the
virtual keyboard's effect on the layout, Safari's toolbar collapse and the
feel of a pinch were not observed and are the first things stage 0 should
try on glass. The Miro help centre and the tablet page behind it refused
automated readers; the App Store listing was used instead.

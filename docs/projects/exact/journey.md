---
status: partial
since: 2026-11-13
see: workbench, proactive, critique, personas, design-competition, wireframes, motion, version-diff, mobile, moodboard, modules
note: phases 0–3 of 11 closed by 14 Nov 2026 — behind the `exact` experiment, `isocan exact open` lays an Exact app out as a flow map (every route on three devices and two schemes, labelled router arrows, `app.tamber` as the design system, anatomy cards) captured on the web, an iOS simulator and macOS, with a device wall per route and host differences as comments, and `isocan exact live` keeps it true on save; on a loopback home screens go Live through a paired bridge and Alt-click names the Contract line in live frames and captures alike; any screen on any host can be driven from the canvas, and with *Live frames* off that still works, through the canvas, while the browser never contacts the machine. An experimental module (`@isocan/exact`) that makes the canvas the place an Exact app is built end to end — Expo's Exact (expo/exact), where one Contract source runs natively on the web, macOS, iOS, Linux and Android and an agent can build, drive, see and test it on every host. Point isocan at an app and the canvas becomes its map — every route a real screen on every device, flows drawn from the router, the Tamber tokens as the canvas's design system. Live frames click back to the Contract line that drew them; agents' changes arrive as proposals rendered on every device at once; tests are storyboards of real frames; the deterministic clock becomes a scrubber over any interaction; and a signed OTA update ships from the canvas, classified before it leaves. Built on what Exact already exposes — the agent driver's ten operations, `contract build --json`, the development source map, and the Tamber wire (pairing, `propose`, `inspect`, `outline`, live token fan-out) — so isocan adds no compiler, no runtime and no new operation. Exact Design (diegoag64/exact-design) is the reference studio this learns from and links to, not one it replaces.
---

# Exact on the canvas

This is the **ideal**: an Exact app is a few hundred lines of Contract that
run natively on five hosts, and an agent can drive every one of them. The
canvas is where that should be *seen* — the whole app at once, on every
device, live, with the people and the agents who are changing it — and where
it should be *shipped from*.

The mechanism is [`design.md`](design.md); the walk is
[`phases.md`](phases.md).

## The sentence

> **Point isocan at an Exact app and the canvas becomes the app: every
> screen on every device, live, each pixel one click from the line that drew
> it — and the update that ships it leaves from the same board.**

## Why Exact, and why a canvas

Exact was built for agents: ten operations (`tree · screenshot · tap · type
· state · layout · logs · clock · prefer · perf`) the same on every host, a
clock the agent owns, compiler errors as JSON with stable ids, and a source
map from any node on screen to its line. What it lacks, on purpose, is a
place to *look*: "a devtools UI" is out for v1, and Exact Design shows one
app's previews on its own canvas, for one person.

isocan is that place already — a canvas where agents and people work
side by side, with versions, comments, proposals and presence. Exact's
machine-readable everything is exactly what a canvas can lay out. Neither
side has to grow much: Exact already speaks; isocan already listens.

---

## Scene 1 — The app, all of it

Maya has an Exact app, Acme Market, in `~/code/acme-market`: a tab bar of
four routes, a product page, a cart sheet, an `app.tamber` of tokens and two
test files. She runs:

```sh
isocan exact open ~/code/acme-market
```

**She sees** a new region on the canvas called *Acme Market*:

- **The flow map.** Every route in `routes.json` as a real screenshot, laid
  out the way the router reaches them — the four tabs in a row, the product
  page pushed from Browse, the cart sheet hanging under it — with an arrow
  for every `open`, `push` and `back` an action can take, drawn from
  `contract symbols`. Each screen is captured by the agent driver at a fixed
  seed, locale and clock, so the picture is the same on every machine.
- **The device row.** Under each screen, the same route at phone, tablet and
  desktop sizes, light and dark — the matrix Exact Design shows, as items.
- **The design system.** `app.tamber` as the canvas's design system item:
  colours, type, lengths, motion, each token showing where it is used
  (`tamber uses`).
- **The anatomy.** Components, shapes, sources and grants as a compact
  card per file; `isocan context` now answers "what is this app?" for any
  agent that joins.
- **The tests.** Each `test` block as a storyboard (Scene 5), not yet run.

**The point**: nobody drew this. It is the app's own description of itself,
laid out — and it stays true, because a save re-captures what changed.

## Scene 2 — Live, and one click from the line

Maya presses **Live** on the Browse screen. The screenshot becomes the
running app — the dev loop's page, framed on the canvas — and the three
device sizes under it go live with it. She edits `app.contract` in her
editor; all three frames change a tenth of a second later.

She **Alt-clicks** the price label in the tablet frame. The selection is
joined to source through the development map: the canvas shows
`browse.contract:42:7 · text price · class Price`, highlights the same node
in every other live frame (`outline`), and offers **Open in editor** and
**Comment on this line**. Her comment is pinned to the node *and* the line;
when an agent picks it up, it already knows which file to touch.

A red badge sits on the cart screen: the compiler's `--json` diagnostics,
each one a comment pinned to the screen its file draws. Another sits on the
product page from `agent check both`: *the "Add" button is 38 px tall on
phone, under the 44 px target.*

Her colleague Sam works on a laptop where nothing should reach into local
processes, and has *Live frames* off in Settings. Sam sees the same screens as
captures, refreshed on every save, and can still drive and point at them —
just a capture behind instead of live.

**The point**: the canvas is the inspector Exact left out — and every finding
lands where a person and an agent will both see it.

## Scene 3 — Every device, really

**Native** under the cart screen shows the iOS Simulator and the Mac build,
captured through the same driver and refreshed after every build; an
`EXACT_VNC` Linux build streams live. Maya's iPhone, plugged in, appears as a
fourth device. A *Device wall* item gathers one route on all of them, for a
review or a slide.

When the iOS frame differs from the web frame where it shouldn't, the
canvas says so: `screenshot compare` names the region, and the difference
is a comment, not a hunch.

**The point**: "write the web, ship the platform" is only believable if you
can see the platforms side by side. Here you always can.

## Scene 4 — Time is a scrubber

The cart sheet springs open. Maya selects the cart screen and chooses
**Film the interaction**: the driver taps *Cart*, then advances the virtual
clock frame by frame (`screenshot over 600 every 16`). A filmstrip lands
beside the screen; dragging across it scrubs the spring. The state panel
under the strip shows the component's `state` at each frame.

She leaves a comment at 180 ms — *"overshoots"* — and the comment remembers
the time, as a motion comment does.

**The point**: Exact's clock belongs to the agent, so motion can be
*looked at*, frame by frame, on every host — and pointed at.

## Scene 5 — Tests are storyboards

`checkout.test.contract` sits on the canvas as a row of frames: each step
(`tap "add"`, `expect text "count" == "1"`) under the screenshot it acted
on. **Run on all hosts** runs it on web, iOS and macOS; each row turns green
or stops red at the step that failed, with the frame and the tree at that
moment.

Then the other direction. Maya presses **Record** on the live Browse frame,
taps a product, adds it to the cart, and stops. The canvas writes the test:

```contract-test
test "add from browse"
  tap "product-acme-mug"
  tap "add"
  expect text "cart-count" == "1"
```

— with the `expect` lines proposed from the state that changed, for her to
keep or drop.

**The point**: a test you can see is a test a designer can read, and
writing one is just using the app.

## Scene 6 — Agents propose; the canvas shows every device

Maya asks in the Chat: *"make the product page feel more premium."* The
lead agent, paired with **propose** scope only, sends Tamber proposals —
token edits and `set-row` style edits — never writes. Each proposal is a
dashed card under the product page (proactive's proposal item): before and
after, on phone, tablet and Mac, in light and dark, side by side.

She asks for three directions instead. Three agents each propose; the
canvas renders all three on every device and the room votes with reactions.
**Accept** on the winner is Tamber's `accept`: the files change, every live
frame updates, and the proposal card becomes the version that recorded it.

She drags a token chip on the design system item — corner radius — and
every live frame on the canvas scrubs with it, on every host at once
(Tamber's live table), until she lets go.

**The point**: an agent's idea is a picture on every device before it is a
diff — and nothing lands until a person says so.

## Scene 7 — Ship it from the board

The *Release* lane sits at the right of the region: channels as rows
(`internal`, `production`), releases as cards. Maya presses **Prepare**.
The canvas runs `deploy.mjs`'s dry run and shows its classification *as a
card*: which changes go over the air (plan, assets, TypeScript) and which
need a new binary — the product page's new native module, flagged red with
its reason. She moves that change out, prepares again: everything is OTA.

**Ship to internal** asks *her* — a person, never an agent — to confirm, then
signs and publishes with the keys on her machine. A QR code item appears
(AppDrop's install link); her teammate scans it and sees the new cart on
their phone within the check interval. The release card links every screen
it changed, as before-and-after versions.

Two days later, **Promote to production** with a phased rollout. If the
crash counter on devices falls back, the card says so.

**The point**: from idea to a signed update on a real phone, nothing left the
canvas — and the irreversible step was a person's.

## Scene 8 — From a sketch to Contract

Maya's colleague sketched a new Wishlist flow with the wireframes module:
three screens, low fidelity. **Make it Exact** asks the lead to scaffold it:
a route, components in Contract that use the app's tokens and name no
colour of their own, a `shape` and a stub source, and a test from the
flow's arrows. The scaffold arrives as a proposal; accepted, the three
wireframes sit beside three real screens on every device.

**The point**: the canvas already holds intent (wireframes, mood boards,
motion); Exact turns intent into a native app; the module is the bridge.

## Scene 9 — Personas use the app

Run the **personas** against Acme Market: each one drives the live app through
the agent's operations — taps, types, waits — toward a goal ("buy a mug for
under $20"), and leaves a filmstrip of its path and a pinned note where it
got stuck. The critique lead summarises where they agreed.

**The point**: agents that can *use* an app, not just read it, are the
usability study a small team never has time to run.

---

## What is not here

- **A second editor.** Contract is edited in the person's editor or by an
  agent; the canvas edits through Tamber's own wire (tokens, style rows,
  proposals), with digest checks, never by rewriting files itself.
- **A runtime or a compiler.** isocan runs Exact's own tools from the
  person's checkout. If Exact changes daily (it does), the module follows its
  CLI and wire, not its internals.
- **Store submission.** App Store and Play upload stay the publisher's work,
  as they are in Exact. OTA delivery and AppDrop are in; TestFlight is
  Exact's "later".
- **Agents that ship.** An agent may prepare a release; only a person ships
  one.

## And back to Exact

Exact asks the agents that build with it to keep a diary of what was rough
and what was good. Building this module, our agents keep one — the view of a
*tool* built on Exact's tool interfaces, which few others will write — and
once it is built, it goes back to the Exact core team through Exact's own
`feedback`, when Dion says yes.

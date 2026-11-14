# Exact on the canvas — the walk

[`journey.md`](journey.md) is the ideal and [`design.md`](design.md) the
mechanism. Each phase ends with something a person can do, behind the
`exact` experiment, and switched off again by unticking it.

**Ordered so the doors are proven before anything leans on them.** Exact
changes daily and its framing guard, its agent session and its proposal
preview are the three facts this design cannot assume — so phase 0 measures
them. Then the map (useful on its own, and needs nothing live), then live
frames and pointing, then the other hosts, then time and tests, then agents
changing things, then shipping, then the team. The last phase turns the
canvas's other modules — wireframes, motion, moodboard, personas — into
Exact's inputs.

**Fixtures are synthetic**: an app called Acme Market, made with `exact new`
in a scratch directory that no canvas is bound to. Every reading of an Exact
interface is recorded as a dated fixture stamped with the Exact commit.

**Every phase keeps Exact's diary** (design §15): the builder runs `bun
exact.mjs feedback status` in the fixture app first, records friction with
`feedback note` as it happens, and writes the phase's Rough, Lean in, Needed
and Checkpoints before the phase closes. The conductor copies the fixture's
`.exact/diary/` into [`diary/`](diary/) with each phase, since the fixture
is scratch. Nothing is sent until Phase 10.

**Phase citations name their project**: `exact phase 2`.

**Where we are, 14 Nov 2026:** phases 0–6 CLOSED. An Exact app is a flow
map on the canvas (`isocan exact open`), kept true on save (`isocan exact
live`), captured on the web, a dedicated iOS simulator and macOS. Screens go
**Live**, can be driven, filmed and inspected; each `test` is a storyboard
that runs on every host; Record proposes a test. Agents pair at `propose`
scope only: `isocan exact propose` holds a Tamber proposal, pictured before
and after on every device, scheme and iOS as a proposal item; a person's
Keep is the only accept. Design-competition bouts on an Exact screen take
proposals as entries; a token chip scrubs web and iOS live frames together;
`isocan exact branch` captures a branch beside the current screens. A
release lane from `app.json`'s `deploy`: Prepare (agents may) posts Exact's
dry-run classification as a card; Ship, Promote and Roll back are a
person's, confirmed, signed with the keys on the machine. Next: **exact
phase 8**, teams and hosted canvases. Waiting on a person: the real-iPhone
walk of phase 7, and a yes to AppDrop (a hosted service and an Apple ID)
for install QRs.
---

## Phase 0 — The bridge, the index, and the three doors

**Status: CLOSED, 13 Nov 2026.** Two cold captures of Acme Market's four
routes are pixel-identical; the index's routes, read from Contract, equal
`routes.json`'s; the three facts were answered by runs (Trajectory).

- `@isocan/exact` with `core`, `web` and `cli`; the `exact` experiment.
- `isocan exact doctor`: the checkout (through the app's `exact.mjs`), its
  commit, Bun against Exact's pin, `setup --check` for the hosts asked for,
  and the Tamber protocol version from `hello`.
- `isocan exact open <app>`: the index of design §3 as an item, and one
  web screenshot per route at one size, posted as screens.
- **Measure the three facts** and write them into this file:
  1. which live-frame door (design §5) works inside isocan's two ancestors —
     Tamber's `canvas` gateway, a bridge proxy, or neither;
  2. whether Exact's agent session survives a rebuild, and the cost of a
     cold `agent` per operation if not;
  3. whether a held Tamber proposal renders without being accepted.

**Proof:** Acme Market's routes captured twice, from a cold start, pixel
identical; the index's routes equal `routes.json`'s; each of the three
facts answered by a run, not by reading, with the run's command in the
trajectory.

**The three facts, measured 13 Nov 2026** (Exact `0104e402`; the probes are
in [`probes/`](probes/), rerunnable):

1. **The live-frame door is a bridge proxy, drawn outside the HTML-item
   origin.** In an HTML item, the content origin's `default-src 'none'`
   blocks all three doors before `frame-ancestors` is consulted. In the app
   document, the plain loop fails `frame-ancestors 'self'
   http://127.0.0.1:<tool port>`, Tamber's gateway fails `frame-ancestors
   https://<its own TLS door>`, and only the proxy loads — where the page's
   registration is refused `421` (Origin), so the proxy must rewrite Origin
   too.
2. **The resident agent session survives a rebuild.** A heading edit saved
   mid-session showed in 1.0–1.5 s; warm screenshots take ~100–150 ms
   against ~1.9 s for a cold `agent web`.
3. **A held proposal does not render; a scrub does.** `propose` with hold
   answers 200 and the screenshot is pixel-identical to before; `preview`
   pins a mode, not a proposal (400). A Tamber scrub renders the change with
   `app.tamber` untouched, and `scrub-cancel` restores the original exactly.

### Trajectory

- **2026-11-13** — Fact 1: only a bridge proxy door loads, and not inside an HTML item (content origin `default-src 'none'`); its registration is refused 421 until Origin is rewritten too. Phase 2 builds the proxy in a shell-owned frame, the product change design §5 already names. `DOORS_MODE=app node docs/projects/exact/probes/fact1.mjs <app> <out> <iso> <canvas>`.
- **2026-11-13** — The fixture is scratch and its diary would not outlive the session, so it is kept in [`diary/`](diary/), copied with each phase; exact phase 10 gathers from there.
- **2026-11-13** — Fact 2: Exact's resident session (`scripts/agent-session.mjs`) survives a save; the live loop uses it, `open` keeps cold captures (≈1.9 s each), which are what make captures deterministic. `EXACT=<checkout> bun docs/projects/exact/probes/fact2.mjs <app> <port> <out>`.
- **2026-11-13** — Fact 3: a held proposal does not render; a scrub does, without writing. Phase 6 previews live-class proposals as a scrub, rebuild-class ones in a staged copy (Exact Design's fallback). `propose` and `scrub` classed one edit differently (rebuild vs live). `EXACT=<checkout> bun docs/projects/exact/probes/fact3.mjs <app> <port> <out>`.
- **2026-11-13** — The capture verbs run a release script, `scripts/exact-bridge.mjs`, through `runPackageScript` as motion's render does: a module may not spawn. It runs the person's own Exact only on a directory they typed; an `exact.app` path read off a canvas must never launch it unasked.

## Phase 1 — The map

**Status: CLOSED, 13 Nov 2026.** A fresh agent given only `--agent-help`
built the map on a new canvas; one component's text edit versioned exactly
the 12 screens that draw it; the version slider walks a screen's history.

- The flow map: screens laid out by tab and stack, edges for every router
  verb an action can take (design §3), drawn by `edges()` and exported by
  JSON Canvas.
- The device row: phone, tablet, desktop; light and dark.
- `app.tamber` as the canvas's design-system item, with `tamber uses`.
- The anatomy card per Contract file and `isocan context` rows.
- `isocan exact live` re-indexes on save and posts a version only when a
  screen's pixels change; captures skip when nothing they depend on moved.
- `exact.shots`: how a screen that needs state is reached, editable.

**Proof:** a fresh canvas that has never seen Acme Market, opened by an
agent through `--agent-help` alone, ends with the map; an edit to one
component's text produces new versions on exactly the screens that show it
and no others; version-diff's slider walks a screen's history.

### Trajectory

- **2026-11-13** — Design §3's question answered: `contract symbols` names a `path("route")` target as a `route` reference at its column, but not the verb, the action or `back(nav)`; the module reads those from the source range. `bun exact.mjs contract symbols app.contract` in the fixture.
- **2026-11-13** — A capture's key hashes the app's input files and the Exact commit, not the build: `web-build` output differs on every rebuild. So every save recaptures every screen, and versions land only where pixels changed — cost grows with screens × devices × schemes, which phase 2's resident session should cut.
- **2026-11-13** — The release CLI's startup ceiling (5.1 MB, `test/cli-bundle.test.ts`) was crossed by the map; the module's heavy half now loads inside its verbs (`cli-run.ts`, core handed over by `core-ref.ts`), leaving ~0.02 MB. Every later phase keeps its code off the startup path.
- **2026-11-13** — Open: `ModuleEdge` carries no label, so the JSON Canvas export drops the arrows' verbs; the module's own underlay shows them. Adding one is a core change, waiting on a decision that it is wanted.

## Phase 2 — Live, and pointing at lines

**Status: CLOSED, 14 Nov 2026.** On a scratch home an edit reached three live
frames in ~0.7 s; with the switch off the browser made 0 requests to the
bridge and Alt-click on captures named the same lines; a typo became a
comment and left when fixed; a fresh agent fixed a comment from its
`exact.source` alone.

- Live frames on the chosen door, paired once per machine (design §5).
  If no door works, this phase ships Drive mode (phase 3's) as the live
  view instead, and says so.
- **Live is switchable off**: the per-machine switch in Settings, the
  per-screen Live / Still toggle (off-screen frames drop back to Still), and
  `isocan exact live --no-frames`.
- Alt-click → `inspect` → the selection with file, range and style origin;
  `outline` across every live frame.
- Comments carrying `exact.source`, and *moved* when the digest changes.
- `contract build --json` diagnostics and `agent check both` findings as
  comments, resolved when they disappear.
- **Open in editor** and **Open in Exact Design**.

**Proof:** in a real browser on a scratch home, an edit in the editor
reaches three live frames; with the switch off, the browser makes no
connection to the bridge at all (its network log shows none) and every
other scene of phases 1–2 still works on captures; an Alt-click names the right line in two
components (one through a `class`); a typo becomes a comment on the right
screen and leaves when fixed; an agent given only a comment's
`exact.source` makes the fix without being told the file.

### Trajectory

- **2026-11-14** — The local-tool door needed no CSP change: the app document's `frame-src` already allows `http:` and it sets no `connect-src`. The door is gated in the shell instead — loopback home only, `exact` + `exact.local` (*Live frames*) ticked — and a test pins the app CSP string.
- **2026-11-14** — `runPackageScript` blocks, so the long-running bridge is its own release script, `scripts/exact-live.mjs` (dev loop, frames proxy rewriting framing and Origin, token-gated loopback API); it respawns the CLI with `--no-frames` as its capture loop.
- **2026-11-14** — Pointing with live frames off works on captures: each capture records the driver's `layout` (boxes joined to the source map) and `tree` (what is hidden) as `exact.points`, and Alt-click resolves in the browser. Design §5's "nothing else is lost" needed this; the first build pointed in live frames only.
- **2026-11-14** — Findings that disappear are `thread.delete`d (soft; `thread.restore` brings one back) — isocan has no resolve op. A source comment is told *Moved* once per move, not once per save.
- **2026-11-14** — Open: nothing on the canvas names the app's directory (design §2's `exact.app = {id, path}`, relative to a bound root, is unbuilt); the fresh agent found the file by its digest. Waits on a phase that binds canvases to a repo root — exact phase 8 at the latest.
- **2026-11-14** — Closed by exact phase 3: `outline` across several live frames of one route is built but was unproven — the walk had one live frame per route. Phase 3's device wall drew the mark in three live frames.

## Phase 3 — Every host, and Drive mode

**Status: CLOSED, 14 Nov 2026.** One `open` put the cart on web, iOS and
macOS side by side; a checkout was driven on the iOS frame from the canvas
to its confirmation, with *Live frames* on and off; the planted host
difference was named in a comment at its line.

- iOS Simulator and macOS captures through the driver, on dedicated
  simulators; a connected iPhone when there is one.
- Native builds joined to the dev loop with `--url`, recaptured each
  generation.
- `screenshot compare` differences as comments.
- The device wall item.
- **Drive mode**: clicks and typing on any screen, on any host, sent as
  driver operations.

**Proof:** Acme Market's cart on web, iOS and macOS side by side from one
command; a person checks out by driving the iOS frame from the canvas;
a deliberate layout difference between hosts is found and named.

### Trajectory

- **2026-11-14** — Drive mode as first built went through the local-tool door, so with *Live frames* off it was unavailable — breaking Scene 2's "Sam can still drive". The mechanism changed, not the journey: with the door shut the browser writes `exact.drive` on the screen (`item.update`), `isocan exact live` waits on the op log, replays it, and writes `exact.driven` with the fresh picture.
- **2026-11-14** — Native captures reach a route with `type <root> <path>` (native hosts take no route `--url`) on a simulator named by UDID; none is ever guessed. `--url <dev loop>` joins a native build to the dev loop once the loop's native half is built (~82 s cold), but Exact still re-bakes its plan per drive.
- **2026-11-14** — Exact holds no resident drive session a tool can keep, so every press replays the whole drive cold: ~10.5 s a step on iOS, ~3 s on the web. Compare comments only on `testId` order (tab bar aside), because each platform's own bars always differ in pixels.
- **2026-11-14** — Outline across several live frames of one route (phase 2's Open entry) held on the device wall: three live cells each drew the mark.
- **2026-11-14** — Open: a capture's `web-build`/`agent web` in the app directory breaks Tamber `inspect` in the running dev loop until it restarts (Exact cbe553f6), so pointing in live frames is unreliable while captures run. Waits on Exact; noted in the diary.
- **2026-11-14** — Open: ~3 of 28 iOS captures moved pixels with nothing changed (status bar pinned), versioning screens needlessly. Waits on a tolerance or on Exact.
- **2026-11-14** — Open: a live frame opens `exact.url` and ignores `exact.shots`, so the cart wall's live cells show the route's start, not the cart. Waits on a phase that drives live frames (exact phase 5's Record at the latest).
- **2026-11-14** — Open: a canvas drive's picture is a blob referenced only from `exact.driven`, so garbage collection can sweep it after its grace period. Waits on blob references from properties, or on phase 5 keeping drives as versions.

## Phase 4 — Time and state

**Status: CLOSED, 14 Nov 2026.** The cart sheet's spring filmed at 16 ms
twice gave byte-identical strips (from the CLI and from the canvas with
*Live frames* off); a comment at 180 ms scrubbed the strip back to the frame
drawn at 176; the inspector's `tree --ax` deep-equals the driver's.

- **Film the interaction**: an APNG or contact sheet against the virtual
  clock, with a scrubber, and comments at a moment.
- State per frame beside the strip.
- The inspector panel: `tree --ax`, `layout`, `perf`, `logs` for the
  selected screen.

**Proof:** the cart sheet's spring filmed at 16 ms twice, byte-identical;
a comment at 180 ms scrubs the strip back to 180 ms; the panel's tree and the
driver's printed tree agree.

### Trajectory

- **2026-11-14** — State per frame comes from a second cold driver stepping `clock +16` with `state` and `layout <watch>`: the clock only moves forward, so a film cannot be followed by reading its frames' state. Both drivers are deterministic, so the instants agree. It is kept as the property `exact.frames` (first frame whole, then changes), out of gc's reach.
- **2026-11-14** — A module is never told a thread is open; the scrub-to-moment rides the shell's `WebModule.comments` call, with a comment shown again after 1.5 s idle counted as reopened. A core "thread opened" hook would replace the heuristic.
- **2026-11-14** — Film, inspect and drive share one shape on both doors: the bridge when paired, otherwise a request property on the screen (`exact.filmAsk`, `exact.inspect`, `exact.drive`) answered by `isocan exact live`. The inspector panel is fresh from a cold driver, never the stored `exact.points`.
- **2026-11-14** — Open: native films are not byte-identical — on iOS, frames 0–3 differ in rows near UIKit's tab bar, composited outside Exact's clock — and iOS `layout` carries no `translate`. Films are web-only for now. Waits on Exact.
- **2026-11-14** — Open: comments at one moment stack their pins on the strip; the 1.5 s reopen heuristic can snap a strip back on a later re-render while a thread stays open. Waits on the core hook above.
- **2026-11-14** — Open: the paired bridge's `/film` is built and typechecks but no walk drove it; the canvas door's film and both inspector doors were walked. Phase 5's storyboards will drive the bridge path.

## Phase 5 — Tests are storyboards

**Status: CLOSED, 14 Nov 2026.** Acme's checkout test ran on web, iOS and
macOS from the canvas with *Live frames* off and on: web and iOS green,
macOS red at line 12 where a planted Hermes-and-fine-pointer bug renamed
`place-order`; a test recorded in Drive mode, kept, passed on all three
unedited.

- Each `test` block as a storyboard; **Run** per host, results as versions.
- **Verify on all hosts** (`verify`), its screenshots as versions of the
  screens they show.
- **Record** in Drive mode → a test proposal with proposed `expect` lines.

**Proof:** Acme's checkout test run on web, iOS and macOS from the canvas,
one host failing at the step a deliberate bug breaks; a recorded test,
accepted, passes on all three without an edit.

### Trajectory

- **2026-11-14** — Exact's `test` gives no reply per operation (design §9 assumed `--json` would), so Run hands `test <host>` a copy of the test with a `screenshot` after each step: the verdict and its wording stay Exact's; a cold `agent --json` replay to the failing step reads its tree. Frames ride inside the storyboard version, out of gc's reach.
- **2026-11-14** — Accept reaches disk through core's choose and `isocan exact live` watching the op log: the recorder only posts a proposal item; live writes the file when the kept text is the recorded base plus one test in the recorder's grammar and the disk still matches that base.
- **2026-11-14** — Open: only Verify's first-screen shots can be tied to a screen — its test-end shots name a test not a route, its desktop size (1280×900) is no canvas device, its relaunch shot names no route, and macOS has no verify leg. The rest are listed with the reason. Waits on Exact.
- **2026-11-14** — Open: a run version holds its frames (~2.4 MB across three hosts, iOS frames large); runs are invalidated only by a change to the test's steps, not the app's source; undoing a Keep does not un-write the file. Waits on use.

## Phase 6 — Agents propose

**Status: CLOSED, 14 Nov 2026.** A real turn asked to "make the product
page feel more premium" held proposals and changed no app file (its accept
refused, 403); three fighters of a design-competition bout proposed, the
room ranked them behind the curtain, and Keep on the winner changed
`app.tamber` and `app.contract` alone; a radius drag moved web and iOS live
frames together and release restored both.

- Pairing scopes from isocan's roles (design §10); agents get `propose`.
- Held proposals as proactive proposal items, before and after on every
  device and scheme.
- Several directions decided with design-competition's rounds; **Accept**,
  **Drop**, **Choose**.
- Token scrubbing on the design-system item across every live build.
- Structural changes from an agent's branch, captured beside the current.

**Proof:** a real agent turn asked to "make the product page feel more
premium" produces proposals and writes nothing; three directions rendered on
web and iOS, voted, one accepted, the files changed by the accept alone; a
scrubbed radius moves web and iOS frames together.

### Trajectory

- **2026-11-14** — Fact 3, extended: on iOS a scheme change drops an open scrub, so each scheme is scrubbed alone; a held `propose` carries no rendered text, so the plan is asked again unheld; Tamber refuses a cloned target, so rebuild-class previews build in a staging directory of their own (~2 min once, ~4.7 GB kept).
- **2026-11-14** — A `web-build` in the app directory leaves the dev loop's web pages ignoring Tamber; captures now build into their own `EXACT_WEB_DIST`, byte-identical either way. Likely the cause of phase 3's Open entry on `inspect`; not yet re-walked.
- **2026-11-14** — Directions are design-competition bouts: on a screen carrying `exact.route`, fighters are told to `isocan exact propose … --in <lane>` and hand the proposal in, and competition's **Take it** refuses in favour of Keep, so a winner never lands as a picture without its accept.
- **2026-11-14** — A bare `rc turn` gives the agent no canvas framing; the first one wandered out of its directory. An agent's working directory needs a standing note that it is on an isocan canvas.
- **2026-11-14** — Open: proposal items are posted by the bridge's actor (the person running `live`), with the agent named in the item; the five-proposal cap counts against the bridge, not the agent. Waits on module items authored on an agent's behalf.
- **2026-11-14** — Open: Exact's `set-row` rewraps the whole `app.contract`, so an accepted style edit diffs ~200 lines. Waits on Exact; noted in the diary.

## Phase 7 — Ship

**Status: CLOSED, 14 Nov 2026.** An agent prepared a release to a directory
origin (its hash unchanged) and a person shipped it; Acme Market, running on
the iOS Simulator, showed the new text in the same process 6.3 s after the
head was written (check interval 10 s), and a roll back reverted it within
4 s; an agent's ship and roll back were refused with a sentence, origin
unchanged; a grant change was named *needs a binary* by Prepare before
anything was uploaded.

- The release lane from `app.json`'s `deploy`.
- **Prepare**: the dry run's classification as a card — OTA, or *needs a
  binary* with the reason.
- **Ship** to a channel: a person only, confirmed, keys on the machine.
- AppDrop QR beside the release; **Promote** with a phased rollout;
  *Roll back* as a re-publish of the previous content, labelled so.

**Proof:** a release to a directory origin on a scratch machine, prepared by
an agent and shipped by a person, picked up by Acme Market running on the
iOS Simulator within its check interval; an agent's attempt to ship refused
with a sentence; a change that needs a binary named as one before anything
is uploaded. A person's walk on a real iPhone is owed separately.

### Trajectory

- **2026-11-14** — Exact's deploy counts git-ignored files (the app's own `.exact/`, a vendored crate's `target/`) as uncommitted, so a worked-on app never ships clean. Prepare and Ship refuse tracked or untracked changes, pass `--dirty`, and isocan pins the confirmed commit itself.
- **2026-11-14** — A channel in `app.json` is the URL clients bake in; Exact writes only to a directory. The person names the directory that host serves (`ISOCAN_EXACT_ORIGIN`); a channel naming a bare path fails on iOS.
- **2026-11-14** — Exact can report one change both over the air and *needs a binary* (installed binary inputs differ, compatibility id unchanged). The card shows both rows in Exact's words rather than choosing.
- **2026-11-14** — An agent's lane ask arrives as `group.change` on a canvas with groups; the earlier asks (run, verify, drive) read `item.update` only and would miss such asks too.
- **2026-11-14** — Open: the real-iPhone walk. Waits on a person with a device.
- **2026-11-14** — Open: AppDrop install QRs are not built; `share.mjs` uploads to appdrop.app (a hosted service) and needs a device build. Waits on a yes for the service and an Apple ID.
- **2026-11-14** — Open: phased rollout. `deploy.phased` and `deploy.release` are schema only in Exact's publisher; Promote says so, and every device takes the release at its next check. Waits on Exact.
- **2026-11-14** — Open: isocan's gate holds inside isocan only; an agent with a terminal can run Exact's `deploy.mjs` itself. The real boundary is where the signing keys live.

## Phase 8 — Teams and hosted canvases

**Status: NOT STARTED.**

- Exact's relay for HTTPS live frames on isocan.io.
- `read`-scoped live frames for paired teammates; captured items for
  everyone else.
- The device wall in mobile presenting.

**Proof:** a teammate on a second machine, on isocan.io, sees a live frame
of the first machine's dev loop and cannot change a token; their phone
installs the build from the QR.

## Phase 9 — From intent to Contract, and personas

**Status: NOT STARTED.**

- **Make it Exact**: a wireframe flow → a Contract scaffold (route,
  components on the app's tokens, a shape, a stub source, a test from the
  arrows), as a proposal.
- Motion items → Contract `keyframes`; moodboard and design-system tokens →
  `tamber import dtcg`.
- **Persona runs** against the live app through the driver: goals,
  filmstrips of each path, notes where they got stuck, a critique summary.

**Proof:** a three-screen wireframe flow becomes three Exact screens that
pass their generated test on web and iOS; two personas reach a goal and one
gets stuck where a deliberate dead end is.

## Phase 10 — The diary goes home

**Status: NOT STARTED.** After phase 9, or whenever the build stops.

- Gather every phase's diary from the fixture app into one, for a reader on
  the Exact team: what a canvas client needed from the Tamber wire, the
  agent session, the source map and delivery, and how each went.
- Show Dion what would be sent (`bun exact.mjs feedback`), with two to four
  quoted lines, as Exact's guide asks.
- On his yes only, `bun exact.mjs feedback send --yes`.

**Proof:** the receipt, recorded in this file's trajectory — or Dion's no,
recorded the same way.

---

## Trajectory

- **2026-11-13** — Specified against `expo/exact` at `0ebe9a2c` and
  `diegoag64/exact-design` at its 13 Nov head. Every Exact interface named in
  the design was read in source; none was run. The design leans on three
  facts it could not settle by reading (design §16), so phase 0 runs them
  first.
- **2026-11-13** — Decided (Dion): offer live frames through a paired
  local-tool door the shell owns, and let them be turned off — per machine,
  per screen and per bridge — with every other scene still working on
  captures and Drive mode (design §5).
- **2026-11-13** — Added (Dion): once built, an agent diary goes back to the
  Exact core team through Exact's own `feedback` protocol, on his yes
  (design §15, phase 10).

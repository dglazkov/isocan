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
and Checkpoints before the phase closes. Nothing is sent until Phase 10.

**Phase citations name their project**: `exact phase 2`.

**Where we are, 13 Nov 2026:** specified; nothing built.

---

## Phase 0 — The bridge, the index, and the three doors

**Status: NOT STARTED.**

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

## Phase 1 — The map

**Status: NOT STARTED.**

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

## Phase 2 — Live, and pointing at lines

**Status: NOT STARTED.** Depends on phase 0's door.

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

## Phase 3 — Every host, and Drive mode

**Status: NOT STARTED.**

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

## Phase 4 — Time and state

**Status: NOT STARTED.**

- **Film the interaction**: an APNG or contact sheet against the virtual
  clock, with a scrubber, and comments at a moment.
- State per frame beside the strip.
- The inspector panel: `tree --ax`, `layout`, `perf`, `logs` for the
  selected screen.

**Proof:** the cart sheet's spring filmed at 16 ms twice, byte-identical;
a comment at 180 ms scrubs the strip back to 180 ms; the panel's tree and the
driver's printed tree agree.

## Phase 5 — Tests are storyboards

**Status: NOT STARTED.**

- Each `test` block as a storyboard; **Run** per host, results as versions.
- **Verify on all hosts** (`verify`), its screenshots as versions of the
  screens they show.
- **Record** in Drive mode → a test proposal with proposed `expect` lines.

**Proof:** Acme's checkout test run on web, iOS and macOS from the canvas,
one host failing at the step a deliberate bug breaks; a recorded test,
accepted, passes on all three without an edit.

## Phase 6 — Agents propose

**Status: NOT STARTED.** Depends on phase 0's proposal fact.

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

## Phase 7 — Ship

**Status: NOT STARTED.**

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

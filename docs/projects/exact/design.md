# Exact on the canvas — the mechanism

[`journey.md`](journey.md) is the ideal; this is how it works, and where it
is still a question. [`phases.md`](phases.md) is the order.

**What Exact is, in one paragraph** (read against `expo/exact` at `0ebe9a2c`,
13 Nov 2026, and `diegoag64/exact-design`). An app is `app.contract` (the
view, state and actions in Contract), `app.ts` or a Rust crate (data
sources), `app.json` (manifest: hosts, deploy policy), optional `app.tamber`
(design tokens) and `*.test.contract`. The compiler turns Contract into a
*plan*; the web runs it on a ~20 KB runtime over the real DOM, and a Rust
runner runs it on macOS, iOS, Linux and Android with native presenters. The
app's own `exact.mjs` launcher reaches a source checkout of Exact (there is
no packaged CLI). Exact is pre-1.0 and changes daily, with no compatibility
promise — which shapes everything below.

## 1. The rule this module lives under

[`../modules/authoring.md`](../modules/authoring.md): a module adds only what
a person could already do with a file and a verb; it never adds an
operation, a protocol message, a server route, a hidden store, or a read of
the identity desk. Module state is an item, versioned; property keys are
namespaced (`exact.*`) and ours forever.

Everything here fits that rule because **Exact already speaks**. The module
is a translator between two systems that both expose their insides:

| Exact says | isocan holds it as |
| --- | --- |
| `routes.json`, `contract symbols --json` | screens (image items) and flow edges (`edges()`) |
| `agent <host> "screenshot …"` at a fixed seed | a screen's versions |
| `tamber ir` | the canvas's design-system item |
| `contract build --json` diagnostics, `agent check` findings | comments pinned to screens and lines |
| `contract test --json` (compiled tests) | storyboard items |
| Tamber `propose` (held proposals) | proactive's proposal items |
| `deploy.mjs --json` dry run, release records | release cards in a lane |
| `share.mjs --json` (AppDrop link) | a QR item |

Nothing the module writes is needed to read the canvas afterwards: take it
away and the screens are images, the storyboards are documents, the release
cards are text. That is the module test.

## 2. Where the work runs: the bridge

isocan runs no compute of its own; the sandbox and motion modules already
run programs on the person's machine through the CLI host. This module does
the same, with one long-running process per app per machine:

```
isocan exact open <app-dir>     # index, capture, bind — then exits
isocan exact live <app-dir>     # the bridge: stays up while you work
```

**The bridge** owns, for one app:

- the dev loop: `bun exact.mjs web --port <p>` with `EXACT_TOOL_PORT` set so
  its pages admit the frame (§5);
- a Tamber client with the loop's local token (`/__tamber/token`,
  loopback only), subscribed to `/__tamber/events`;
- a file watcher, so a save re-indexes and re-captures what changed (§4);
- a resident agent session (`scripts/agent-session.mjs` `open({host, seed,
  …})`) per host it drives, rather than one cold `agent` process per
  operation — the API is internal to Exact and undocumented, but **measured
  13 Nov 2026 (exact phase 0) it survives a rebuild**: a saved edit showed in
  about a second, warm screenshots take ~100 ms against ~1.9 s cold. `open`
  keeps cold captures, which is what makes them deterministic;
- the actor it posts as: the person who started it, or an agent's session
  when an agent started it — so `isocan activity` says who captured what.

**Binding the app**, after [`../workbench/files-on-disk.md`](../workbench/files-on-disk.md):
*intent* is a canvas fact — the app item carries `exact.app = { id:
"dev.acme.market", path: "apps/market" }`, `path` relative to the canvas's
bound root, so it replicates and a teammate who clones the repo inherits it.
*State* is per machine and derived: `live` (bridge running here), `bound`
(checkout here, bridge down), `unbound` (no checkout — the canvas still
shows every captured screen, read-only).

**Finding Exact.** The app's `exact.mjs` finds the checkout through
`EXACT`/`EXACT2`; the module asks it, never guesses. `isocan exact doctor`
names the checkout's commit, Bun's version against Exact's pin (Exact pins
1.4.2; a machine with 1.4.4 is warned, not refused), the Tamber protocol
version from `hello` (`tamber/1.18` today), and `exact setup --check`'s
answer for the hosts asked for.

## 3. Grokking an app: the index

`isocan exact open` builds one JSON index and lays the canvas out from it.
Every input is something Exact prints for tools:

- **Routes** — the web build's `routes.json` (`{routes:[{name, pattern,
  notfound?}]}`) and the `routes` blocks in Contract (tabs and their
  stacks).
- **Navigation edges** — `contract symbols --json` gives each action's
  definitions, references and inferred `writes`; the router verbs (`open`,
  `push`, `replace`, `back`) in an action's body name its destination.
  **Measured 13 Nov 2026 (exact phase 1):** `symbols` names the target route
  at its column but not the verb or the action, so the module reads those
  from the source range `symbols` already gives.
- **Components, shapes, sources, grants** — `symbols` and `app.ts`'s
  `export const grants`; one compact card per Contract file, and rows in
  `isocan context` (`contextPieces`), so any agent that joins can answer
  "what is this app" without reading it.
- **Tokens** — `tamber ir <app>` (the folded design IR) becomes the canvas's
  design-system item, each token carrying `tamber uses` (where it is used).
  Exports go back out as DTCG (`tamber export`), so isocan's existing design
  system tools and the moodboard can read them.
- **Tests** — `contract test <file>` (compiled tests as JSON).

The index is an item (`application/vnd.isocan.exact-index+json`), versioned
per capture, so "what did the app look like on Tuesday" is the version stack.

## 4. Screens: deterministic captures

A screen is an ordinary image item with properties:

```
exact.route  = "browse"          exact.host   = "web" | "ios" | "macos" | "linux" | "android"
exact.device = "phone"           exact.scheme = "light" | "dark"
exact.plan   = "<plan sha256>"   exact.at     = { seed: 1, locale: "en-US", zone: "UTC", epoch: "2026-01-01" }
```

Captured with the agent driver: `resize`, `prefer color-scheme dark`, `clock
settle`, `screenshot`. The driver's defaults (seed 1, en-US, UTC, a fixed
epoch) make the picture a function of the source, so:

- **a capture is skipped** when `(plan, route, device, scheme, host, at)` is
  unchanged, and
- **a version is posted only when the pixels change** — the version stack of
  a screen is the visual history of the app, commit by commit, and
  version-diff's slider works on it unchanged.

Reaching a route that needs state (a product page needs a product) uses
Exact's own launch lines — `at`, `before data`, `prefer`, `fail fetch` —
written into a small `exact.shots` property per screen, so the canvas holds
*how* each screen was reached, editable by a person or an agent.

## 5. Live frames — the hardest door

A live frame is the running dev page inside an isocan item. Exact guards it:
every dev-loop page sends `Content-Security-Policy: frame-ancestors 'self'
http://127.0.0.1:<EXACT_TOOL_PORT>` and no `X-Frame-Options`. isocan renders
items in sandboxed frames on a separate content origin, so a live frame has
**two** ancestors (the app origin and the content origin), and
`frame-ancestors` checks every one of them. Three doors, measured in phase 0
in isocan's real nesting before anything depends on one:

1. **Tamber's own canvas gateway** (`canvas` method): a 30-second,
   single-use grant to a proxied, rewritten view of the dev page, with a
   `__Host-` session cookie and `frame-ancestors` set to the paired tool's
   origin. Built for exactly this — a remote tool framing a running app. The
   question is whether it can name the content origin as the ancestor that
   matters, or both.
2. **A bridge proxy**, as Exact Design's element bridge does: the bridge
   serves the dev page on its own loopback port and rewrites the framing
   header for isocan's two origins. Works locally; it is ours to maintain
   against a moving SDK, which is the cost.
3. **`EXACT_TOOL_PORT` pointed at isocan's web port** — only if isocan's
   ancestors collapse to one loopback origin, which they do not today.

**Measured 13 Nov 2026 (exact phase 0): door 2, outside the HTML-item
origin.** Inside an HTML item no door loads — the content origin's
`default-src 'none'` blocks every frame before `frame-ancestors` is read. In
the app document, the plain loop and Tamber's gateway each fail their own
`frame-ancestors` (the gateway names only its own TLS door), and the bridge
proxy loads, but the page's registration is refused `421` until the proxy
rewrites Origin as well. So the live frame is drawn by the shell's paired
local-tool door below, never inside an item's content sandbox, and the proxy
rewrites both the framing header and Origin.

**Built 14 Nov 2026 (exact phase 2):** the door needed no CSP change on a
loopback home (the app document already allows `http:` frames and sets no
`connect-src`), so the shell gates it: open only when the home is loopback
and *Live frames* is ticked. Pairing is a one-use, two-minute code the bridge
prints; the token stays in that browser. Pointing on captures reads
`exact.points`, recorded beside each screenshot from the driver's `layout`
and `tree`, so live frames off loses no pointing.

**Getting the frame's address to the web.** A module may not add a server
route, and a grant must not sit in a replicated property. So the web module
talks to the bridge **directly on loopback**, paired once — the bridge
prints a code (Tamber's own pairing shape: one use, two minutes), the
person enters it on the canvas, and the browser keeps the bridge token for
that machine. The canvas holds only the stable intent (`exact.live = {
route, device, host }`); each viewer's browser asks its own bridge for a
fresh grant. No module slot reaches a loopback service today — the proposed
`host` (`WebHost`) sends ops and puts blobs through the home, nothing else —
so the browser-to-bridge connection is a product change, reviewed as one: a
narrow, paired "local tool" door the shell owns, which the sandbox and motion
modules could use too. **Decided 13 Nov 2026 (Dion): offer live frames, and
let them be turned off** (below).

**Live is a choice, and off is a whole answer.** Live frames run your app's
dev page inside the canvas and open a connection from your browser to a
process on your machine; some people, some machines and some canvases should
not have that. So:

- **One switch, per person and per machine**: *Settings → Experiments → Exact
  → Live frames*, on by default once the experiment is ticked. Off means the
  browser never pairs with the bridge and never opens the local-tool door —
  not "paired but hidden".
- **Per screen**, a **Live / Still** toggle on each screen: Still shows the
  latest capture and costs nothing; Live runs that one frame. A canvas with
  forty screens does not run forty dev pages because the switch is on —
  screens go live when asked, and a live frame scrolled far off-screen drops
  back to Still until it returns.
- **On the bridge**, `isocan exact live --no-frames` serves no frame grants
  at all, for a machine where the person wants captures, Drive mode,
  storyboards and shipping but no live page.
- **With live frames off, nothing else is lost.** Captures still refresh on
  every save, Drive mode (§7) still drives every host from the canvas
  through the driver, pointing at lines still works on captures (the driver's
  `tree` carries the source map's join), and proposals still render (§10:
  a scrub, or a staged copy — neither needs a live frame). Live
  adds immediacy — a tenth of a second instead of a capture — never a
  capability only it has.

**Hosted canvases** (isocan.io, HTTPS): a loopback `http://127.0.0.1` frame
inside an HTTPS page meets Private Network Access and mixed-content rules.
Exact's relay (`EXACT-RELAY/1`, SNI routing, a wildcard ACME certificate,
`<id>-canvas.<label>.<relay>` names) gives the dev page an HTTPS name;
phase 8 uses it.

## 6. Pointing: inspect, outline, comments on lines

- **Alt-click a live frame** → Tamber `inspect` → a `selection` joined to
  source through the development map (`app.plan.map.json`, keyed by the plan's
  SHA-256): file, range, call-site chain, and each style row's origin
  (`own`, `class:<Name>`, `tag`).
- **Outline everywhere** → Tamber `outline` with that source location: every
  running build — every live frame, on every host — highlights the node.
- **Comments on lines**: a comment made on a selection carries
  `exact.source = { file, line, col, sha256 }`. An agent picking it up reads
  the line directly. When the file moves under it, the comment says *moved*
  (the digest no longer matches), never silently re-anchors.
- **Diagnostics**: `contract build --json` (stable `id`, file, range,
  `related`; `app.ts` type errors appended) — one comment per diagnostic id,
  pinned to the screens that file draws, resolved by the bridge when the id
  disappears. **`agent check both`** findings (clipping, overlap, contrast,
  small targets) land the same way, at the region the finding names.

## 7. Native hosts and Drive mode

- **Captures** on iOS (Simulator or a connected iPhone), macOS, Linux and
  Android through the same driver. Dedicated simulators per device (Exact
  Design's `Exact Design <device>` convention) keep the person's own
  simulators untouched.
- **Live native** — `ios|mac --url <dev url>` joins a native build to the
  same dev loop: plans, TypeScript and Rust reload live. The canvas shows it
  as captures refreshed on every reload (a screenshot per generation), since
  a native window cannot be framed. Linux can stream through `EXACT_VNC`;
  that needs a VNC client in the canvas and is **later**.
- **Compare** — `screenshot <png> compare <ref.png>` describes a region
  difference in text; when the web and iOS frames of a route differ beyond
  the platform's own presentation, the difference becomes a comment.
- **Drive mode** — any screen, on any host, can be *driven* from the canvas:
  a click on the frame is hit-tested against the driver's `tree` and sent
  as `tap <testId>`, typing as `type`, and the frame refreshes after `clock
  settle`. It is the agent's own view, handed to a person — so it works the
  same on an iPhone as on the web, and it is how **Record** writes a test
  (§9).

**Built 14 Nov 2026 (exact phase 3):** captures on the web, a dedicated iOS
simulator (by UDID, its status bar pinned) and macOS; a device wall item per
route; host compare as comments on `testId` order. Drive sends a closed list
— `tap <testId>`, `type <testId> "<text>"`, `back` — checked in the browser
and again on the machine. With the door open it goes through the bridge;
with it shut (§5's *Live frames* off) the browser writes `exact.drive` on the
screen and `isocan exact live` answers with `exact.driven`, so the browser
never reaches the machine and Drive is never lost. Each press replays the
drive cold (~10 s on iOS): Exact has no resident session a tool can hold.

## 8. Time and state

- **Film** — `screenshot <file>.apng over <ms> every <ms>` films an
  interaction against the virtual clock; the strip lands as an image item
  with `exact.film = { from, every, steps }`. The web module draws a scrubber
  over it; a comment made while scrubbed carries `at`, as motion's comments
  do.
- **State per frame** — stepping `clock +<ms>` with `state` between steps
  gives the component state at each frame; it is stored beside the strip as
  JSON and shown under the scrubber.
- **Inspector panel** — `tree --ax`, `layout <target>`, `perf <target>` and
  `logs` from the resident session, for the selected screen, in a panel the
  module contributes. Read-only; a fact the CLI can print is a panel the web
  can show.

**Built 14 Nov 2026 (exact phase 4):** `isocan exact film`, or **Film** on a
screen, runs `screenshot … apng over 600 every 16` after the press; the
strip is an `.apng` image item with `exact.film`, split into stills in the
browser for a scrubber in milliseconds. A second cold driver reads `state`
between `clock +16` steps into `exact.frames`. Comments at a moment use
core's `Comment.at` (motion's shape). There is no resident session, so the
inspector reads a cold driver at the screen's shots. Native films are not
yet byte-identical (iOS composites near its tab bar outside the clock), so
films are web-only.

## 9. Tests as storyboards

- A `test` block renders as a row of steps, each under the frame it acted on.
  **Run** executes it per host through the driver with `--json` (one reply per
  operation), and records the result as a version of the storyboard: green
  steps, the failing step red with its frame and its tree.
- `verify` (tests, `check` in light and dark at two sizes, the largest text
  size, a relaunch) is **Verify on all hosts**, its screenshots posted as
  versions of the screens they show.
- **Record** — in Drive mode, every tap and type is a step; when the person
  stops, the module proposes `expect` lines from the state that changed
  (`state` before and after) and writes the test as a proposal, for the
  person to keep or edit. The file is written by the person's accept, never
  by the recorder.

**Built 14 Nov 2026 (exact phase 5):** each `test` is a storyboard item;
Run (bridge `/run`, or `exact.run` answered by `isocan exact live`, or
`isocan exact run`) gives Exact's `test <host>` a copy with a `screenshot`
after every step, since `test` has no per-operation reply, and keeps the
result as the storyboard's next version, frames inside. `isocan exact
verify` posts first-screen shots as versions of their screens and lists the
rest with why. Record proposes `expect` lines from the `state` that changed
as a core proposal item under the test file; Keep is core's choose, and
`live` writes the file only then.

## 10. Agents change things through proposals

Tamber's wire has scopes — `read` < `propose` < `write` — and held
proposals that a `write` client may `accept`, `drop`, `edit-held` or
`choose` between. isocan maps its own roles onto them:

| isocan | Tamber |
| --- | --- |
| a viewer, or an agent asked to look | `read` |
| an agent asked to change something | `propose` — never `write` |
| the person whose machine runs the dev loop, or a person they grant | `write` |
| any other person, even one who may edit the canvas | `read` |

Write is the machine owner's to give, not the canvas's: a `write` client's
accept rewrites files on that machine, and a ship signs with its keys. Being
able to edit a canvas is not a reason to touch someone's working tree.

- **A held proposal is a proactive proposal item**: dashed, hanging under
  the screen it changes, citing what asked for it. It shows before and after
  on every device and both schemes. **Measured 13 Nov 2026 (exact phase 0):
  a held proposal does not render** — the screenshot after `propose` with
  hold is pixel-identical to before, and `preview` pins a mode, not a
  proposal. A Tamber scrub of the same change does render, writing nothing,
  and `scrub-cancel` restores it exactly. So a live-class proposal is shown
  as a scrub session; a rebuild-class one uses Exact Design's fallback: apply
  it to a staged copy, compile with `--json --errors-only`, capture there.
- **Several directions** are several proposals; design-competition's rounds
  and the shared vote curtain decide between them; **Accept** is Tamber's
  `accept`, after which every live frame updates and the proposal item
  becomes the version that recorded it.

**Built 14 Nov 2026 (exact phase 6):** an enrolled agent pairs at `propose`,
anyone else the canvas lets write at `write`. `isocan exact propose
<screen>` writes `exact.propose`; `isocan exact live` holds it on the wire,
pictures it (scrub then `scrub-cancel` for live-class, a staging copy for
rebuild-class) on web phone, tablet and desktop in both schemes and on iOS,
and posts a proposal item whose versions are the pictures. Keep is core's
choose, which `live` turns into Tamber's `accept`. Design-competition bouts
on an Exact screen take proposals as entries. The design-system item's
token chips scrub every live frame, web and the iOS simulator's. `isocan
exact branch` captures a git ref in a staging copy beside the current
screens.
- **Token scrubbing** — dragging a token on the design-system item is a
  Tamber scrub session: every registered build updates with no reload (the
  live table), on every host, until release, then `commit` or `cancel`.
- **Structural edits** (a new component, a route) are Contract written by
  an agent in the person's checkout, as today; the canvas shows them as a
  proposal by capturing the agent's branch beside the current one.

## 11. Shipping

All of delivery is Exact's; the module shows it and gates it.

- **The lane** — channels from `app.json`'s `deploy` (`channels`, `streams`,
  `activate`, `check.interval`, `release`, `phased`) as rows; each release
  record as a card.
- **Prepare** — `bun scripts/deploy.mjs <app> --json` (a dry run by default):
  it snapshots HEAD, bakes, and classifies every change against the live
  signed heads. The classification is the card: what goes over the air
  (plan, assets, one module pair) and what *needs a binary*, each with its
  reason. Nothing is uploaded.
- **Ship** — `deploy.mjs --yes --channel <c>` (or `push.mjs` for the
  internal "update in seconds" path, which refuses binary-only changes).
  **Only a person ships**: `isocan exact ship` refuses when the actor its
  CLI host names is an agent, and asks the person to confirm the channel,
  the change count and the classification. Signing keys
  (`deploy.signing`) never leave the machine and never touch the canvas;
  the canvas holds the release record only.
- **Install links** — `share.mjs --json` mints an AppDrop link; the module
  posts it as a QR item beside the release.
- **What Exact does not have, said plainly**: no publisher rollback command
  (the client has an anti-rollback floor and falls back to the last good
  bundle after crashes); TypeScript and Rust modules cannot ship together over
  the air; store submission is the publisher's. *Roll back* on the lane is
  therefore *re-publish the previous release's content at a new sequence
  number*, and says so.

**Built 14 Nov 2026 (exact phase 7):** an `exact-lane` item from `app.json`'s
`deploy`; `isocan exact prepare` (agents may) runs the dry run, hashes the
origin directory either side, and posts the classification as a card.
`isocan exact ship`, `promote` and `rollback` refuse an enrolled agent, on
the CLI and on the canvas door, print what will ship and take `--yes`; the
lane's buttons open a confirm step. Ship runs `deploy.mjs --yes` pinned to
the prepared commit; roll back re-publishes from a worktree at the earlier
commit. Install QRs and phased rollout wait (phases.md, phase 7's Open
entries).

## 12. Teammates, phones and hosted canvases

- **Without a checkout**, a teammate sees every captured screen, film,
  storyboard and release card — they are items — and nothing live.
- **With a pairing**, a teammate's browser can hold a `read`-scoped live
  frame through the relay (§5).
- **On a phone**, the canvas's mobile presenting mode shows the device wall;
  the AppDrop QR installs the real build.

## 13. Exact Design

Exact Design (MIT) is a studio for one person and one app, written in
Exact; this is a canvas for a team and its agents, around one or several
apps. The module learns from it — discovery from `routes.json`, the element
bridge, digest-checked drafts, dedicated simulators — and links to it
(**Open in Exact Design** with its setup link) rather than re-implementing
its layout inspector. It does not vendor Exact Design's code: its shared
runtime patches hashed SDK chunks and is fragile across SDK pins by its own
account.

## 14. Following a moving target

Exact changes daily and promises nothing. So:

- the module talks only to Exact's **printed** interfaces — CLI verbs with
  `--json`, `routes.json`, the plan map, the Tamber wire — never its crates;
- every interface it reads has a **recorded fixture** from a real run,
  dated and stamped with the Exact commit, and a test that reads it;
- `isocan exact doctor` states the commit and protocol it was proven
  against, and anything newer is warned, then tried;
- the module is an **experiment** behind `exact` in Settings → Experiments,
  removed by unticking it.

## 15. A diary back to the Exact team

Exact asks every agent that builds with it to keep a diary
([`docs/diary.md`](https://github.com/expo/exact/blob/main/docs/diary.md) in
expo/exact): friction recorded as it happens with `bun exact.mjs feedback
note "<what happened>"`, and a diary at `.exact/diary/<date>-<topic>.md` —
*Rough*, *Lean in*, *Needed*, *Checkpoints* — written as you go for a reader
on the Exact team. Nothing leaves the machine without the person's yes.

This module is an unusual diarist: not an app built on Exact but a **tool
built on Exact's tool interfaces** — the Tamber wire, the agent session, the
source map, `deploy --json`. That is the part of Exact with the fewest
outside callers, so it is the part our diary is most worth reading for. So:

- **While building**, every phase's builder keeps the diary in the Acme
  Market fixture app (synthetic, so nothing in it is private; copied into
  [`diary/`](diary/) with each phase, because the fixture is scratch), runs `bun
  exact.mjs feedback status` at the start, and notes friction the moment it
  happens — a wire method that answered differently from its doc, a door that
  needed a workaround, a version that moved under us. *Needed* lists the tool
  capabilities a canvas client wanted (a held proposal's preview, a resident
  driver session, an ancestor list for `frame-ancestors`) as `provided`, `by
  hand` or `missing`.
- **Once built**, the conductor gathers the phases' diaries into one, shows
  Dion exactly what would be sent (`bun exact.mjs feedback` prints it), and
  sends only on his yes with `feedback send --yes`. The receipt goes in
  [`phases.md`](phases.md)'s trajectory; `feedback delete <receipt>` takes it
  back.
- **For people using the module**, the module's agent guide tells every
  agent working on an Exact app from the canvas to keep that app's diary as
  its `AGENTS.md` already asks, and to respect the project's standing answer
  (`ask`, `local`, `always`, `never`) — never sending on its own initiative
  under `ask`. The canvas adds no sending of its own.

## 16. Open questions, in one place

1. ~~Live frames through two ancestors: which door~~ — measured: a bridge proxy that rewrites framing and Origin, drawn by the shell, never inside an HTML item (§5).
2. ~~Web ↔ bridge on loopback~~ — decided: a paired local-tool door the shell owns, with live frames switchable off per machine, per screen and per bridge (§5).
3. ~~Whether `contract symbols` names a router verb's target route~~ — measured: it names the route, not the verb or action; the module reads those from the source range (§3).
4. ~~Whether a held Tamber proposal renders without being accepted~~ — measured: it does not; a scrub does (§10).
5. ~~Whether Exact's agent session API holds across rebuilds~~ — measured: it does (§2).
6. Whether the runtime survives an opaque-origin sandbox (`localStorage`
   is wrapped; untested).
7. Whether this is something to build *with* the Exact team — the Tamber wire
   is already a public seam for tools, and a canvas client is a client they
   may want to test against.

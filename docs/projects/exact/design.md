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
  operation — **open question**: the session API is internal to Exact and
  undocumented; phase 0 measures whether it holds across rebuilds;
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
  **Open question**: whether `symbols` names the route a verb targets, or the
  module must read it from the action's source range. Phase 1 decides; the
  fallback is a small reader over the range `symbols` already gives.
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

**Getting the frame's address to the web.** A module may not add a server
route, and a grant must not sit in a replicated property. So the web module
talks to the bridge **directly on loopback**, paired once — the bridge
prints a code (Tamber's own pairing shape: one use, two minutes), the
person enters it on the canvas, and the browser keeps the bridge token for
that machine. The canvas holds only the stable intent (`exact.live = {
route, device, host }`); each viewer's browser asks its own bridge for a
fresh grant. **Decision owed**: no module slot reaches a loopback service
today — the proposed `host` (`WebHost`) sends ops and puts blobs through the
home, nothing else — so a browser-to-bridge connection is a product change,
reviewed as one: a narrow, paired "local tool" door the shell owns, which
the sandbox and motion modules could use too. It is the one place this
design reaches past the module API, and it is named so a reviewer can refuse
it; refused, live frames fall back to Drive mode (§7), which needs nothing
but items.

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

## 10. Agents change things through proposals

Tamber's wire has scopes — `read` < `propose` < `write` — and held
proposals that a `write` client may `accept`, `drop`, `edit-held` or
`choose` between. isocan maps its own roles onto them:

| isocan | Tamber |
| --- | --- |
| a viewer, or an agent asked to look | `read` |
| an agent asked to change something | `propose` — never `write` |
| a person who may edit the canvas | `write` |

- **A held proposal is a proactive proposal item**: dashed, hanging under
  the screen it changes, citing what asked for it. It shows before and after
  on every device and both schemes. **Open question**: whether a held proposal
  can be rendered without accepting it (Tamber's `pin`/`preview` force modes
  on running builds; `propose` with an inline scrub). The fallback is Exact
  Design's: apply it to a staged copy, compile with `--json --errors-only`,
  capture there.
- **Several directions** are several proposals; design-competition's rounds
  and the shared vote curtain decide between them; **Accept** is Tamber's
  `accept`, after which every live frame updates and the proposal item
  becomes the version that recorded it.
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

## 15. Open questions, in one place

1. Live frames through two ancestors: which door (§5).
2. Web ↔ bridge on loopback: a product change the shell owns, or no live frames (Drive mode only) (§5).
3. Whether `contract symbols` names a router verb's target route (§3).
4. Whether a held Tamber proposal renders without being accepted (§10).
5. Whether Exact's agent session API holds across rebuilds, or each
   operation must cold-launch (§2).
6. Whether the runtime survives an opaque-origin sandbox (`localStorage`
   is wrapped; untested).
7. Whether this is something to build *with* the Exact team — the Tamber wire
   is already a public seam for tools, and a canvas client is a client they
   may want to test against.

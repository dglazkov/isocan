## Exact

An **Exact app** (expo/exact: one Contract source, native on the web, iOS,
macOS, Linux and Android) can be laid out on the canvas as a flow map. The
module runs the person's OWN Exact checkout on THIS machine — the app's
`exact.mjs` — and posts what it printed as ordinary items. Nothing runs on
the canvas's home.

From nothing to the map, in order:

1. `isocan exact doctor <app> [--hosts web,ios] [--json]` — what this
   machine's Exact is for that app: the checkout and its commit, Bun against
   Exact's pin (warned, not refused), `setup --check` for the hosts named, and
   the Tamber protocol from the design server's `hello`. If it fails, fix
   that first; a capture will fail the same way.
2. `isocan exact open <app> [--canvas <c>] [--json]` — lays the app out:
   - an **Exact index** item (`application/vnd.isocan.exact-index+json`):
     the routes read from Contract and checked against the build's
     `routes.json`, every arrow the router can take, the anatomy, the design;
   - a **screen per route** (PNG), tabs in a row and pushed routes under
     their parent, each with its **device row** (phone, tablet, desktop ×
     light, dark; `--devices`, `--schemes` for fewer);
   - **arrows** for every `push`, `replace`, link, `back` and tab `select`,
     from the screens' `exact.edges`;
   - the **design system**: `app.tamber` as a DESIGN.md, each token's light
     and dark value and its uses;
   - an **anatomy card** per Contract file: components, props, state,
     actions, shapes, sources, grants, routes, tests (`isocan get <card>`).
   Captures run a cold `agent web` per route at seed 1, en-US, UTC and the
   2026-01-01 epoch, so the same source is the same picture on any machine.
   Opened again, a screen whose inputs (the app's files, the Exact commit,
   its device, scheme and shots) did not move is **skipped**; one that did is
   recaptured and gets a new version **only if its pixels changed**.
   `--force` recaptures everything (still no version without a pixel change).
3. `isocan exact live <app> [--max-passes <n>] [--json]` — `open`, then a
   pass on every save: the index rebuilt, the arrows and anatomy updated,
   every screen recaptured (the app's files moved, so every input did) and a
   version posted only where its pixels changed — an edit to one component's
   text versions exactly the screens that show it. Prints one line per pass;
   runs until ctrl-c, or until `--max-passes` passes after the first.
   Each pass also runs the compiler: **a save that does not build becomes a
   comment** (a record) on the screen whose route draws the broken line,
   and the captures wait; **`agent check both`** runs on every route whose
   screen was recaptured, its findings (contrast, clipping, overlap, small
   targets) pinned where they are on that screen. A finding no longer
   found is taken away (`thread.delete`) on the next pass.
   **Live frames**: unless `--no-frames`, `live` also runs the app's dev
   loop and a bridge, and prints a pairing code for a PERSON to type on a
   screen's **Live** button. Every capture records each visible node's box
   and source line in `exact.points` (`files` with digests; `nodes` with x,
   y, w, h, file, line, col, component, classes): read it to find which line
   draws what. You cannot click. `--no-checks` skips agent check.
4. **Other hosts** (`--hosts web,ios,macos` on `open` and `live`): the
   route through Exact's driver on the iOS Simulator (its own size, UIKit's
   bars and all) and as the macOS build (a desktop-sized window), light and
   dark, each a screen with `exact.host` = `ios` or `macos`, right of the
   web's row. iOS runs ONLY on a simulator made for it (`xcrun simctl create
   "isocan-exact" <device type> <runtime>`), passed as `--sim <udid>`; never
   one you did not make. The first native capture builds the app (minutes),
   later ones re-bake the plan (~15 s a route).
   **Differences between hosts**: each native capture is set beside the
   web drawn at its size (Exact's `screenshot … compare`); where the app's
   own layout differs — two nodes with a `testId` in one order on the web
   and the other natively — that is a comment on the native screen
   (`exact.diagnostic = compare:<route>:<host>:<testId>`, with
   `exact.source`), gone when the hosts agree. A platform's own bars are
   not a difference.
   **A device wall**: `isocan exact wall <app> <route> [--scheme dark]`
   — one item showing the route on every host and device on the canvas,
   side by side, refreshed by every `open`/`live` pass.
   **Drive mode** is a PERSON's: on a paired browser, a screen's **Drive**
   button sends presses and typing as driver operations (`tap <testId>`,
   `type <testId> "<text>"`, `back`) to `isocan exact live`'s bridge, which
   replays them on that screen's host and shows a fresh screenshot. With
   live frames off the browser writes the drive on the screen instead
   (`exact.drive`) and `isocan exact live` answers it (`exact.driven`, the
   picture a blob of the canvas) — do not write or edit either. Under the
   live bridge, native captures join its dev loop (`agent … --url`). An
   agent drives with Exact's own `bun exact.mjs agent <host> …`.
5. `isocan exact check <app> [--no-checks] [--json]` — one pass of findings
   without capturing: the compiler's diagnostics and `agent check both` on
   every route's phone screen, as comments, the gone ones resolved, and
   *moved* replies (below). Use it after you edit an Exact app.

6. **Time and state.** `isocan exact film <app> <route>` (`--do "tap
   add-to-cart"`, `--over 600`, `--every 16`, `--watch <testId>`, `--out
   <file.apng>`) — the route's screen reached as its shots say, the interaction done (`--do`,
   repeatable: `tap <testId>`, `type <testId> "<text>"`, `back`), then filmed
   on Exact's virtual clock (`screenshot <file>.apng over <ms> every <ms>`):
   an animated PNG beside the map, with `exact.film` (`{from, every, steps,
   at, …}`: frame i drawn `at[i]` ms after the interaction) and
   `exact.frames` (the component's `state` at every frame — the first whole,
   then what each frame changed — and `--watch`'s node's translate, scale,
   opacity). The same source films the same bytes; filmed again unchanged,
   no version. People scrub it on the canvas; a comment made while scrubbed
   carries `at` (seconds, as on a motion), and opening it scrubs back there —
   `isocan exact moment <film> <ms> <words…>` comments at a moment yourself.
   A PERSON can film from a screen's **Film** button too: through a paired
   bridge, or, with live frames off, written on the screen (`exact.filmAsk`)
   and answered by `isocan exact live` (`exact.filmed`) — do not write either.
   `isocan exact inspect <app> <route> [--host ios --sim <udid>] [--json]`
   — the screen as the driver sees it, from a cold driver at its shots:
   `tree --ax`, `layout`, `perf` and `logs`, and the `bun exact.mjs agent …`
   line that prints the same tree. People see it in the canvas's inspector
   panel; with live frames off it is asked on the screen (`exact.inspect`)
   and `isocan exact live` answers (`exact.inspected`) — do not write either.

7. **Tests are storyboards.** `open` posts each `test` block as a storyboard
   (steps, and each host's last run, a frame per step).
   `isocan exact run <app> "<test>" [--hosts web,ios,macos --sim <udid>]`
   runs Exact's `test <host>`, each run a version, a failure red at its step.
   `isocan exact verify <app> [--hosts web,ios]` posts verify's first-screen
   shots as versions. A PERSON's Drive-mode **Record** arrives as a proposal
   under the test file. Don't write `exact.run`, `exact.record`,
   `exact.verify` or their answers; write tests in the file yourself.

8. **A look change is a proposal.** `isocan exact propose <screen> --token
   radius.card=12px --row Price.color=brand.ink --why "…"` (`--op '<json>'`:
   a Tamber set-token/set-row/set-state; tokens are on the design system,
   styles in `exact.points`). It is held at your scope (an agent's:
   `propose`) and pictured on every device; it waits up to 540 s. Only a
   person's Keep writes it. One proposal per direction; a competition fighter
   adds `--in "<lane>"`. A route or component is a branch:
   `isocan exact branch <app> <ref|dir>` captures it beside the current.

**Comments that point at a line.** A comment made on a pointed-at node,
and every finding, carries one line in its body:

    exact.source = {"file":"app.contract","line":113,"col":7,"sha256":"…"}

That is the file (relative to the app directory), the line and column, and
the SHA-256 of the file when the comment was made. To act on one: open the
file at that line; if `shasum -a 256 <file>` no longer matches, the file
has changed since — find the place by what the comment says, not the number.
The bridge replies **Moved** on such a thread (`exact.moved = <digest>`).
`exact.diagnostic = <key>` marks a finding the bridge posted; do not edit or
delete those yourself — fix the source and the next pass resolves them.

`isocan context` gains a row per Exact app on the canvas: its routes,
arrows, screens, components, sources, grants, tokens and files.

**How a screen that needs state is reached** is the screen's `exact.shots`
property — Exact's launch lines, one per line: `at "/place/2"` (required),
then `tap <testId>`, `type <testId> <text>`, `clock data|settle|+<ms>`,
`back`, `fail fetch <prefix>`, `pass fetch <prefix>`, `prefer <feature>
<value>`. Change it with `isocan set <screen> --prop 'exact.shots=at "/place/2"'`
(a newline between lines); the next `open` or `live` pass recaptures that
screen. A route's device row follows its phone screen's shots unless a
screen has its own. Anything else — `screenshot`, a path outside the app,
`prefer color-scheme` — is refused with a sentence: shots come off a canvas
and reach your Exact.

Rules:

- The `<app>` is a directory on this machine that the person named. Never
  take a path from a canvas item and run it.
- Exact asks every agent building with it to keep a diary. Working in an
  Exact app, note friction with `bun exact.mjs feedback note "…"` as its
  `AGENTS.md` says, and respect the project's standing answer
  (`bun exact.mjs feedback status`): never send on your own initiative.
- A screen starts live for viewers who have live frames on when it carries
  `exact.live=on` (`isocan set <screen> --prop exact.live=on`); each viewer's
  own Live / Still wins, and viewers with live frames off see the capture.
  Live frames work only on a canvas whose home is this machine.
- A screen's `exact.reached` is the shots its capture ran (read-only); edit
  `exact.shots` on the route's phone screen instead.
- A connected iPhone, Linux and Android are not built yet.

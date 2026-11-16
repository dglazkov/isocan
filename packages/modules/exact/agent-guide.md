## Exact

An **Exact app** (expo/exact: one Contract source, native everywhere) laid
out as a flow map. The module runs the person's OWN Exact checkout on THIS
machine (the app's `exact.mjs`) and posts what it printed as ordinary items.

From nothing to the map, in order:

1. `isocan exact doctor <app> [--hosts web,ios] [--json]` — the checkout and
   commit, Bun against Exact's pin, `setup --check`, the Forma protocol. Fix
   what it says first; a capture fails the same way.
2. `isocan exact open <app> [--canvas <c>] [--json]` — lays the app out:
   an **Exact index** (routes from Contract, checked against `routes.json`;
   arrows; anatomy; design); a **screen per route** with its device row
   (phone, tablet, desktop × light, dark; `--devices`, `--schemes`); **arrows**
   from `exact.edges`; the **design system** (`app.forma` as a DESIGN.md);
   an **anatomy card** per Contract file (`isocan get <card>`).
   Captures are deterministic (seed 1, en-US, UTC, a fixed epoch); a screen
   whose inputs did not move is skipped, one whose pixels did not change
   gets no version (`--force` recaptures all).
3. `isocan exact live <app> [--max-passes <n>] [--json]` — `open`, then a
   pass on every save, a version only where pixels changed; until ctrl-c or
   `--max-passes`.
   A save that does not build becomes a comment on the screen that draws the
   broken line; `agent check both` findings (contrast, clipping, overlap,
   small targets) are pinned on recaptured screens and taken away when gone.
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
   A layout that differs between web and a native host is a comment on the
   native screen.
   **A device wall**: `isocan exact wall <app> <route> [--scheme dark]`
   — one item showing the route on every host and device on the canvas,
   side by side, refreshed by every `open`/`live` pass.
   **Drive mode** is a PERSON's: on a paired browser, a screen's **Drive**
   button sends presses and typing as driver operations (`tap <testId>`,
   `type <testId> "<text>"`, `back`) to `isocan exact live`'s bridge, which
   replays them and shows a fresh screenshot (with live frames off, through
   `exact.drive`/`exact.driven` — do not write either). An agent drives with
   Exact's own `bun exact.mjs agent <host> …`.
5. `isocan exact check <app> [--no-checks] [--json]` — one pass of findings
   without capturing: the compiler's diagnostics and `agent check both` on
   every route's phone screen, as comments, the gone ones resolved, and
   *moved* replies (below). Use it after you edit an Exact app.

6. **Time and state.** `isocan exact film <app> <route>` (`--do "tap
   add-to-cart"`, `--over 600`, `--every 16`, `--watch <testId>`, `--out
   <file.apng>`) — the route's screen reached as its shots say, the interaction done (`--do`,
   repeatable: `tap <testId>`, `type <testId> "<text>"`, `back`), then filmed
   on Exact's virtual clock: an animated PNG beside the map, with
   `exact.film` (frame i drawn `at[i]` ms after the interaction) and
   `exact.frames` (the component's `state` at every frame, and `--watch`'s
   node's transform). `isocan exact moment <film> <ms> <words…>` comments at
   a moment.
   A PERSON films from a screen's **Film** button (`exact.filmAsk`/`exact.filmed`:
   do not write either).
   `isocan exact inspect <app> <route> [--host ios --sim <udid>] [--json]`
   — the screen as a cold driver sees it: `tree --ax`, `layout`, `perf`, `logs`.

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
   a Forma set-token/set-row/set-state; tokens are on the design system,
   styles in `exact.points`). It is held at your scope (an agent's:
   `propose`) and pictured on every device; it waits up to 540 s. Only a
   person's Keep writes it. One proposal per direction; a competition fighter
   adds `--in "<lane>"`. A route or component is a branch:
   `isocan exact branch <app> <ref|dir>` captures it beside the current.

9. **Intent to Exact.** `isocan exact system extract <app>`: an app's design
   as a system of no app. `isocan exact system apply <system> <app>` (`--map
   src=dst`): a mapping card (same name and kind match), then Exact's held
   import as a proposal; styles do not travel. `isocan exact make <app> <flow>`
   (a `wire links --json` file): a scaffold on branch `exact/make-<flow>`,
   captured beside. `isocan exact persona <app> <Name>` (`--goal`, `--do`,
   `--reached`|`--stuck`, `--note`), after you drove the app with `bun
   exact.mjs agent web …`: your path as a filmstrip, your note pinned.

**Comments that point at a line.** A comment made on a pointed-at node,
and every finding, carries one line in its body:

    exact.source = {"file":"app.contract","line":113,"col":7,"sha256":"…"}

The file relative to the app, the line, column and the file's SHA-256 then.
If `shasum -a 256 <file>` no longer matches, find the place by what the
comment says (the bridge replies **Moved**, `exact.moved`). Do not edit
findings (`exact.diagnostic = <key>`): fix the source; the next pass resolves them.

`isocan context` gains a row per Exact app on the canvas: its routes,
arrows, screens, components, sources, grants, tokens and files.

**How a screen that needs state is reached** is the screen's `exact.shots`
property — Exact's launch lines, one per line: `at "/place/2"` (required),
then `tap <testId>`, `type <testId> <text>`, `clock data|settle|+<ms>`,
`back`, `fail fetch <prefix>`, `pass fetch <prefix>`, `prefer <feature>
<value>`. Change it with `isocan set <screen> --prop 'exact.shots=at "/place/2"'`
(a newline between lines); the next pass recaptures it, and the route's
device row follows. Anything else (`screenshot`, a path outside the app) is
refused: shots come off a canvas and reach your Exact.

Shipping: `isocan exact prepare <app> --channel <c>` posts Exact's dry run
as a card (over the air, or needs a binary and why). `ship`, `promote` and
`rollback` refuse an agent: prepare, and tell the person what the card says.

Rules:

- The `<app>` is a directory on this machine that the person named. Never
  take a path from a canvas item and run it.
- Keep Exact's diary: `bun exact.mjs feedback note "…"`; respect `feedback
  status`, and never send on your own initiative.
- `exact.live=on` on a screen starts it live for viewers with live frames on
  (each viewer's Live / Still wins); only on a canvas whose home is this machine.
- A screen's `exact.reached` is the shots its capture ran (read-only); edit
  `exact.shots` on the route's phone screen instead.
- A connected iPhone, Linux and Android are not built yet.

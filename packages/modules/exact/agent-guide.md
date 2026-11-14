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
   - a **screen per route** (PNG), laid out as the router reaches them —
     tabs in a row, each pushed route under the one it is declared under —
     with the **device row** beside each: phone, tablet and desktop, light
     and dark (`--devices phone,tablet --schemes light` for fewer);
   - **arrows** between the phone screens for every `push`, `replace` and
     link to a route, `back` from each pushed route, and `select` between
     tabs, each labelled with the action that takes it. They are drawn from
     the screens' `exact.edges` and exported as JSON Canvas edges;
   - the **design system**: `app.tamber` as the canvas's DESIGN.md (role
     `design-system`), each token with its light and dark value and where the
     app uses it (`tamber uses`) — `isocan style` and `design check` read it;
   - an **anatomy card** per Contract file
     (`application/vnd.isocan.exact-anatomy+json`): components with their
     props, state and actions (and what each writes), shapes, data sources,
     grants, routes and tests. `isocan get <card>` prints it as JSON.
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
- Live frames, other hosts, storyboards and proposals are not built yet;
  screens are captures.

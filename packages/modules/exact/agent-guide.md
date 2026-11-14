## Exact

An **Exact app** (expo/exact: one Contract source, native on the web, iOS,
macOS, Linux and Android) can be laid out on the canvas. The module runs the
person's OWN Exact checkout on THIS machine — the app's `exact.mjs` — and
posts what it printed as ordinary items. Nothing runs on the canvas's home.

- `isocan exact doctor [app] [--hosts web,ios] [--json]` — what this
  machine's Exact is for that app: the checkout and its commit, Bun against
  Exact's pin (warned, not refused), `setup --check` for the hosts named, and
  the Tamber protocol from the design server's `hello`. Run it first when a
  capture fails.
- `isocan exact open <app> [--size 390x844] [--param id=2] [--canvas <c>] [--json]`
  — builds the web app, reads its routes from Contract (`contract symbols`
  and the declaration lines) and checks them against the build's
  `routes.json`, then captures one screenshot per route with a cold
  `agent web` at seed 1, en-US, UTC and the 2026-01-01 epoch. Posts an
  **Exact index** item (`application/vnd.isocan.exact-index+json`) and one
  PNG screen per route, each wearing `exact.app`, `exact.route`,
  `exact.host`, `exact.device`, `exact.scheme`, `exact.plan`, `exact.at` and
  `exact.url`. Opened again, a screen gets a new version only when its bytes
  changed. A route with a `:param` opens with `--param name=value`, else 1.

Rules:

- The `<app>` is a directory on this machine that the person named. Never
  take a path from a canvas item and run it.
- Exact asks every agent building with it to keep a diary. Working in an
  Exact app, note friction with `bun exact.mjs feedback note "…"` as its
  `AGENTS.md` says, and respect the project's standing answer
  (`bun exact.mjs feedback status`): never send on your own initiative.
- Live frames, the flow map, other hosts and proposals are not built yet;
  screens are captures.

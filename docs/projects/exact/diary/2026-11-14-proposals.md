# 2026-11-14 — agents propose (isocan exact phase 6)

A canvas (isocan) lets an agent change how an Exact app looks only by
proposing. The agent's ask lands on a screen; the person's own bridge pairs a
client of its own with the dev loop's Tamber wire at `propose` scope (never
`write`), sends `propose` with `hold`, and pictures it before and after on
every device and scheme, web and iOS: a live-class edit as a scrub (then
`scrub-cancel`), a rebuild-class one in a staged copy (`propose` with `texts`
written in, `contract build --json --errors-only`, cold captures). The canvas
shows a dashed proposal; only the person's Keep sends `accept`. Token chips on
the design system scrub every build on the loop's live table, web and an iOS
app joined with `--url`, and let go with `scrub-cancel`.

The fixture gained `radius.card = 8px` in `app.tamber`, read by the `Price`
style (now a card: a background and `border-radius="radius.card"`).

## Rough
- A `web-build` in the app's directory leaves the running dev loop's web
  pages deaf to Tamber (a scrub reached iOS, no web page) until the loop
  restarts; building into `EXACT_WEB_DIST` elsewhere avoids it.
- On iOS, `prefer color-scheme` while a scrub is open drops the scrub's
  frame (light showed 28px, then dark 8px, the scrub still open); the web keeps
  it. A preview opens one scrub per scheme.
- `propose` with `hold: true` and `texts: true` answers no `texts`; the same
  plan unheld does. A held rebuild-class proposal is planned twice.
- A cloned app (`cp -c`, `target/` included) cannot build natively: "target
  was built at <the original>: delete it and build again". Staged iOS previews
  keep a staging directory with its own native build (~2 min once).
- `set-row` on a style rewrapped every long attribute line of `app.contract`
  (~230 lines of diff for one row), and that reflow lands on accept.
- `font` is a layout row, refused by `set-row` (D14) — the first thing an agent
  reaches for to make a page "feel premium".
- An iOS app joined to a loop that has not built its native half shows its own
  baked plan, not the loop's: a staged loop could not stand in for a build.

## Lean in
- Pairing at `propose` scope from the local token, then `accept` with that
  client: 403 `accept needs write scope; this client has propose`. The scope
  holds at the wire, not in the tool.
- `clock +N real until <file>` keeps one driver session open across a scrub:
  before, during, after in one launch, on the web and on iOS.
- A web page joined to the dev loop (`agent web --url http://127.0.0.1:<loop>/…`)
  pictures the same bytes as a cold capture of the same screen; after
  `scrub-cancel` every web picture was byte-identical to before.
- The live table reached an iOS app joined with `--url` with no relaunch: the
  radius moved in the running app.

## Needed
- `texts` on a held `propose` (by hand: an unheld propose of the same ops)
- a scrub that survives a scheme change on iOS (by hand: one scrub per scheme)
- a way to stage a copy that may reuse the original's native build (by hand: a
  staging directory of our own)
- `set-row` that leaves the rest of the file's lines as written

## Checkpoints
- a live-class proposal pictured on web (3 devices × 2 schemes) and iOS (2
  schemes) as a scrub: ~28 s; held and answered on the canvas ~57 s
- a rebuild-class proposal in the staging copy, web and iOS: ~155 s the first
  time (the native build), later ~60 s
- accept after a Keep: under 1 s on the wire
- a token chip dragged on the canvas: the web live frame and the iOS app
  joined to the loop both showed 28px within ~5 s, and both were back to the
  committed 8px after release (the app's pixels equal, status bar aside)

# 2026-11-14 — every host, and Drive mode (isocan exact phase 3)

A canvas (isocan) captures Acme Market on the web, an iOS simulator it was
given (iPhone 17 Pro, iOS 26.0) and the macOS build through `agent <host>`,
compares hosts with `screenshot … compare`, and lets a person drive any
screen by replaying `tap`/`type`/`back` on a cold driver.

## Rough
- No printed resident drive session: each press replays the drive cold
  (~10–11 s a press on the simulator, ~3 s on the web).
- `screenshot compare` needs one shape; comparing two hosts means driving the
  web at the simulator's point size, and every platform bar is a region.
- A native drive has no `--url` for a route: `type <root> <path>`, the root's
  testId read from the Contract source.
- UIKit bar buttons have no `layout` box; their frames are only in
  `tree --ax`, joined back to the node by accessible name.
- The simulator's status bar is the wall clock until `simctl status_bar
  override`; a few native captures still moved pixels with nothing changed.
- The first `agent ios` rewrote app.json (host.ios, deploy.store.ios).
- Tamber inspect in a running `exact web` answers "the row this view is in
  was not found" after any `web-build`/`agent web` in the same app directory
  (what a capture does), until the loop restarts. Flattening three-deep
  nested routes first seemed to fix it; it was the fresh loop that did.

## Lean in
- `agent ios` with `EXACT_SIM` + `EXACT_SHOW_SIMULATOR=0` captured every
  route on a dedicated simulator with UIKit's real bars, light and dark.
- `tap` by testId reached a UIKit bar button (`native: bar-button-item`) and
  a grouped-list row; `type` with a JSON-quoted text just worked.
- `compare`'s region lines name the node and line under each region.

## Needed
- a resident drive session a tool can hold (by hand: replay)
- a host-to-host compare that leaves the platform's bars out (by hand:
  testId order from `layout`)
- boxes for platform-drawn controls in `layout` (by hand: `tree --ax`)
- `web-build` that leaves a running dev loop's inspect working (missing)

## Checkpoints
- 70 screens (7 routes × web 6 + iOS 2 + macOS 2) captured in ~200 s
- cart on web/iOS/macOS from one `open`: 37 s; the planted total-above-rows
  named on iOS and macOS, nothing else
- checkout driven on the iOS screen in five operations, ~10.5 s each
- outline drawn in three live frames of one route (the device wall)

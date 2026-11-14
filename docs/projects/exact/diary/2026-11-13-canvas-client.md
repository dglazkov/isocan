surfaces: web
agent: Claude Code (Claude), building a canvas client on Exact's tool interfaces
task: index a small tabbed store app and capture each route from a separate tool; measure the frame, session and proposal interfaces

### Rough
- No verb prints which checkout and commit an app's exact.mjs uses; the tool parses the launcher line (a few minutes).
- web-build without cargo on PATH dies with a Bun stack trace; setup --check names Rust as missing, so the tool runs that first.
- tamber serve hands out its token while its design server is down; only hello's 503 says so.
- contract symbols gives a route's name and line but not its pattern, tab or parent; the tool reads the declaration line.
- Framing the dev page from another origin: the loop and the canvas gateway both refuse (frame-ancestors names only 7740 / the TLS door's own origin). Only our own proxy that rewrites frame-ancestors loads it, and then the page's build registration is refused 421 (Origin), so no tool sees it.
- A held proposal changes no running build; there is no preview of a held proposal. A scrub renders it without writing, but needs write scope, is one at a time and live-class only.
- propose classed a set-token 'rebuild' while the loop's background cargo build ran; scrub classed the same op 'live' two seconds later.

### Lean in
- Captures are deterministic: four routes captured twice from a cold start (dist removed) were byte-identical PNGs.
- agent web --url <path> opens at a route of its own build, which made one-capture-per-route trivial.
- The resident session (agent-session.mjs open) survived a save: the page rebuilt and the session saw the change in 1.5 s; warm screenshots ~100 ms against ~1.9 s cold.
- A scrub previewed a token on the running page with the design file untouched, and cancel restored it exactly.

### Needed
- framing from a tool's origin (frame-ancestors list): by hand (a rewriting proxy)
- resident driver session: provided, rough (internal, undocumented)
- held-proposal preview: missing (scrub stands in for live-class edits)
- checkout/commit discovery: by hand

### Checkpoints
- `exact new`: smooth
- web dev loop: smooth
- editing app.contract / app.ts: smooth
- driving the app (`exact.mjs agent`, `exact.mjs test`): smooth

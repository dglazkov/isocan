## Motion

A **motion** makes SVG items on the canvas move, and keeps the result as an
ordinary HTML item (`text/html`) beside them that plays on the canvas, with
versions and comments like any screen. It wears `motion=true`,
`motionSources` (JSON `[{item, version}]` — what it was taken from),
`motionSeconds` and `motionLoop`.

- `isocan motion new <svg...> [--recipe assemble|idle] [--seconds <n>] [--loop | --no-loop] [--title <t>] [--json]`
  — the named SVG items become one motion. The stage is their bounding box
  on the canvas; each keeps its offset and its place in the stacking, so the
  logo as laid out IS the scene. `assemble` (the default) draws line-only
  drawings on, grows named parts up from their base each a beat after the
  last, and settles everything else in last; it plays once and holds.
  `idle` sways named parts a few degrees on their base and breathes the
  rest; it loops. `--seconds` fits the recipe to a length (at most 60).
- **Named parts are `<g id="…">` groups.** A part moves on its own; a drawing
  with none moves as one layer. When parts must move separately, split the
  drawing into named groups first, as a new version of the SVG.
- **Scripts and remote references are stripped** — `<script>`, `on*`
  attributes, `<foreignObject>`, any `href` that is not `#…` or `data:`,
  remote `url()` and `@import`, SMIL animation — and the CLI says what it
  took from which source. A motion runs no one else's code and fetches
  nothing.
- **The principles are checks.** A rotation must name its pivot (the spec
  is refused without one); a part turning on its own centre, a follower that
  does not trail its leader by a beat, idle motion past its ceiling, a jump
  between frames and a loop whose end is not its start are printed as
  `warning:` lines. Tell the person what they say; do not hide them.
- The document's `window.render(t)` sets every layer for time `t` and nothing
  else — the same clock drives the preview and every frame a movie will be
  rendered from. Open it with `#still` to load it paused at 0.
- `isocan motion render <motion> [--fps 60] [--seconds <s>] [--size 1080 | WxH] [--background #rrggbb] [--out file.mp4] [--json]`
  — records the motion to an H.264 MP4 and adds it as a `video/mp4` item
  beside it, wearing `renderedFrom` (JSON `{item, version, fps, size,
  seconds, background}`); `--out` also writes the file. Every frame `n` is
  `render(n / fps)`, so the movie is the preview, recorded. The length is the
  motion's (one loop, for a loop). At most 1080p, 60 fps and 60 s — past
  those it is refused. It takes as long as the frames take, so **offer a
  render; do not render unasked.** Needs Chrome, as `canvas shot` does.

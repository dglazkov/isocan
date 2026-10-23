## Motion

A **motion** makes SVG items on the canvas move, and keeps the result as an
ordinary HTML item (`text/html`) beside them that plays on the canvas, with
versions and comments like any screen. It wears `motion=true`,
`motionSources` (JSON `[{item, version}]` — what it was taken from),
`motionSeconds` and `motionLoop`. Its player sits below the stage: Play, a
scrubber and the time.

- `isocan motion new <svg...> [--recipe assemble|idle | --spec <file.json>] [--say "<words>"] [--seconds <n>] [--loop | --no-loop] [--title <t>] [--json]`
  — the named SVG items become one motion. The stage is their bounding box
  on the canvas; each keeps its offset and its place in the stacking, so the
  logo as laid out IS the scene. `assemble` (the default) draws line-only
  drawings on, grows named parts up from their base each a beat after the
  last, and settles everything else in last; it plays once and holds.
  `idle` sways named parts a few degrees on their base and breathes the
  rest; it loops. `--seconds` fits a recipe to a length (at most 60).
  `--say` keeps the words it was made from as its description.
- **When a person asks in words** — *Animate…* in the web posts you
  `Animate, please: “Circle” (itm_…), … — “<words>”` — you write a **spec**,
  never code, and **run** `isocan motion new <the ids> --spec <file> --say "<the words>"`
  yourself. The motion on the canvas is the answer; never paste the command
  as a reply.
- **Motion that goes on loops.** Words like "then a slow idle sway",
  "breathes", "keeps turning" describe motion that never quite stops: set
  `"loop": true`, with `seconds` one cycle (a wave's `period` that divides
  it, so the end meets the start). Only a one-shot entrance ("assemble",
  "settles in last" and nothing after) is `"loop": false` — it plays once and
  holds its last frame. A loop repeats the whole timeline, entrance
  included, and a motion that does not loop stops its waves at its end — so
  "assemble, then a slow idle sway" is `"loop": true`, and tell the person
  the entrance replays each cycle (or offer the sway as a second, looping
  motion).
- `isocan motion edit <motion> --spec <file.json> | --recipe <r>` — a new
  version of the motion from the same sources, at the versions it took.
  "Slower", "less sway": read the spec, change it, write it back.
- `isocan motion spec <motion> [--json]` — the motion's spec as you would
  write it (JSON on stdout), and on stderr the targets it may name and
  whether a source has a newer version.
- `isocan motion refresh <motion>` — a new version from each source's
  current version, moving the same way (a recipe's motion runs its recipe
  again; a written spec keeps its moves). The web's *Refresh from sources*.
- **A comment at a moment**: `isocan comment add "<words>" --item <motion> --at 1.2`
  — one number with `--item` on a motion is seconds into it (`at` on the
  comment); opening the comment scrubs the player there.

**The spec** is JSON: `{ "seconds": 2.4, "loop": false, "moves": [ … ] }`.
Each move is `{ "target", "pivot"?, "follows"?, "channels" }`:

- `target` is a layer — the source's title, slugged: `Wheat` is `wheat` — or
  a layer's named part, `wheat/stalk`. A wrong name is refused with the list
  of the targets there are.
- `channels` are `x`, `y` (the target's own SVG units), `rotate` (degrees),
  `scale`, `opacity` and `draw` (0 → 1, a stroke drawn on). Each is
  `{ "keys": [{ "t": 0, "v": 0 }, { "t": 0.9, "v": 1, "ease": "outBack" }], "wave": { "period": 4, "amp": 3 }, "bells": [{ "at": 1.2, "width": 0.1, "amp": 0.1 }] }`
  — any of the three. `ease` shapes the approach to its key: `linear`, `in`,
  `out`, `inOut` (the default), `outBack`, `outQuart`, `inOutSine`. A wave
  is idle motion added on top, from `from` seconds; a bell is a pulse.
- **`pivot` names where it turns and scales**: `base`, `center`, `top`,
  `left`, `right` — on the target's own box — or a point `{ "x": 60, "y": 196 }`.
  A rotation or a scale with no pivot is refused. Things turn on a base or a
  joint: a stalk on its root, a door on its hinge. `center` only when the
  middle is meant.
- `follows` names the target this one trails; a follower starts at least a
  beat (0.1 s) after its leader.

- **Named parts are `<g id="…">` groups.** A part moves on its own; a drawing
  with none moves as one layer. When parts must move separately, split the
  drawing into named groups first, as a new version of the SVG
  (`isocan edit <svg> <file.svg>`), then make the motion.
- **Scripts and remote references are stripped** — `<script>`, `on*`
  attributes, `<foreignObject>`, any `href` that is not `#…` or `data:`,
  remote `url()` and `@import`, SMIL animation — and the CLI says what it
  took from which source. A motion runs no one else's code and fetches
  nothing.
- **The principles are checks.** A part turning on its own centre, a
  follower that does not trail its leader by a beat, idle motion past its
  ceiling (6° of rotate, 5% of scale), a jump between frames and a loop whose
  end is not its start are printed as `warning:` lines. Tell the person what
  they say; do not hide them.
- The document's `window.render(t)` sets every layer for time `t` and nothing
  else — the same clock drives the preview, the scrubber and every frame a
  movie is rendered from. Open it with `#still` to load it paused at 0.
- `isocan motion render <motion> [--fps 60] [--seconds <s>] [--size 1080 | WxH] [--background #rrggbb] [--out file.mp4] [--json]`
  — records the motion to an H.264 MP4 and adds it as a `video/mp4` item
  beside it, wearing `renderedFrom` (JSON `{item, version, fps, size,
  seconds, background}`); `--out` also writes the file. Every frame `n` is
  `render(n / fps)`, so the movie is the preview, recorded. The length is the
  motion's (one loop, for a loop). At most 1080p, 60 fps and 60 s — past
  those it is refused. It takes as long as the frames take, so **offer a
  render; do not render unasked.** Needs Chrome, as `canvas shot` does. The
  web's *Render movie…* makes the same item.

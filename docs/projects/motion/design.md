# Motion — the mechanism

**22 October 2026.** The scenes are [`journey.md`](journey.md); the walk is
[`phases.md`](phases.md). Checked against the code at `c9fb585c6` before
writing. The motion vocabulary is after
[rossark0/rossark-motion-skill](https://github.com/rossark0/rossark-motion-skill)
(MIT), read 22 Oct 2026 through a summariser: its engine functions are
`track`, `flow`, `seg`, `wave`, `loop`, `bell`, `seeded` and easing curves on
one shared clock per scene, written for React Native and SwiftUI, rendered
by a Swift binary and `ffmpeg`. Nothing of its runtime carries over; its
principles and function shapes do, credited.

**What exists to build on.**

- **SVG items** are first-class: `image/svg+xml` is a static vector card with
  Image Studio and an XML source (`packages/core/src/capabilities.ts:89`);
  the Pen draws SVG (`packages/core/src/drawing.ts`, `DRAWING_MIME`).
- **Video items** play on the canvas (`packages/web/src/components/ItemView.tsx`,
  `<video className="video-view">`), `video/mp4` and `video/webm` by
  extension (`packages/core/src/media.ts`).
- **A headless browser** the CLI already drives: `isocan canvas shot` runs
  `scripts/canvas-shot.mjs` on `scripts/lib/browser.mjs`.
- **HTML items** run in the sandboxed content origin, with versions and
  pinned comments.

**What is new.** A motion engine in core; a motion item; a renderer page.

---

## 1. The engine: one clock, pure functions of time

`@isocan/core/motion`: a small engine whose every value is a **pure
function of `t`** (seconds since the scene's start) and a seed. No
`requestAnimationFrame` state, no accumulated velocity: frame 212 at 60 fps
is `render(212 / 60)`, whether it is played, scrubbed or exported. That
determinism is what makes the movie equal the preview.

The vocabulary, after the skill:

| function | what it gives |
| --- | --- |
| `track(t, keys)` | a value through timed keys, eased |
| `flow(t, poses)` | smooth movement through key poses |
| `seg(t, from, to)` | 0→1 across a window, for one-shot beats |
| `wave(t, period, amp)` · `loop(t, period)` | idle motion |
| `bell(t, at, width)` | a pulse: emphasis, a bounce |
| `seeded(seed)` | stable "randomness": jitter that is the same every render |
| easings | the named curves, one table |

And its **principles as checks**, not prose: a rotation names its pivot (a
part turning on its own centre is a warning unless said); a follower lags
its leader by a beat; idle amplitude stays under a ceiling; nothing
teleports between frames.

## 2. The motion item

A motion is an **HTML item** (`text/html`), so it plays where every HTML
screen plays, sandboxed, with versions and comments, and nothing new is
needed to show it. Its document holds:

- the selected SVGs, **inlined** (their markup, not references), positioned
  as they were on the canvas: the selection's bounding box is the stage,
  each SVG's offset and z-order its layer;
- the engine, inlined (small, no network);
- the **motion spec**: JSON naming, per layer and per named SVG group
  (`<g id>`), what moves and how, in the engine's vocabulary;
- a tiny player: play, pause, loop, a scrubber, and a `window.render(t)`
  the renderer calls.

Properties on the item: `motion: true`, `motionSources` (each source item
and the version it was taken from), `motionSeconds`, `motionLoop`. Because
the SVGs are copied in, editing a source later does not change the motion;
the motion's details say *"the wheat has a newer version"* and **Refresh
from sources** makes a new motion version with it.

**Comments at a time.** A comment pinned to a motion item may carry
`at: <seconds>`. Opening it scrubs the player there. This is a property on
the comment, not a new op.

## 3. Writing the spec: words, recipes, or an agent

- **Recipes** in core: `reveal`, `assemble`, `idle`, `orbit`, `emphasis`,
  each a function from the layers (and their `<g>` ids, sizes and
  positions) to a spec. They give a good default with no model.
- **Words** go to an agent, as other design asks do: the person's parked
  agent (the web's *Animate…* through `WebHost`, as *Critique with…*
  does), or any agent running `isocan motion new … --say "…"` itself. The
  agent guide teaches the engine's vocabulary and principles, and that
  pivots must be named. The agent writes the spec, not code.
- **By hand**: the spec is JSON in the item; *Edit* opens it.

An SVG with no `<g id>`s can still move as one layer; the guide asks an
agent to split a drawing into named parts first, as a new SVG version,
when parts must move separately.

## 4. Rendering a movie: one page, both surfaces

`/render/motion/:itemId?version&fps&width&height&seconds&format` is a page
of the web app that loads the motion document, and for each frame `n`
calls `render(n / fps)`, draws the stage to a canvas, and encodes it with
**WebCodecs** (`VideoEncoder`: H.264 for MP4, VP9 for WebM), muxed in the
page, with no ffmpeg and no server work. GIF is a palette pass in the same
page.

- **Web**: *Render movie…* opens that page in a hidden frame and shows its
  progress.
- **CLI**: `isocan motion render` opens the same page in the headless
  browser `canvas shot` already drives, and reads the bytes back.

Either way the result is uploaded as a blob and added as a **video item**
beside the motion with `renderedFrom: { item, version, fps, size,
seconds }`. One page means the two surfaces cannot drift; the same frames
in, the same frames out (encoder bytes may differ by browser build, so
**frames, not file hashes**, are what is compared).

Drawing an SVG stage to a canvas needs no network: the SVGs are inline and
any images they reference are refused at creation (§6), so the canvas is
never tainted.

## 5. Both surfaces

| person in the web | person or agent in the CLI |
| --- | --- |
| select SVGs → *Animate…* → words or a recipe | `isocan motion new <svg…> --say "…"` · `--recipe assemble` |
| scrub; comment at a time | `isocan comment add "…" --item <motion> --at 1.2` (`--at` new) |
| *Refresh from sources* | `isocan motion refresh <motion>` |
| *Render movie…* | `isocan motion render <motion> --mp4 --fps 60 --seconds 6` |
| play the video item | `isocan show <video>` |

## 6. What it refuses

- **Scripts and remote references in a source SVG.** Stripped at creation,
  said in words: a motion runs no one else's code, and fetches nothing.
- **A movie past its caps.** 1080p, 60 fps and 60 s by default, refused in
  words above them rather than run for minutes.
- **An agent rendering on a person's behalf without being asked.** Render
  is cheap in money but not in time; the agent guide says to offer, not to
  render unasked.

## 7. Open questions for Dion

1. **The skill's code, or its ideas?** It is MIT: the engine could be a
   port of `motion.ts` with the licence kept, or our own written to the same
   shapes. Proposal: our own, credited, because ours must be pure in `t`
   and theirs is written for a native frame loop.
2. **Is MP4 enough first?** Proposal: MP4 in phase 1, WebM and GIF in
   phase 3.
3. **Faces and rigs**, the skill's strength. Proposal: not in this
   project; a later door once the engine has carried a logo and a scene.

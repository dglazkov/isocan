---
status: designed
since: 2026-10-09
see: groups-by-hand
note: "The mechanism for living grounds: one lazy WebGL2 host behind the items, a shared input field (every visible cursor plus item rectangles), a ground as a small module (shaders plus a step function), a sleep policy that keeps an idle canvas idle, a still-frame fallback, and three first grounds — Meadow, Orbit, Night — with four more proposed."
---

# Living grounds — design

**The debt this discharges.** `journey.md` asks for grounds that move under the
cursor. Today's grounds are CSS backgrounds (`CanvasThemeLayer.tsx` dispatching
to `themes/Galaxy.tsx`, `PaintedGround.tsx`, `CustomGround.tsx`). They re-render
on pan and zoom, and animate nothing. This is the mechanism that lets a ground
be a program without costing an idle canvas anything.

## Yes, shaders — and why

Each scene is a few thousand things changing every frame: blades bending,
stars under a force, glows lighting a dark field. On the CPU that is a frame
budget spent before the canvas draws a single item. On the GPU it is a draw
call and a few uniforms, with the main thread doing almost nothing. So each
ground is a WebGL2 program on one `<canvas>` behind `.world`, in the slot
`CanvasThemeLayer` mounts today.

WebGPU would be nicer for the particle grounds (compute shaders), but WebGL2
runs everywhere isocan runs today, Safari included. A ground's step function is
written so a WebGPU path can replace it later without changing the ground's
module boundary.

## The pieces

```
CanvasThemeLayer ─┬─ (today) Galaxy / Painted / Custom  — CSS, unchanged
                  └─ LivingGround  (lazy, only on a living theme)
                        ├─ GroundHost   one canvas, WebGL2 context, the frame loop, sleep
                        ├─ InputField   cursors + items → uniforms and a trail texture
                        └─ ground module (lazy, one per ground)
                              meadow.ts  { setup(gl), step(dt, field), draw(view) , still }
```

### 1. The host (`GroundHost`)

- One `<canvas>` sized to the viewport at `devicePixelRatio` capped at 2, with
  `pointer-events: none` and the theme layer's z-order.
- Owns the `requestAnimationFrame` loop, and the loop is the only thing that
  ever schedules work. It runs only while the ground is **awake** (below).
- Passes the view transform (`scale`, `tx`, `ty` from `uiStore.viewport`) as a
  uniform, so a world-anchored ground moves with the items without a React
  re-render. Pan and zoom are a uniform write, not a component update. Today's
  CSS grounds re-render on every viewport change; theme.ts warns about exactly
  that cost.
- Handles context loss: it rebuilds on `webglcontextrestored`, and falls back to
  the still frame if a rebuild fails twice.

### 2. The input field (`InputField`)

Everything that touches the ground, gathered once per frame:

- **Pointers**, up to 16: this viewer's pointer, plus every presence cursor
  `CursorLayer` already draws (people and agents). Each is a world position,
  a velocity (from the last two samples), and whether its button is held.
  They go to the shader as a uniform array.
- **Trail texture**: a small (256²) float texture in world space around the
  view, into which each pointer stamps a soft disc every frame. The texture
  decays a little per frame. The Meadow's "footsteps" and the Night's waking
  fireflies read this; a ground that doesn't need history ignores it.
- **Item rectangles**, up to 64 visible items, in world space, sent as a
  uniform array. Beyond 64 the largest on screen win. The ground flattens,
  darkens or avoids them, its choice.

The field takes nothing that isn't already in the browser. No ops are sent,
no presence messages are added, and nothing is stored. Another person's grass
bends because their cursor is already on your screen.

### 3. A ground is a module

```ts
interface LivingGround {
  name: "meadow" | "orbit" | "night" | …;
  setup(gl: WebGL2RenderingContext): void;     // compile, allocate
  step(dt: number, field: Field): boolean;     // advance; false = at rest
  draw(view: View): void;                      // one frame
  still: string;                               // URL of the painted still frame
  cursor: CursorName;                          // the cursor it wears (core CURSORS)
}
```

Each ground is its own lazy chunk, like today's themes. `step` returning
`false` is how a ground says nothing it owns is moving any more, which is what
lets the host sleep.

### 4. Sleep — an idle canvas stays idle

`idle-at-rest` (journeys.mjs:610) fails a canvas whose main thread is busy
more than 15% while untouched, and it has caught a render loop before (7 Sep
2026). A living ground keeps to it:

- **Awake** while any pointer moved in the last 2 s, any presence cursor moved,
  the view panned or zoomed, or `step` returned `true`.
- **Settling:** after the inputs stop, the ground runs until `step` says it is
  at rest, capped at 3 s, then draws one final frame and stops the loop.
- **Asleep:** no rAF and no timers. The canvas holds its last frame. The next
  `pointermove`, presence update or viewport change wakes it.
- **Ambient motion** (grass sway, star drift, firefly blink) runs only while
  awake. A canvas nobody touches settles into a still picture of its ground.
  That is the honest reading of "idle", and it is what keeps battery and fans
  quiet.
- **Hidden tab** (`document.hidden`): asleep, always.
- **Frame cost:** the JS side of a frame is uniform writes and one trail stamp,
  under 0.5 ms. The GPU side is held under about 2 ms on an M1 at 1440p, and
  each ground's density scales down to meet it (phase 0 measures this).

### 5. Motion settings and the still frame

- `prefers-reduced-motion: reduce` gives **Still**: the ground's painted still
  frame (a JPEG, like today's tiles) is drawn as a CSS ground, and the WebGL
  layer is never loaded.
- A per-viewer **Motion** choice (Full · Calm · Still) is stored in
  localStorage, like the Chat's placement. **Calm** keeps cursor reactions and
  drops ambient motion: no sway, drift or blink while untouched.
- No WebGL2, a failed compile, or a lost context: the still frame.
- Contrast: each ground declares a scrim strength, like `GROUND_SCRIM` for
  pictures, so a busy ground never makes item edges or text harder to read
  than today's painted grounds do. `CustomGround`'s scrim is the reference.

### 6. Where it lives in the vocabulary

- **Core.** The new names join `THEMES` in `theme.ts`, with `isLiving(theme)`
  beside them, and each gets its cursor (below) through `themeCursorName`.
  There's no new op: the ground is still the `theme` property via
  `project.update`, so choosing one is one undo, as today.
- **CLI.** `isocan canvas background meadow|orbit|night` works unchanged once
  the names exist. `isocan canvas background --help` and the agent guide name
  them, and the guide says what an agent's cursor does to the ground (scene 3).
- **Web.** The background menu lists them with a small live preview. The
  per-viewer Motion setting sits beside them.

### 7. Cost to the bundle

The entry chunk gains only the theme names, a few dozen bytes in core. The
host, the field and each ground are lazy chunks, loaded on a canvas that wears
a living ground and not under reduced motion. Shaders are strings inside those
chunks. Still frames are JPEGs under `public/grounds/`, fetched by URL like
today's tiles.

## The grounds

| Ground | What the cursor does | Ambient (Full only) | Items | Cursor | Technique |
|---|---|---|---|---|---|
| **Meadow** | blades bend away along the trail and spring back over ~1 s; faster = flatter | slow wind sway | flatten the grass in their footprint | ladybird | instanced blades (one quad each), vertex shader bends by trail and wind; density thins with zoom into a textured fragment pass |
| **Orbit** | a soft mass: nearby stars curve toward it; holding the button reverses it | slow drift and twinkle | dark gaps, stars swing around them | comet | ~4k particles, position and velocity in float textures (ping-pong), gravity from the pointer uniforms, additive points |
| **Night** | the cursor is a firefly; its trail wakes more from the grass | blink, wander, distant bokeh | catch a warm glow near fireflies | firefly | particles plus a dark grass pass and a bokeh backdrop; glow as additive sprites |

Proposed next, after the first three are proven:

| Ground | The idea |
|---|---|
| **Pond** | the cursor drags ripples across still water, and a few koi drift away from it (height-field ripple simulation) |
| **Zen garden** | the cursor rakes lines in sand that slowly soften; items sit like stones with rings raked around them |
| **Snow** | fresh snow the cursor leaves footprints in; flakes fall slowly, swirling around a fast-moving cursor |
| **Aurora** | ribbons of light over a dark landscape that lean toward the cursor (a flow field) |

## Deliberately open

- **Galaxy and Orbit.** Should Orbit replace today's CSS Galaxy (the same
  space, now alive), or sit beside it? The phase 0 prototype settles it: if
  Orbit asleep looks like Galaxy, replace it.
- **Agents' cursors.** Should an agent's cursor touch the ground as strongly as
  a person's? Scene 3 says yes. If a busy agent's constant small moves turn a
  shared screen into a lawnmower, the field can weight agents at half.
- **Sound.** Grass and fireflies invite sound. It's left out until someone
  asks.
- **Custom living grounds.** A user-supplied shader would be a sandboxing
  question. Not now.

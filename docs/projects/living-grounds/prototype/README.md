# Living grounds: the prototype bench (phase 0)

`index.html` is one self-contained page: inline JS and CSS, no CDN, no build.
Open it straight from disk in Chrome or Safari:

```
open -a "Google Chrome" docs/projects/living-grounds/prototype/index.html
open -a Safari          docs/projects/living-grounds/prototype/index.html
```

What's on the page:

- **Ground**: Meadow, Orbit and Night, each a module shaped like design.md §3
  (`setup(gl)`, `step(dt, field) → boolean`, `draw(view)`), in WebGL2. All three
  read one field: every pointer (world position, velocity, held), a decaying
  256² trail texture, and the item rectangles.
- **Six "Acme" cards** stand in for items. Wheel zooms and dragging empty space
  pans, so world anchoring and zoom LOD are real. On Orbit, holding the button
  reverses the pull.
- **Other cursors**: Ravi wanders across the lower board and Scout, an agent,
  makes small hops on the Q4 plan. They walk for about 5 s out of every 12, so
  you can watch the ground fall asleep between walks.
- **Motion**: Full · Calm · Still. Under `prefers-reduced-motion` you always get
  Still.
- **Density** runs from ×0.25 to ×4. At ×1 that is ~32k blades on Meadow, 4,096
  particles on Orbit, and ~15k blades plus up to 120 fireflies on Night.
- **The readout**: awake/settling/asleep, frames drawn in the last 5 s, JS ms per
  frame, GPU ms per frame (`EXT_disjoint_timer_query_webgl2`, or "n/a"), and the
  blade or particle count.
- **`window.bench`** is the measuring API the numbers below came from:
  `setGround`, `setDensity`, `setMotion`, `setOthers`, `stats()`,
  `throughput(n)`, `compileAll()`.

## Sleep, as built (design.md §4)

- **Awake** while an input arrived in the last 0.4 s. Inputs are pointer
  moves, presses, wheel and pan, and presence moves.
- **Settling** comes next. Ambient motion (sway, drift, twinkle, firefly
  wander) eases to zero over about 1.1 s. Night's woken fireflies fade, and
  Orbit's stars slow down rather than freeze in mid-flight. The loop stops when
  `step()` says the ground is at rest, and never later than 3 s after the last
  input. The last frame stays on screen.
- **Asleep**: no rAF and no timers. The panel's own readout interval stops once
  the 5 s frame count reaches 0. A hidden tab is asleep. Still and reduced
  motion draw one frame per change and nothing between.

## Numbers

**Setup.** Measured on this Mac (Apple **M4 Pro**, not an M1) on 9 Oct 2026.
Viewport 1280×720 CSS at DPR 2, so the buffer is **2560×1440**. Driven
headless by playwright-core: Chrome stable (ANGLE on Metal) and Playwright's
WebKit build (standing in for Safari).

**Protocol.** For each ground: move the pointer for 2 s, idle 4 s, read
`bench.stats()`. Then `bench.throughput(120)` takes the median of three runs.

### Sleep, and the JS side of a frame (density ×1)

| Ground | Count | JS ms/frame p50 / p95 | Last frame after input stopped | Frames in last 2 s of idle | Chrome | WebKit |
|---|---|---|---|---|---|---|
| Meadow | 32,130 blades | 0.1 / 0.2–0.3 | 1.47–1.50 s | **0** | ok | ok |
| Orbit | 4,096 particles | 0.1 / 0.2 | 1.47–1.49 s | **0** | ok | ok |
| Night | 15,184 blades + ≤120 flies | 0.1–0.3 / 0.2–0.5 | 1.47–1.49 s | **0** | ok | ok |

All three settle to zero frames about 1.5 s after the input stops, inside the
3 s cap, in both engines, every run (eight runs per ground across Chrome and
WebKit). WebKit's JS times read 0–1 ms because Safari rounds `performance.now()`
to 1 ms. Night is the only ground with real JS work: its firefly simulation and
the per-item glow.

### GPU cost per frame at 2560×1440

Saturated throughput (`bench.throughput`) gives the amortised wall ms per frame,
GPU-bound and with the GPU clocked up:

| Ground | ×0.5 | ×1 | ×2 | ×4 |
|---|---|---|---|---|
| Meadow (blades) | 0.93 (16k) | **1.05** (32k) | 1.39 (64k) | 2.10 (127k) |
| Orbit (particles) | 0.68 (2k) | **0.69** (4k) | 0.71 (8k) | 0.75 (16k) |
| Night (blades + flies) | 1.28 (8k) | **1.37** (15k) | 1.59 (30k) | 1.96 (60k) |

Chrome and WebKit agree to within 0.02 ms on every cell.

The in-situ timer queries during the 2 s of pointer motion (Chrome only, since
WebKit has no timer extension) read **1.5–5.5 ms p50 and 4–9 ms p95**, and
they don't scale with density: ×0.5 and ×2 read the same. That is GPU clock
ramp and compositor contention in headless Chrome, not the ground's own work.
The panel shows that number, so read it with care. The throughput figure is
the ground's cost.

The density floor is the full-screen background pass. Orbit's ~0.65 ms is
almost all background (nebula fbm plus the static star dust). The particles
themselves cost about 0.02 ms per 4k.

### What each ground affords at 1440p

The budget in design.md is about **2 ms GPU on an M1** at 1440p. This machine
is an M4 Pro. Assuming an M1 is roughly 2.5–3× slower on this kind of
fill-bound work (an estimate, not a measurement), the defaults should be:

| Ground | Fits 2 ms here at | Suggested default for an M1 | Why |
|---|---|---|---|
| Meadow | ×4 (127k blades) | **×0.5–×1** (16–32k blades) | The background plus blade overdraw dominates. ×1 is ~2.6–3 ms on an M1 by estimate, so start at ×0.5, or render the ground pass at half resolution. |
| Orbit | ×4 and beyond | **×1–×2** (4–8k particles) | The particles are nearly free. The cost is the background, which could be cached between view changes. |
| Night | ×4 | **×0.5** (8k blades) | The background's bokeh band and firefly light pools dominate. Fewer pool lights, or a half-resolution background, buys back ×1. |

These defaults need an M1 run to confirm. The bench page is the tool for it:
open it, set the density, and read the GPU line, or call
`bench.throughput(120)` in the console.

## Known gaps in the prototype

- **Orbit's stars live in screen space.** Pan moves them with parallax by
  depth, and zoom moves them only mildly, so repeated zoom-outs gather stars
  toward the centre until drift spreads them out again. The background nebula
  and dust are anchored with parallax. A real world-anchored particle field
  needs tiling.
- **Scene 2 vs the sleep policy.** Scene 2's eddy around a still pointer has
  only the settling window (~1.5 s) to form, because a still pointer is not an
  input. Either the scene or the policy has to give.
- **Night's item glow is a DOM `box-shadow`** driven from JS (it only writes
  when the value moves), plus a warm rim on the ground. Phase 1 needs a hook on
  the item layer for the DOM half.
- **The pointer's own firefly and the cursor art** (ladybird, comet, firefly)
  are not drawn as cursors here. The system cursor stays.

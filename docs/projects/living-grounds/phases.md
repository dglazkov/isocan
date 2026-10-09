---
status: partial
since: 2026-10-09
see: groups-by-hand
note: "the walk: a prototype bench that measures before anything ships, the living layer with Meadow, every cursor and every item touching the ground, Orbit and Night, motion settings and more grounds, evidence."
---

# Living grounds — the walk

**9 October 2026.** Held to [journey.md](journey.md) and [design.md](design.md).

**Where we are, 9 Oct 2026: phases 1 and 2 are CLOSED — Meadow lives in isocan and parts under every cursor on the canvas, people's and agents'. Phase 0 is PART-DONE (the bench; Dion has settled Orbit-for-Galaxy and the eddy). Next: living-grounds phase 3, Orbit as Galaxy, and Night.**

Rules for every phase, on top of `AGENTS.md`:

- **An idle canvas stays idle.** `idle-at-rest` passes on a canvas wearing every
  living ground, untouched. A ground that cannot settle does not ship.
- **Measured, not felt.** Each ground's GPU and main-thread cost per frame is
  measured on the bench (phase 0) before it ships, and again on the canvas.
- **Nothing in the entry chunk** but theme names. A living ground's code loads
  only where one is worn.
- **Still is always there.** Reduced motion, no WebGL2 and a lost context all
  give the still frame, and a test says so.

## Phase 0 — The prototype bench

**Status: PART-DONE, 9 October 2026.** `prototype/index.html` draws Meadow, Orbit and Night in WebGL2 over six stand-in cards, with the real pointer and two scripted cursors (a person, an agent), Motion, density and a live cost panel. Measured at 2560×1440 on an M4 Pro, saturated GPU ms per frame at density ×1: Meadow 1.05 (32k blades), Orbit 0.69 (4,096 particles), Night 1.37; JS under 0.5 ms; every ground stops drawing 1.5 s after the input stops, in Chrome and WebKit alike (`prototype/README.md`). Waits on Dion: which grounds earn a place (published for him), Orbit replacing Galaxy, and the scene 2 eddy.

**Outcome:** a standalone page, `docs/projects/living-grounds/prototype/index.html`,
with Meadow, Orbit and Night drawn by WebGL2 over a fake canvas: a few
rectangles standing in for items, the real pointer, and two scripted "other
cursors". A panel shows per-frame CPU and GPU time
(`EXT_disjoint_timer_query_webgl2` where available) and blade or particle
counts, with a density slider. It settles the open questions in design.md:
whether Orbit can replace Galaxy, and the density each ground can afford.

**Proof:** the page runs in Chrome and Safari. A recorded note gives each
ground's frame cost at 1440p on this Mac at the chosen density, and confirms
each settles to zero frames within 3 s of the input stopping. Dion looks at it
and says which grounds earn a place. That last step is a person's: the bench
proves cost, not taste.

### Trajectory

- **2026-10-09** — Measured on an M4 Pro, not the M1 the budget names; the M1 densities (Meadow ×0.5–1, Orbit ×1–2, Night ×0.5) are extrapolated until someone runs the bench on one. WebKit via playwright, not Safari.app.
- **2026-10-09** — Decided (Dion, 9 Oct: "Slow swirl is kinda cool, right?"): the eddy stays. A pointer resting over Orbit keeps it awake for an eddy window of about 15 s after the last move, then it settles and sleeps as any ground does; any move restarts the window. An untouched canvas still sleeps, so `idle-at-rest` holds.
- **2026-10-09** — Decided (Dion: "Orbit should replace Galaxy yah"): Orbit is how Galaxy is drawn. The stored theme stays `galaxy` and keeps its label, so every canvas wearing Galaxy becomes living with no migration; its still frame is Orbit at rest, which reads as today's Galaxy. The screen-space zoom drift is fixed before the swap.
- **2026-10-09** — Open: Orbit's stars live in screen space (pan is parallax, zoom only mild), and repeated zoom-outs gather them toward the centre for a while; to fix or accept before Orbit replaces Galaxy.

## Phase 1 — The living layer, and Meadow

**Status: CLOSED, 9 October 2026.** `GroundHost`, the input field (this viewer's pointer, item rectangles, a 256² trail) and the sleep policy run Meadow on a canvas that wears it: blades bend away and spring back, items press the grass flat, the field thins into a textured green zoomed out. The `meadow` journey: awake while the pointer moves (91 frames), the trail readback 0.69 at the crossed point, asleep 1.5 s after it stops and zero frames after; reduced motion and a forced no-WebGL2 both draw the still with no WebGL canvas and no living chunk fetched. `meadow-idle`: main thread 1% busy. Entry chunk +226 bytes; the host (12 KB) and Meadow (9 KB) are lazy chunks.

**Outcome:**

- `GroundHost`, `InputField` (this viewer's pointer and item rectangles) and
  the sleep policy, mounted by `CanvasThemeLayer` for a living theme.
- Meadow, with its still frame, its cursor and the still fallback.
- `meadow` in core `THEMES`, and `isocan canvas background meadow`.

**Proof:**

- Unit tests for the sleep policy (awake, settling, asleep transitions) and the
  input field (world transforms, item culling past 64).

### Trajectory

- **2026-10-09** — The sleep cap counts 3 s from the last input; "awake" ends 250 ms after it. design.md's "awake 2 s, then settle up to 3 s" was 5 s and could not meet this phase's own bound; the design now says so.
- **2026-10-09** — Meadow's still frame is rendered from its own shader (`scripts/ground-still.mjs`), not painted: the blade lattice repeats every 896 world units, so the still is the living field at rest and tiles without a seam. Re-render when the shader changes.
- **2026-10-09** — Items already press the grass (phase 2's half): the input field carried item rectangles from the start.
- **2026-10-09** — Open: GPU cost and context-loss recovery are proved by the bench and by code, not by a journey on the canvas; headless WebGL2 on Linux CI is unchecked (the journey falls back to proving the still).

- `idle-at-rest` on a Meadow canvas.
- A `meadow` journey: the cursor moves over empty canvas, the trail texture
  shows a stamp at that world point, and the loop stops within 3 s of the
  pointer stopping.
- Reduced motion and a forced no-WebGL2 path both draw the still frame.
- Entry chunk measured before and after.

## Phase 2 — Every cursor, every item

**Status: CLOSED, 9 October 2026.** Every presence cursor CursorLayer draws, people's and agents', feeds the ground's field (≤16, newest win, agents weighted by one constant `AGENT_WEIGHT = 1`), from the presence the tab already receives. The `meadow-others` journey: page A asleep, a CLI agent identity walks across it with `session move`, A wakes (264 frames), the trail reads 0.65–0.75 along the agent's path and 0 far from it, and A sleeps 2.2 s after the last move. A test reads the presence message fields and the ground's files to prove nothing new is sent.

**Outcome:** presence cursors (people and agents) feed the input field, and
items press the ground: Meadow flattens grass under item footprints.

**Proof:** a journey with a second identity moving its cursor through the CLI
or a second page: the first page's trail texture shows the other cursor's path,
and its loop wakes for it. Nothing new is sent over presence; a test reads the
messages.

### Trajectory

- **2026-10-09** — A working agent's wander is drawn by each browser from the bare fact that it is working; no positions arrive for it. It is drawn but does not touch the grass (`realMove` passes a working cursor's position only when the daemon really moves it), so a canvas with an agent at work sleeps between real moves: asleep 1.6 s into `session work`, zero frames through 14 wander positions; with the guard removed the journey fails.
- **2026-10-09** — Entry chunk 705,842 after phases 1–2 (+458 from 705,384), 458 bytes under the ceiling: phase 3's grounds must stay wholly lazy.

## Phase 3 — Orbit and Night

**Status: NOT STARTED.**

**Outcome:** both grounds with their stills and cursors. Orbit replaces
Galaxy (the `galaxy` theme, its label kept), with the held-button reversal and
the eddy window under a resting pointer. Night's woken fireflies and glow near
items.

**Proof:** journeys per ground (wake on move, settle to rest, still under
reduced motion). Frame cost on the canvas at or under the bench numbers.
`idle-at-rest` on each.

## Phase 4 — Motion settings, the menu, more grounds

**Status: NOT STARTED.**

**Outcome:**

- The per-viewer Motion setting (Full · Calm · Still).
- The background menu's live previews.
- The proposed grounds (Pond, Zen garden, Snow, Aurora) that phase 0 or later
  use said are worth it.

**Proof:**

- Calm draws nothing while untouched.
- The menu sets the shared `theme` in one undo.
- Each new ground meets the same bounds as phase 3.

## Phase 5 — Evidence

**Status: NOT STARTED.**

**Outcome:**

- `scripts/frames.mjs` measures each living ground under its 4× CPU throttle.
- The performance persona owns a number for living-ground frame cost.
- A verify walk in `docs/verify/` for the parts only a person can judge: does
  the grass feel like grass, does the motion distract while reading.

**Proof:** the persona's first page with the number, and the walk written.

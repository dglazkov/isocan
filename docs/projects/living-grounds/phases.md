---
status: partial
since: 2026-10-09
see: groups-by-hand
note: "the walk: a prototype bench that measures before anything ships, the living layer with Meadow, every cursor and every item touching the ground, Orbit and Night, motion settings and more grounds, evidence."
---

# Living grounds — the walk

**9 October 2026.** Held to [journey.md](journey.md) and [design.md](design.md).

**Where we are, 10 Oct 2026: phases 1–5 are CLOSED — seven living grounds (Meadow, Night, Galaxy drawn by Orbit, Pond, Zen garden, Snow, Aurora), touched by every cursor, asleep when nobody moves, with a per-viewer Motion setting and menu previews, and their frame cost measured and owned by the performance persona. Phase 0 is PART-DONE (the bench). What is left is a person's: the walk in `docs/verify/2026-10-10-living-grounds.md` waits on Dion, and nobody has measured on an M1.**

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

**Status: CLOSED, 9 October 2026.** Galaxy is drawn by Orbit, and the CSS starfield is gone. Its stars are world-anchored in five levels that keep the on-screen density steady: three zoom-outs to 0.27 and back left the centre count at 166.2 → 166.2. A resting pointer keeps it awake for its 15 s eddy window: the `orbit` journey saw stars drawn inward at 24.8 px/s at rest and pushed outward at 153 px/s with the button held, and sleep at 15.8 s. An untouched galaxy sleeps (`orbit-idle` 1% busy). Night: a dark meadow under a dim sky with far bokeh; every cursor is a firefly (a new `firefly` cursor whose lantern is a hole the ground lights) whose trail wakes more; a card near a light catches a warm glow, written only when it changes. The `night` journey: awake while moving, a near card's glow 0.22 and a far card's none, asleep 1.6 s after the stop, the glow cleared. Reduced motion draws each ground's still with no WebGL canvas.

**Outcome:** both grounds with their stills and cursors. Orbit replaces
Galaxy (the `galaxy` theme, its label kept), with the held-button reversal and
the eddy window under a resting pointer. Night's woken fireflies and glow near
items.

**Proof:** journeys per ground (wake on move, settle to rest, still under
reduced motion). `idle-at-rest` on each. (Amended 9 Oct: "frame cost on the
canvas at or under the bench numbers" moves to phase 5, whose `frames.mjs`
run is that measurement; phase 3 ships on the bench's numbers.)

### Trajectory

- **2026-10-09** — Orbit's stars are world-anchored, not the bench's screen-space particles: a star's resting place depends only on the view, so pan and zoom never gather them. The only per-frame state is each star's displacement from home.
- **2026-10-09** — The eddy window is a ground-declared `restWindow` in the sleep policy (Orbit 15 s, Meadow none), and only a pointer that has really moved over the canvas can rest — leaving or losing focus counts as input — so an untouched galaxy still sleeps.
- **2026-10-09** — Galaxy kept its sparkle cursor (it reads as a star with a ray; a comet is entry bytes). Night's sky and horizon are screen space, so its still is the whole scene pinned and covering, not a world tile.
- **2026-10-09** — Item glow is `--ground-glow` on the lit items only, measured for items within 300 px of a light and written on a change over 0.02; the deep run caught the first cut's literal colour and undefined variable, now `--firefly-glow` and a default.
- **2026-10-09** — Open: Night's grass reads nearly black unless a firefly lights it — darker than the bench; Night ships at density ×0.5 and Orbit at the bench's ×1, neither measured on an M1; entry 705,983, 317 bytes under the ceiling.

## Phase 4 — Motion settings, the menu, more grounds

**Status: CLOSED, 10 October 2026.** Motion is a per-viewer choice in the Background menu (localStorage, no op, no verb). The `ground-motion` journey: Full draws 33 frames at mount; Calm draws one (the mount paint) and none in the 3 s after, yet wakes for a pointer (49 frames, trail 0.70); Still mounts no WebGL canvas and fetches no ground chunk; a ground picked from the menu is one ⌘Z. Each menu row carries the ground's still as a thumbnail that drifts on hover. Four more grounds, each with its own journey, asleep inside 3 s with zero frames after, and a still under reduced motion: **Pond** (ripple height 1.32 at the crossed point, 0 far; koi that dart away), **Zen garden** (raked 0.97 where the cursor went; the line holds asleep at 0.94 and softens to 0.75 over ~3 s awake; items sit in raked rings), **Snow** (trodden 0.996 on the path; holds 0.92 asleep, fills to 0.77 with awake time), **Aurora** (ribbons lean 0.99 over the cursor's column, 0.0006 across the screen; a near card catches 0.44 of the light). Idle journeys 1% busy each. Entry chunk 706,269, 31 bytes under the ceiling.

**Outcome:**

- The per-viewer Motion setting (Full · Calm · Still).
- The background menu's live previews.
- The proposed grounds (Pond, Zen garden, Snow, Aurora) that phase 0 or later
  use said are worth it.

**Proof:**

- Calm draws nothing while untouched.
- The menu sets the shared `theme` in one undo.
- Each new ground meets the same bounds as phase 3.

### Trajectory

- **2026-10-10** — `Field` gained `ease` (the awake envelope); `ambient` is `ease` under Full and 0 under Calm. A ground gates what a cursor causes on `ease` and what nobody caused on `ambient`.
- **2026-10-10** — Calm paints rather than wakes for mount, pan and item changes: one frame, then none untouched. "Calm draws nothing while untouched" is true after that one paint, which the canvas needs to have a picture. A zero-distance pointermove (the browser's synthetic one) no longer wakes any ground.
- **2026-10-10** — Still is decided in the lazy layer, not the entry: 0 entry bytes, at the cost of fetching the `LivingGround` chunk (reduced motion does not).
- **2026-10-10** — The menu's preview is the still JPEG with a CSS drift, not the live shader: no script, no second WebGL context.
- **2026-10-10** — Pond's ripples are a 768² half-float height field in ground space, stepped at 120 Hz; the pass stops 2.6 s after the last press. Zen's softening and Snow's fill are clocks that advance only while the ground is awake, so a mark outlives the host's 1.4 s trail and an asleep ground changes nothing.
- **2026-10-10** — No new cursors: Snow wears the sparkle, Pond the fish, Aurora and Zen garden the crescent. The distinct-cursor test names each borrower.
- **2026-10-10** — The entry chunk reached 706,465 with four names added (165 over). Paid back in core without touching the ceiling: plain labels are the id with a capital (three exceptions spelled out), the ground-to-cursor `switch` is a typed table, `groundtone` holds only exception rows. The menu-preview rules live in `context-menu.css` beside the menu (lazy-CSS ratchet stays 317).
- **2026-10-10** — Open: Calm is not journeyed per ground for the four new ones; no frame cost measured for them (phase 5); the Background submenu is about twenty rows and scrolls on a short window; Snow's trail is lost when panned about 1.5 screens away; a pond's still has no koi.

## Phase 5 — Evidence

**Status: CLOSED, 10 October 2026.** `node scripts/frames.mjs --grounds` walks a pointer over each of the seven living grounds on a scratch daemon at 2560×1440 under 4× CPU throttle. On an M4 Pro (not the M1 the budget names): every ground holds p95 16.7–16.8 ms with 0 dropped frames and 0 frames drawn asleep; main-thread time added per frame over the plain ground is Night 1.5 ms, Aurora 1.0, the other five 0.2–0.3. The performance persona owns `ground-frame-ms` (the costliest ground's added main-thread ms, at most 2, first reading 1.5), read from the recorded run in `scripts/ground-frames.json`; its page is `docs/reviews/2026-10-10-performance.md`. The walk for the parts only a person can judge is `docs/verify/2026-10-10-living-grounds.md`, seven steps, unverified.

**Outcome:**

- `scripts/frames.mjs` measures each living ground under its 4× CPU throttle.
- The performance persona owns a number for living-ground frame cost.
- A verify walk in `docs/verify/` for the parts only a person can judge: does
  the grass feel like grass, does the motion distract while reading.

**Proof:** the persona's first page with the number, and the walk written.

### Trajectory

- **2026-10-10** — The persona's number is main-thread time added per frame, not the frame gap: at 4× CPU on an M4 Pro every ground holds p95 16.7–16.8 ms, so the gap cannot move before a ground already stutters. The 2 ms bound is design.md's "JS under 0.5 ms" times the throttle; proposed by the builder, not yet agreed by Dion.
- **2026-10-10** — The goal reads a recorded reading, not a live walk: a five-minute browser walk cannot run on every push and CI has no trustworthy WebGL2. It moves only when somebody re-runs `frames.mjs --grounds --record scripts/ground-frames.json`; `measure.mjs ground-frame-ms --names` says when, on what machine, and whether a ground's source changed since.
- **2026-10-10** — `frames.mjs` reports no GPU time: it cannot bracket another program's draw calls from outside the page. Phase 3's deferred "at or under the bench numbers" is answered as zero dropped and zero asleep frames at 2560×1440, not as GPU milliseconds.
- **2026-10-10** — Open: the M1 is unmeasured, on the bench and on the canvas; not measured under Calm or Still, or at more than six items. Waits on somebody with an M1 running `node scripts/frames.mjs --grounds`.
- **2026-10-10** — Open: the ground canvas keeps the previous ground's probe and "asleep" state until the new ground's chunk mounts; a journey that switches grounds on one page must wait for a new probe (`frames.mjs` does). Product behaviour is unaffected.

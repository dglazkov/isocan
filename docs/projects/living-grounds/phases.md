---
status: designed
since: 2026-10-09
see: groups-by-hand
note: "the walk: a prototype bench that measures before anything ships, the living layer with Meadow, every cursor and every item touching the ground, Orbit and Night, motion settings and more grounds, evidence."
---

# Living grounds — the walk

**9 October 2026.** Held to [journey.md](journey.md) and [design.md](design.md).

**Where we are, 9 Oct 2026: designed. Next: living-grounds phase 0, the prototype bench.**

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

**Status: NOT STARTED.**

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

## Phase 1 — The living layer, and Meadow

**Status: NOT STARTED.**

**Outcome:**

- `GroundHost`, `InputField` (this viewer's pointer and item rectangles) and
  the sleep policy, mounted by `CanvasThemeLayer` for a living theme.
- Meadow, with its still frame, its cursor and the still fallback.
- `meadow` in core `THEMES`, and `isocan canvas background meadow`.

**Proof:**

- Unit tests for the sleep policy (awake, settling, asleep transitions) and the
  input field (world transforms, item culling past 64).
- `idle-at-rest` on a Meadow canvas.
- A `meadow` journey: the cursor moves over empty canvas, the trail texture
  shows a stamp at that world point, and the loop stops within 3 s of the
  pointer stopping.
- Reduced motion and a forced no-WebGL2 path both draw the still frame.
- Entry chunk measured before and after.

## Phase 2 — Every cursor, every item

**Status: NOT STARTED.**

**Outcome:** presence cursors (people and agents) feed the input field, and
items press the ground: Meadow flattens grass under item footprints.

**Proof:** a journey with a second identity moving its cursor through the CLI
or a second page: the first page's trail texture shows the other cursor's path,
and its loop wakes for it. Nothing new is sent over presence; a test reads the
messages.

## Phase 3 — Orbit and Night

**Status: NOT STARTED.**

**Outcome:** both grounds with their stills and cursors. Orbit's held-button
reversal. Night's woken fireflies and glow near items. Galaxy is replaced or
kept as phase 0 decided.

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

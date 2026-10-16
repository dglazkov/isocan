# Mood board — the walk

[`journey.md`](journey.md) is the ideal and [`design.md`](design.md) the
mechanism. Each phase ends with something a person can do, behind the
`moodboard` experiment, and switched off again by unticking it.

**Ordered so the first picture is real as early as possible.** The route
first, because if the pictures are not evocative nothing else matters. Then
keeping, because a board only exists once a person has chosen. Then
swatches, because deriving needs data the CLI can read. Then the derive
step, then the board as a critic.

**Phase citations name their project**: `moodboard phase 2`, never a bare
"phase 2".

**Where we are, 16 Oct 2026:** specified; nothing built. Three questions for
Dion are open in [`design.md`](design.md) §8.

---

## Phase 0 — One exploration, on the canvas

**Status: NOT STARTED.**

- `POST /api/image` in `model-routes.ts` under the existing refusals;
  `ISOCAN_IMAGE_MODEL` read from the live Gemini model list, with the chosen
  id and per-image price recorded in this file.
- `isocan mood explore "<words>" --n 9` adds nine `mood: candidate` image
  items with full provenance (`design.md` §1), and states the cost first.
- **Proof:** on a scratch canvas with a real key, nine tiles for Scene 1's
  words. Record latency per image, total cost, and **how many of the nine
  are not UI**. The template passes at ≥ 8 of 9 across three different
  briefs. Below that, the template is the work, not the UI.
- A person looks at the three spreads and says whether they would keep
  anything. If not, stop here and say so.

## Phase 1 — Keep, drop, more, push

**Status: NOT STARTED.**

- `mood keep|drop|more [--push <dial>]`; the *Mood* board area; closing a
  tray removes its candidates as one undoable group; `keep` refused for an
  agent actor.
- Web, behind `moodboard`, lazily loaded: *Explore a look* in the Design
  systems dialog and `/moodboard`; the tray; ✓ / ✕ / *More like this* /
  *Push*; a person's photo dropped on the board becomes `mood: reference`.
- **Proof:** a browser journey on a scratch daemon with the image route
  stubbed **at the model call only** (fixture PNGs), driving every action;
  plus one real run by hand. Adds ≤ 0 bytes to the entry chunk beyond a gate.

## Phase 2 — Swatches

**Status: NOT STARTED.**

- On keep: browser k-means, or daemon `sharp`, or a model estimate marked
  `estimated`, writing `moodSwatches`. The board draws a palette strip under
  each tile.
- **Proof:** fixture images with known colour fields read back within ΔE 3
  on both surfaces; a kept tile read by the CLI with no browser open shows the
  same swatches the web wrote.

## Phase 3 — Derive the system from the board

**Status: NOT STARTED.**

- `isocan mood board --json`; `/design-system`'s board branch;
  `tokens.isocan.sources`; *Derive from the board* through the parked agent;
  hover a token to light its tile.
- **Proof:** from Scene 3's board, a derived DESIGN.md where every palette
  token and every direction field cites a kept tile (a check fails on any
  uncited value not explained in `rationale`), and `design audit` runs
  against it unchanged.

## Phase 4 — The board as a critic

**Status: NOT STARTED.**

- A built-in critic, `board`, whose lens is the kept tiles and their
  swatches: *does this screen feel like what was kept?* It is a critique
  persona generated from the board, so it lives on the canvas and can be
  edited.
- **Proof:** Scene 4: a screen with an off-board colour gets a *Risk* note
  naming the colour and that no tile holds it; a person's walk in
  `docs/verify/` of the whole journey.

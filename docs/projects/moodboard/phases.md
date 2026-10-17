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

**Where we are, 17 Oct 2026:** phases 0 and 1 are PART-DONE and phases 2 and 3 are CLOSED — `POST /api/image`, `POST /api/image/swatches`, `isocan mood explore|keep|drop|more|board`, deterministic CIE L\*a\*b\* k-means swatches (`moodSwatches`), `.mood-swatch-strip` on kept and reference tiles, `/design-system`'s board branch with `tokens.isocan.sources` citation checking in `checkDesign`, and *Derive from the board* plus hover-token-to-peek-tile in the web app pass unit, CLI, and headless Chrome proofs; phases 0–1's real-key runs wait on a Gemini key with billing. `moodboard phase 4` (the board as a critic) is next. Dion decided the three open questions on 16 Oct 2026 ([`design.md`](design.md) §8): Flash by default, hosted homes allowed, nine tiles a spread.

---

## Phase 0 — One exploration, on the canvas

**Status: PART-DONE, 16 Oct 2026 — built; the real-key proof is owed.** `POST /api/image`
(`packages/server/src/model-routes.ts`, the model in `server/src/image.ts`)
under the spending routes' one door, now a shared `door()`; the template,
axes, deny-list, price and tray in `@isocan/core/mood`; `isocan mood explore`
in `packages/modules/mood`, behind the `moodboard` experiment (whose web half
is the record only). Proved with Google faked at `fetch` (fixture PNG):
`packages/core/test/mood.test.ts`, `packages/server/test/image.test.ts`,
`packages/cli/test/mood.test.ts`. Dion set a key and said go the same day;
the first real calls taught one thing and stopped on another (below).

- **Model:** `gemini-nano-banana-2.1` (Nano Banana 2.1, Stable, the
  Flash-tier model every example in Google's image-generation guide uses),
  from https://ai.google.dev/gemini-api/docs/models (updated 2026-10-13),
  read 16 Oct 2026. `ISOCAN_IMAGE_MODEL` overrides it.
- **Price:** **$0.0336 a 1K image** ($30 per 1M image output tokens, 1120
  tokens an image), paid tier, from
  https://ai.google.dev/gemini-api/docs/pricing (updated 2026-10-15), read
  16 Oct 2026 — a spread of nine ≈ $0.30. Written once, in
  `packages/core/src/mood.ts`. Pro (`gemini-3-pro-image`) is $0.134.
- **Unproved:** the wire. The guide documents the Interactions API
  (`POST /v1beta/interactions`, `input` blocks, `response_format: {type:
  "image"}`) but shows no raw image answer; `image.ts` reads image blocks
  out of `steps[].content[]` and says so when it finds none. The first real
  run is what checks it.
- **What the real API said, 16 Oct 2026.** First call: `response_format`
  takes `image/jpeg` only — `image/png` is a 400; the route now asks for
  JPEG. Second call: a 429, *limit: 0 input tokens per minute on Free
  Tier* — this model draws nothing on a free-tier key. **Owed:** a key on a
  project with billing, then the three spreads.

- `POST /api/image` in `model-routes.ts` under the existing refusals;
  `ISOCAN_IMAGE_MODEL` read from the live Gemini model list, with the chosen
  id and per-image price recorded in this file.
- `isocan mood explore "<words>" --n 9` adds nine `mood: candidate` image
  items with full provenance (`design.md` §1), and states the cost first.

**Proof:** on a scratch canvas with a real key, nine tiles for Scene 1's
words. Record latency per image, total cost, and **how many of the nine
are not UI**. The template passes at ≥ 8 of 9 across three different
briefs. Below that, the template is the work, not the UI. A person looks
at the three spreads and says whether they would keep anything. If not,
stop here and say so.

## Phase 1 — Keep, drop, more, push

**Status: PART-DONE, 17 Oct 2026 — built and proved in headless Chrome; the real-key hand run waits on a Gemini key with billing.** `moodKeepPlan`, `moodDropOps`, `moodTrays`, `findMoodBoard`, `MOOD_DIALS`, and `moodPushPrompt` live in `@isocan/core/mood` for both legacy (`kind: "area"`) and group-mode (`group.change` / `containerId`) canvases. `isocan mood keep|drop|more` ship in `@isocan/mood/cli`, with `keep` refusing agent actors. `@isocan/mood/web` adds `/moodboard`, *Explore a look* in the Design systems dialog, the candidate tray overlay (per-tile and multi-select keep/drop, *More like this*, *Push*, *Close tray* in one undoable group), item menu rows on kept and reference tiles, and `mood: "reference"` on photos dropped into the *Mood* board. Proved by `scripts/journey-moodboard.mjs` (7 browser checks, 21 stubbed model calls, 0 bytes added to the entry chunk).

- `mood keep|drop|more [--push <dial>]`; the *Mood* board area; closing a
  tray removes its candidates as one undoable group; `keep` refused for an
  agent actor.
- Web, behind `moodboard`, lazily loaded: *Explore a look* in the Design
  systems dialog and `/moodboard`; the tray; ✓ / ✕ / *More like this* /
  *Push*; a person's photo dropped on the board becomes `mood: reference`.

**Proof:** a browser journey on a scratch daemon with the image route
stubbed **at the model call only** (fixture PNGs), driving every action;
plus one real run by hand. Adds ≤ 0 bytes to the entry chunk beyond a gate.

### Trajectory

- **2026-10-17** — Open: run one real-key exploration, keep, *More like this*, and *Push* by hand. Waits on a Gemini API key with billing enabled.

## Phase 2 — Swatches

**Status: CLOSED, 17 Oct 2026.** Deterministic CIE L\*a\*b\* k-means swatch extraction (`swatchesFromRgba`, `deltaE`, `rgbToLab` in `packages/core/src/mood-swatches.ts`) runs in the browser on keep and drop-in reference photos (`WebModule.fileProperties` in `packages/core/src/modules.ts` + `@isocan/mood/web`), and on the daemon at `POST /api/image/swatches` (`packages/server/src/mood-swatches.ts`, `sharp` decode with picture-model fallback marked `estimated: true`, or 503 `IMAGE_SWATCHES_UNAVAILABLE` when neither is available) so `isocan mood keep` writes the same `moodSwatches` without a browser. `@isocan/mood/web` claims image items carrying `moodSwatches` (`property: "moodSwatches"`) and draws `.mood-swatch-strip` under each kept or reference tile while moving the upload drop check out of `packages/web/src/lib/upload.ts`. Proved on synthetic colour-field PNGs within ΔE ≤ 3 across core (`packages/core/test/mood.test.ts`), server (`packages/server/test/image.test.ts`), CLI (`packages/cli/test/mood.test.ts`), and headless Chrome (`scripts/journey-moodboard.mjs`, 8 checks including cross-surface CLI readback with the browser closed).

- On keep: browser k-means, or daemon `sharp`, or a model estimate marked
  `estimated`, writing `moodSwatches`. The board draws a palette strip under
  each tile.

**Proof:** fixture images with known colour fields read back within ΔE 3
on both surfaces; a kept tile read by the CLI with no browser open shows the
same swatches the web wrote.

## Phase 3 — Derive the system from the board

**Status: CLOSED, 17 Oct 2026.** `moodBoardRead` (`packages/core/src/mood.ts`) and `isocan mood board [--json]` (`packages/modules/mood/src/cli.ts`) read kept and reference tiles on legacy and group-mode Mood boards with their `axis`, `prompt`, `words`, and `swatches`. `/design-system` (`packages/core/src/command-bodies.ts`) gains the Mood board branch instructing the agent to derive `DESIGN.md` from `isocan mood board --json` and record every palette token and direction choice in `tokens.isocan.sources`. `readDesignSources` and `checkDesign(doc, { boardTileIds })` (`packages/core/src/designcheck.ts`, wired into `isocan style check` in `packages/cli/src/main.ts`) fail on any uncited palette token or direction field not explained in `direction.rationale`, or any source citing an item not on the Mood board, while `auditScreen` (`isocan design audit`) runs unchanged. In the web app, `DesignSystemsDialog.tsx` adds *Derive from the board* (dispatching `@<lead> /design-system` with `[boardId]` or showing a one-sentence notice when no agent is parked) and renders source tile chips; hovering or focusing a cited token in `DesignSystemsDialog.tsx` or `DesignSystemView.tsx` sets `setPeeked(itemId)` to light its source tile on the canvas. Proved in `packages/core/test/mood.test.ts`, `packages/core/test/designcheck.test.ts`, `packages/cli/test/mood.test.ts`, and `scripts/journey-moodboard.mjs` (10 headless Chrome checks).

- `isocan mood board --json`; `/design-system`'s board branch;
  `tokens.isocan.sources`; *Derive from the board* through the parked agent;
  hover a token to light its tile.

**Proof:** from Scene 3's board, a derived DESIGN.md where every palette
token and every direction field cites a kept tile (a check fails on any
uncited value not explained in `rationale`), and `design audit` runs
against it unchanged.

## Phase 4 — The board as a critic

**Status: NOT STARTED.**

- A built-in critic, `board`, whose lens is the kept tiles and their
  swatches: *does this screen feel like what was kept?* It is a critique
  persona generated from the board, so it lives on the canvas and can be
  edited.

**Proof:** Scene 4: a screen with an off-board colour gets a *Risk* note
naming the colour and that no tile holds it; a person's walk in
`docs/verify/` of the whole journey.

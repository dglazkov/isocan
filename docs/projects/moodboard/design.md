# Mood board — the mechanism

**16 October 2026.** The scenes are [`journey.md`](journey.md); the walk is
[`phases.md`](phases.md). Checked against the code at `715844aa5` before
writing; what exists is named with where it is.

**What exists to build on.**

- **Keys.** `gemini` is already a provider (`packages/core/src/keys.ts:15`),
  stored once in `~/.isocan/keys.json` (`keystore.ts`), set with
  `isocan keys set gemini` or the Keys dialog. Today it pays only for voice.
- **Model routes.** `packages/server/src/model-routes.ts` holds every route
  that spends a person's key — judgment, `/api/text`, the text-with-pictures
  check, the voice token. They are owner-only, refused on shared homes, rate
  limited, and forwarded to the person's home by `home.personalRequest`.
- **References.** design-partner's `DesignReference`
  (`packages/core/src/design-partner-values.ts:12`) is already the shape of
  "a thing a person pointed at as inspiration".
- **Direction.** `DesignDirection` (`packages/core/src/design-direction.ts`)
  lives in DESIGN.md front matter at `tokens.isocan.direction`, with
  `rationale`, `typography`, `density`, `palettePurpose` and `treatments`.
  Nothing derives it from images.
- **`/design-system`'s body** (`packages/core/src/command-bodies.ts:257`)
  already says *derive it from what is already there*.
- **Module gating.** `BEHIND_EXPERIMENT` and `EXPERIMENT_HALVES` in
  `packages/web/src/modules.ts`, with critique as the recent pattern.

**What is new.** Two things. An **image route**, because nothing in isocan
generates a picture. And **swatches written onto a kept image**, because
`core/colour.ts` deliberately reads no pixels (the standing harness has no
decoder). Everything else is items, properties and an agent prompt.

---

## 1. A tile is an image item with provenance

Every generated picture lands as an ordinary image item via `item.add`. No
new op is needed. Its properties say what it is:

| property | value |
| --- | --- |
| `mood` | `candidate` (in the tray) · `kept` (on the board) · `reference` (a person's own picture) |
| `moodPrompt` | the exact prompt sent, after the template (§3) |
| `moodAxis` | the line shown under the tile: what it reached for |
| `moodParent` | the tile it varies, for *More like this* and *Push* |
| `moodModel` | the model id that drew it |
| `moodSwatches` | JSON: up to six `{hex, share}`, written when kept (§4) |
| `moodRun` | the exploration it came from, so a tray can be closed as one |

A **board** is an area (or group, on group-mode canvases) named *Mood* by
default, with `moodBoard: true`. Keeping moves a tile into it and sets
`mood: kept`. Closing a tray deletes its remaining `candidate` tiles in one
undoable group. A kept tile is an item like any other: drag it, drop it,
comment on it.

**Why items and not a side store**: the CLI and the web see the same board
through the same snapshot, a collaborator sees what was kept, history and
undo work, and an agent can read the board with `isocan ls`.

## 2. The image route

`POST /api/image` in `model-routes.ts`, beside `/api/text`, under the same
refusals: owner-only, not on a shared home, rate limited, and forwarded to
the person's home. Body: `{ canvasId, prompt, n, parent?, size }`. It calls
the Gemini image model with the person's `gemini` key, uploads each result
as a blob, adds the items, and returns their ids.

- **The model id is configuration**, `ISOCAN_IMAGE_MODEL`, never hard-coded.
  Google's naming moves ("Nano Banana", 2, Pro, 2.1), and third-party lists
  disagree with each other. Phase 0 reads the live model list and records
  the id it chose and its price.
- **Spend is said before it is spent.** The tray's *Explore* button and
  `isocan mood explore` both state *n images ≈ $x* from the recorded price
  and refuse past a per-run cap (default 12 images), the way critique caps a
  critic per run.
- **Pictures in.** *More like this* on a person's own photo sends that image
  as input (the model takes image + text). A reference never leaves the
  person's home except to this call.
- **Watermarks stay.** Google's images carry SynthID. Nothing strips it, and
  `moodModel` says the tile was generated.

## 3. The prompt template: a feeling, not a screen

The words a person types are wrapped in a template that names the axes and
rules out UI, because the model's pull toward drawing an app screen is
strong:

> *An evocative photograph or still life — not a user interface, not a
> screen, no text overlays — about: {words}. Reach for {axis}. Natural light,
> real materials.*

One exploration of *n* spreads across **axes**: light, material, texture,
colour field, era, density, the place it lives, and lettering-as-object (a
sign, a stamp, a label: type character without asking for a font). Each
tile's `moodAxis` records which. **Push** re-asks the parent's prompt with
one adjective changed along a named dial (`warmer`/`cooler`,
`quieter`/`louder`, `older`/`newer`, `rougher`/`finer`) and records it.

## 4. Swatches: read once, where there is a decoder

`core/colour.ts` refuses pixels on purpose, and that stays. Instead, when a
tile is **kept**, the surface that has a decoder reads it once and writes
`moodSwatches` onto the item:

- **in the browser**: draw to a canvas, k-means to six, drop near-duplicates
  (ΔE < 6), order by share;
- **from the CLI**: the daemon reads it with `sharp`, which the server
  already lists as an optional dependency. Without `sharp`, the CLI asks the
  pictures-capable text model for six hexes and marks them `estimated`.

After that, everything (the derive step, the audit, a critic) reads
swatches as data. No later step needs pixels.

## 5. Deriving the system

`/design-system` gains one branch: **when the canvas has a board with kept
tiles and no governing system, derive from the board**. Its body tells the
agent to:

1. `isocan mood board --json`: every kept tile, with `moodAxis`,
   `moodPrompt`, `moodSwatches` and the person's original words;
2. look at the tiles (an agent with pictures reads them; one without works
   from the swatches and axes, and says so);
3. write DESIGN.md with `isocan design set`: a palette drawn from swatches,
   and a direction (`typography`, `density`, `palettePurpose`,
   `treatments`, `rationale`) where **every value cites a tile** in a new
   `tokens.isocan.sources` map, `{ token → itemId }`;
4. not invent a colour no tile holds without saying so in `rationale`.

The web's **Derive from the board** runs the same command through the
person's parked agent, as *Critique with…* does. No agent parked means one
sentence, nothing written. The Design systems dialog then shows each token's
source tile on hover.

## 6. What it refuses

- **Living artists, brands, logos, real faces.** The template forbids them,
  and a typed request naming one is refused in words before any spend (a
  short deny-list plus the model's own policy refusals, passed through
  verbatim).
- **An agent keeping.** `mood keep` is refused when the actor is an agent.
  The board is a person's taste.
- **A guest spending the owner's key.** This is inherited from the model
  routes' owner-only rule.

## 7. Both surfaces

| person in the web | person or agent in the CLI |
| --- | --- |
| Design systems → *Explore a look*; `/moodboard` | `isocan mood explore "<words>" [--from <item>] [--n 9]` |
| tile ✓ / ✕ | `isocan mood keep <item>` · `mood drop <item>` |
| *More like this* · *Push → quieter* | `isocan mood more <item> [--push quieter]` |
| drag a photo onto the board | `isocan add photo.jpg --in Mood --prop mood=reference` |
| *Derive from the board* | `/design-system` (or `isocan mood board --json` + `design set`) |
| *Critique with… the board* | `isocan critique <item> --by board` |

## 8. Open questions for Dion

1. **Flash or Pro by default?** Pro looks better and costs several times
   more per image. Proposal: Flash for exploring, with a *Redraw in Pro*
   action on a kept tile.
2. **Hosted homes.** On isocan.io, should exploring be allowed at all (owner
   pays, owner-only), or local-only at first? Proposal: owner-only
   everywhere, as with `/api/text`.
3. **Default spread.** Nine tiles across the axes, or six? Proposal: nine;
   the cap is twelve.

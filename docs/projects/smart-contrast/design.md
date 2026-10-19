---
status: designed
since: 2026-10-19
see: living-grounds, design-lint
note: "The mechanism for smart contrast: a pure tone function in core (dark | light | mid) over the colour a ground is actually drawn in, a ground-ink token tier the canvas switches with one data attribute, a glass plate for the mid case, a sampled tone for pictures, and a guard that measures every ground-ink token against every ground."
---

# Smart contrast — design

**19 October 2026.** The scenes are [`journey.md`](journey.md); the walk is
[`phases.md`](phases.md). Checked against the code at `b156a63b2`; what
exists is named with where it is.

**The debt this discharges.** Chrome drawn straight onto the canvas takes its
ink from the *app's* theme, and the canvas's ground does not follow the app's
theme. `lib/groundtone.ts` found exactly this shape on 8 Sep 2026 — *"chrome
that assumes the ground is the app's, on a canvas whose ground is its own"* —
and fixed it for one element, the top fade. This is the same fix for
everything else that stands on the ground.

## What exists to build on

- **`core/src/contrast.ts`** — `luminance`, `contrastRatio`,
  `CONTRAST_BODY` (4.5), `CONTRAST_UI` (3). The maths is done.
- **`core/src/textcolour.ts`** — a named text colour already resolves to a
  *shade per surface* (light ground, dark ground, paper), each held at 4.5:1 by
  `textcolour.test.ts`. Today "which surface" means the app's theme. Smart
  contrast changes what picks the shade, not the shades.
- **`web/src/lib/groundtone.ts`** — `groundTone(canvas)` returns the CSS token
  a ground paints with (`--theme-space`, `--theme-snow`, `--ground-under` for a
  picture). `groundtone.test.ts` already requires every ground in `THEMES` to
  have one, and the token to be the one the ground's own rule paints with.
- **The `--theme-*` tokens** in `styles.css` are each ground's *measured* mean
  colour (8 Sep and 9–10 Oct 2026), not a guess.
- **`GROUND_SCRIM` (0.7)** in `core/src/theme.ts` — a picture is always drawn
  under 70% black, so its brightest possible mean is `#4d4d4d`.
- **The two theme blocks** in `styles.css` already hold an ink family for a
  dark surface (`--ink #e7e9ec`, `--ink-muted #8b929d`, `--accent-text
  #8fa8ff`) and one for a light surface. What is missing is a way to choose
  between them *by ground* rather than *by app*.

## Measured: who fails where, today

Contrast of the ink the app draws on the ground today, against each ground's
mean. Bold is below the floor (4.5 for text, which every one of these is).

| Ground | Mean | light: name `--ink-muted` | light: selected `--accent` | dark: name `--ink-muted` | dark: selected `--accent` | dark: note `--ink` |
| --- | --- | --- | --- | --- | --- | --- |
| dot grid (light app) | `#fbfbf9` | 5.08 | 7.56 | — | — | — |
| dot grid (dark app) | `#0e0f12` | — | — | 6.11 | **3.32** | 15.8 |
| Galaxy | `#05060c` | **3.85** | **2.58** | 6.45 | **3.51** | 16.6 |
| Night | `#0a0d10` | **3.70** | **2.49** | 6.21 | **3.38** | 16.0 |
| Ocean | `#314852` | **1.83** | **1.23** | **3.07** | **1.67** | 7.9 |
| Meadow | `#223112` | **2.63** | **1.77** | **4.42** | **2.40** | 11.4 |
| Picture (brightest) | `#4d4d4d` | **1.61** | **1.08** | **2.70** | **1.46** | 6.95 |
| Desert | `#ab703b` | **1.28** | **1.91** | **1.31** | **1.41** | **3.38** |
| Zen garden | `#b5ac9a` | **2.34** | **3.48** | **1.39** | **2.56** | **1.85** |
| Snow | `#cdd7ec` | **3.64** | 5.42 | **2.17** | **3.99** | **1.19** |

(Rock, Farm, Aurora and Pond land with their dark neighbours.) Two readings:

1. **Dion's screenshot is the dark-app row, and it fails on the dot grid
   too.** `.item.selected .item-titlebar { color: var(--accent) }` draws the
   accent as *text*; the dark block's own comment says `--accent` measures
   3.32 on `--ground` and that `--accent-text` (8.41) exists for exactly this.
   That one line is phase 0, and it is worth doing tonight whatever happens
   to the rest.
2. **The bigger failure is the mirror image.** In dark mode on Snow or Zen,
   the words of a chromeless text note are 1.19 and 1.85. Nobody reported it
   because the screenshot that shows it is mostly white.

## 1. The tone of a ground (core)

```ts
// core/src/groundtone.ts — pure; web and CLI both call it
export type GroundTone = "dark" | "light" | "mid";
export function toneOfColour(hex: string): GroundTone;
export function groundColour(canvas, app: "light" | "dark"): string | null;
export function toneOfGround(canvas, app: "light" | "dark", sampled?: string): GroundTone;
```

- **The colour.** The dot grid's is the app's `--ground` (so a canvas with no
  ground behaves exactly as today). A seeded ground's is its mean, from a
  `GROUND_MEAN` table in core — eleven hexes, about 120 entry bytes, the same
  values as the `--theme-*` tokens, and a test holds the two equal the way
  `groundtone.test.ts` holds the token names. A picture's is the sampled mean
  under the scrim (§4), falling back to the brightest it could be, `#4d4d4d`.
- **The rule.** `dark` when every token of the on-dark ink set passes on that
  colour; `light` when every token of the on-light set does; otherwise `mid`.
  It is the ink sets that decide, not a luminance threshold, so the tone can
  never say "dark" for a ground the dark ink fails on. (A 0.18-luminance cut
  would have put Ocean on the right side and still drawn `#8b929d` on it at
  3.07.)
- **Derived, never stored.** No property, no op, no migration. Choosing a
  ground is still one `project.update` and one undo, and the tone follows it
  in every browser the way the living grounds' motion does: computed from what
  the viewer already has, never sent.

**The name.** `web/src/lib/groundtone.ts` returns a token name today and
would collide; it becomes `groundToken()` in the same phase, which is a
rename with one caller (`CanvasPage.tsx`).

## 2. The ground-ink tier (web)

Five tokens for things drawn on the ground, separate from the ink inside
cards:

| Token | Used for | on-dark | on-light |
| --- | --- | --- | --- |
| `--ground-ink` | chromeless text node words, a name being renamed | `#e7e9ec` | `#23262b` |
| `--ground-ink-muted` | item names, speaker-note captions | `#b8bec8` | `#383d44` |
| `--ground-ink-soft` | kind icons, quiet glyphs (non-text, 3:1) | `#b8bec8` | `#383d44` |
| `--ground-accent` | a selected name, the selection ring and hover dash | `#b4c4ff` | `#18288a` |
| `--text-<name>-ground` | a named text colour on a chromeless node | the dark shades | the light shades |

The values are proposals; the guard (§6) is what pins them. Each was picked as
the nearest colour to today's that passes on the *worst* ground of its side:
on-dark is bound by the brightest picture (`#b8bec8` 4.52, `#b4c4ff` 4.94),
on-light by Zen (`#383d44` 4.86, `#18288a` 5.46). The dark text-colour shades
were chosen against `#0e0f12`; some will fail on Ocean or a picture, and the
guard will say which ones to lift.

**The switch is one attribute.** `CanvasPage` stamps
`data-ground-tone="dark|light|mid"` on `.canvas-page`, the one element every
ground-standing thing descends from. No
attribute (a canvas on the dot grid) means the tier resolves to the app's own
tokens, so the common case is byte-for-byte today's picture:

```css
.canvas-page { --ground-ink: var(--ink); --ground-ink-muted: var(--ink-muted); /* … */ }
.canvas-page[data-ground-tone="dark"]  { --ground-ink: #e7e9ec; /* … on-dark */ }
.canvas-page[data-ground-tone="light"] { --ground-ink: #23262b; /* … on-light */ }
```

**Cards do not move.** A white card on Galaxy in light mode stays white with
dark ink inside. That is the reason this is a tier and not "apply the dark
theme to the canvas": the card is the app's surface, chosen by the person,
and the ground is the canvas's.

**The rule for what moves:** an element moves to the tier if, and only if, the
pixels behind its ink are the ground. Anything with its own opaque fill — the
`×11` count badge, a glass toolbar, the `1600 × 900` chip, a paper note, a
comment pin — keeps the app's tokens, because its ink is measured against its
own fill. Phase 1's inventory is this rule applied to `styles.css`; the
starting list is `.item-titlebar` and `.kind-icon`, `.item.selected
.item-titlebar`, `.name-input`, `.item.textnode .md-view` and `.note-of`, the
hover-target dash and selection ring, and group band labels. The list as
built is `GROUND_INVENTORY` in `packages/web/test/groundtext.ts`, which has 24
entries. The canvas title is not on it: it sits on the glass of
`.bar-cluster.floats`, so by this rule it keeps the app's tokens (phase 1
trajectory).

**Identity colours do not move.** The seven `IDENTITY_COLORS` say who is who
(`core/src/theme.ts`, #195), so a person's colour keeps its hue on every
ground. Where one is drawn as text straight on the ground (a remote cursor's
name), it gets the plate (§3) rather than a new colour.

## 3. Mid: the plate

When the tone is `mid`, chrome that would carry ground ink sits on a small
pill of `--glass` with `--glass-filter` — the same surface every menu has worn
since 16 Oct — and inherits the app's tokens, because its ink is now standing
on app glass. It is a class on the titlebar's text run, so the row's geometry
(held by `titlebar.test.ts`) does not move.

Desert is the one seeded ground that lands here (white 4.11, dark 3.70), and
no small scrim rescues it: at 10% black the muted ink is still 2.6. So the
plate is not a fallback that never fires; it is Desert's answer.

**Chromeless text nodes on a mid ground** take the higher of the two inks
(white, 4.11, which is past WCAG's 3:1 large-text floor for a note set at 24px
or more and short of 4.5 below it) plus a one-pixel halo in the opposite ink.
Chrome gets the plate. This was decided on 19 Oct; see the end.

## 4. Pictures: take a look

A picture's tone is sampled once, when it has decoded: draw it into a 16×16
canvas, average in linear light, composite under `GROUND_SCRIM`, and hand the
hex to `toneOfGround`. It is tens of microseconds, cached by the picture's
sha256, and never stored. Until it decodes, the tone is the worst case
(`#4d4d4d` → dark), which is what the scrim guarantees anyway.

Under today's fixed 0.7 scrim every picture is `dark`, so this phase changes
nothing anyone can see. It is built because the rule should be "take a look",
not "assume", and because it is what makes a lighter scrim for pale pictures
a one-number change later instead of a design.

## 5. The crossfade

The five tokens are registered with `@property { syntax: "<color>" }` so a
change of tone transitions them over 200ms rather than snapping, and
`.item-titlebar` already carries `transition: color 0.12s`. Under
`prefers-reduced-motion` the registration's transition is off and the ink
changes in the same frame as the ground. A living ground's still frame and its
first WebGL frame have the same mean, so the tone does not flicker when the
layer wakes.

## 6. The guard

`web/test/groundcontrast.test.ts`, the forcing function, modelled on
`textcolour.test.ts` and `groundtone.test.ts`:

- for every ground in `THEMES`, plus the dot grid in both app themes and the
  brightest picture: compute `toneOfGround`; **no seeded ground may be `mid`
  except those listed with a reason** (Desert, today);
- for every token in the tier: measure it, for the tone that ground resolves
  to, against the ground's mean — `CONTRAST_BODY` for text tokens,
  `CONTRAST_UI` for `--ground-ink-soft` and the ring;
- `GROUND_MEAN` in core equals the `--theme-*` values in `styles.css`;
- **the inventory holds**: a selector on the inventory list may not name
  `--ink`, `--ink-muted`, `--ink-soft`, `--accent` or `--accent-text` for
  `color`, `border-color` or `outline-color` — only the tier. The same shape
  as `dimmed.test.ts`, which refuses faded text on sight.

A new ground then cannot ship without a mean, a tone, and every ground-ink
token passing on it. That is the "system takes a look" part, held by a test
rather than by somebody remembering.

## 7. Both surfaces

1. **Op vocabulary** — none. The tone is derived from a property that already
   exists.
2. **CLI verb** — none new. `isocan canvas background` (bare) adds the tone
   to what it already prints: *"Night — a dark ground; ink on it is light."*
   `isocan canvas show --json` carries `groundTone`.
3. **Agent guide** — one sentence in the backgrounds topic: named colours
   adapt to the ground; a hex is warned about against the ground this canvas
   actually has.
4. **Core** — `toneOfGround`, `GROUND_MEAN`, and `textColourWarnings` taking
   the canvas's ground colour instead of looping over two app grounds the
   canvas does not have.
5. **README** — one line in the grounds paragraph.
6. **Tests** — §6, plus a headless-Chrome walk that reads computed colours
   off a selected titlebar on three grounds in both themes and says so in the
   report.

## Not doing, and why

- **Per-pixel or per-item sampling.** The mean is what every ground's
  holding colour already is, and a living ground's brightness moves under the
  cursor by design. Sampling the region under each name is a later phase
  that waits for evidence — a measured failure on a real ground — not a
  default.
- **A person's override.** `GROUND_SCRIM`'s comment is the precedent: fixed is
  the honest start, and if the rule is wrong for a class of ground that is
  evidence to fix the rule, not a reason to ship a toggle first.
- **Recolouring cards, papers, or identity colours.** Each is measured against
  its own surface already, or carries a meaning a new colour would delete.
- **APCA.** WCAG 2's ratio is what `contrast.ts`, the design audit and the
  front door's `contrast-failures` bound all speak. A second metric here would
  be a second opinion nobody else in the codebase can check.

## Decided by the conductor, 19 Oct 2026 — for the walk to confirm or overturn

Dion said "go through all the phases", so both questions were taken rather
than held. Each is one value or one rule to change if the phase 5 walk says
it reads wrong.

1. **Text nodes on Desert: the higher ink plus a one-pixel halo.** A glass
   backing behind every chromeless note would make Desert the one ground where
   a text node is a card, which contradicts what a text node is; regrading the
   tile is the artist's call, not code's. The halo is the smallest change, and
   only Desert pays it.
2. **One lifted accent, `#b4c4ff`, on every dark ground.** A plate on Ocean
   and on pictures only would make "selected" look different from one dark
   ground to the next. One value that passes everywhere beats two that pass
   most places.

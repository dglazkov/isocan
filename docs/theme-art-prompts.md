# Prompts for painted grounds (#195)

Copy one block at a time into an image model. Each is self-contained — nothing
above or below it needs to go with it.

The grounds ship **procedurally generated** today (`packages/web/src/components/themes/`).
That was a deliberate stopgap, and the switch was built to take a painted tile
without rework — so anything produced from these is a drop-in replacement, not a
migration.

---

## Read this once before generating anything

Four constraints come from the app rather than from taste. Every prompt below
already carries them, but if you edit a prompt, keep them.

**1. Two variants per theme, and they are different pictures.**
A ground either travels with the canvas (`world`) or stays behind the glass
(`window`). Those need different art and cannot be swapped:

| | `world` — travels with the canvas | `window` — pinned behind the glass |
| --- | --- | --- |
| Repeats? | Yes, forever, in both directions | No. Seen once |
| So it must be | **Seamlessly tileable, plan view** | A single image, may have a horizon |
| Why | An infinite canvas pans anywhere | It never moves, so it never reveals a seam |

**2. `world` art can have no horizon.** This is the constraint that decides
everything else, and it is not negotiable: a horizon line repeats absurdly the
moment it tiles — you get a stack of sunsets. That is why the shipped grounds
are all plan views (straight down), and it is why "mountains" is ridgelines on
a map rather than peaks against a sky.

**3. It is a work surface, not a picture.** Screens, drawings and cards sit on
top of this all day. A ground that competes is a ground somebody turns off. Aim
for something you notice when you look for it and stop seeing while you work.

**4. Dark, and the same in light mode and dark mode.** These are *pictures*,
not surfaces that follow the app's theme, and white item cards must read as
objects standing on them. The shipped base colours are the target:

- space `#05060c` · ocean `#0b2733` · rock `#2b2825`

---

## 1. Space Galaxy — `world` (seamless tile)

```
A seamlessly tileable square texture of deep space, viewed as an infinite
starfield with no horizon and no focal point.

Near-black background, colour #05060c. Small stars scattered at varying
brightness and size, most of them faint; a handful brighter, none of them
large enough to draw the eye. A very subtle nebula haze in deep indigo and
faint violet, low contrast, more like a stain in the dark than a cloud.

Critical: the image must tile seamlessly on all four edges with no visible
seam and no repeating landmark — nothing recognisable enough that a viewer
notices it appearing twice. No planets, no moons, no spacecraft, no
constellations, no lens flares, no vignette, no text.

Extremely low contrast overall. This is a background that white cards will be
placed on top of; it must stay quiet and never compete with them.

Square, 2048x2048, no border.
```

## 2. Space Galaxy — `window` (single backdrop)

```
A single wide image of deep space as seen from far outside a galaxy — a work
desktop background, not an illustration.

Near-black, colour #05060c. One spiral galaxy set well off-centre and small in
frame, its arms faint and dusty. Scattered stars at varying brightness. A soft
nebula gradient in deep indigo through faint violet across one corner.

Extremely low contrast, and dark throughout — white cards and panels will be
placed over the whole surface and must remain clearly readable. Keep the
centre of the frame especially quiet and empty; that is where the work sits.

No planets in the foreground, no spacecraft, no lens flares, no text, no
watermark, no vignette.

3840x2160, landscape.
```

## 3. Ocean — `world` (seamless tile)

```
A seamlessly tileable square texture of deep open water seen from directly
above — a plan view looking straight down, with no horizon and no shore.

Deep teal, base colour #0b2733. Gentle swell showing as soft interference of
long, low waves at slightly different angles; crests catching only a few
percent of pale light. No breaking waves, no foam, no whitecaps, no caustics,
no sun glint, no reflections of anything.

Critical: it must tile seamlessly on all four edges, with no visible seam and
no recognisable landmark that a viewer would notice repeating.

Very low contrast, calm and even across the whole frame. This is a work
surface that white cards sit on; it must read as texture rather than as a
picture of the sea.

Square, 2048x2048, no border.
```

## 4. Ocean — `window` (single backdrop)

```
A single wide image of calm open ocean at dusk, photographed from high above
at a shallow angle — mostly water, with the horizon in the top eighth of the
frame or absent altogether.

Deep teal water, base colour #0b2733, darkening toward the bottom of the
frame. Long gentle swell, no breaking waves, no foam, no boats, no land, no
birds. If any sky is visible, keep it dark and almost featureless.

Extremely low contrast and dark throughout — white cards and panels will be
placed across the whole surface and must remain clearly readable. Keep the
centre quiet.

No text, no watermark, no vignette, no sun flare.

3840x2160, landscape.
```

## 5. Mountains — `world` (seamless tile)

```
A seamlessly tileable square texture of mountainous terrain seen from directly
above — a plan view, like relief on a map, with no horizon and no sky.

Dark rock, base colour #2b2825. Ridgelines running across the frame at two
different angles, each ridge showing a lit flank and a shadowed flank so the
terrain reads as three-dimensional. Light comes from the upper left,
consistently, across the entire image. Broad shallow valleys between the
ridges.

Critical: it must tile seamlessly on all four edges, with no visible seam and
no distinctive peak or feature that a viewer would notice repeating.

No snow, no trees, no rivers, no roads, no buildings, no contour lines, no
map markings, no text. Low contrast and muted — this is a work surface that
white cards sit on, not a landscape photograph.

Square, 2048x2048, no border.
```

## 6. Mountains — `window` (single backdrop)

```
A single wide image of a dark mountain range at last light, seen from a
distance — a work desktop background, not a dramatic landscape.

Dark rock, base colour #2b2825, with ridgelines receding into haze. The
horizon sits in the top quarter of the frame; the sky above it is dark and
nearly featureless. Light rakes from the upper left.

Extremely low contrast and dark throughout — white cards and panels will be
placed across the whole surface and must remain clearly readable. Keep the
lower two thirds quiet and free of detail; that is where the work sits.

No snow-capped drama, no sunburst, no foreground trees or figures, no birds,
no text, no watermark, no vignette.

3840x2160, landscape.
```

---

## 7. Farm — `world` (seamless tile)

**This is the one that has never shipped in any form.** `farm` was dropped from
the seeded set because grass and hedgerows read as *drawn* in a way procedural
noise does not — it is the theme that most needs a real image, and the only one
where there is nothing to replace.

```
A seamlessly tileable square texture of farmland seen from directly above — a
plan view, as from an aircraft, with no horizon and no sky.

Irregular field parcels in muted greens and dry golds, separated by dark
hedgerows and the faint lines of tracks. Subtle variation in the direction of
ploughing between neighbouring fields. Muted and desaturated overall, as if
seen at dusk; keep it dark enough that white cards placed on top stand clearly
away from it.

Critical: it must tile seamlessly on all four edges, with no visible seam and
no distinctive field shape, building or feature that a viewer would notice
repeating.

No buildings, no roads with vehicles, no animals, no text, no map markings, no
compass rose, no borders.

Square, 2048x2048, no border.
```

## 8. Farm — `window` (single backdrop)

```
A single wide image of rolling farmland at dusk, seen from a low hill — a work
desktop background, not a landscape photograph.

Muted green and dry gold fields divided by dark hedgerows, receding into haze.
The horizon sits in the top quarter of the frame; the sky above it is dark and
nearly featureless.

Extremely low contrast and dark throughout — white cards and panels will be
placed across the whole surface and must remain clearly readable. Keep the
lower two thirds quiet and free of detail.

No farmhouse, no animals, no figures, no machinery, no sunset colour drama, no
text, no watermark, no vignette.

3840x2160, landscape.
```

---

## Checking one before it ships

Two failures are common enough to be worth testing for deliberately, and both
are invisible until the thing is in the app:

- **Tile it four by four and look for the seam.** An image model will often
  produce something that *looks* seamless and is not. Any recognisable
  feature — a bright star, a distinctive field — becomes a grid of itself the
  moment somebody zooms out.
- **Put a white card on it.** If the card does not read instantly as an object
  standing on top, the ground is too light or too busy, whatever it looks like
  on its own.

## What is not an image job

**The themed cursor.** Galaxy is a sparkle, ocean a fish, mountains a summit
flag (`themeCursor` in `packages/core/src/theme.ts`), and `farm` would want a
sheep. These are ~18px SVG paths filled with **the viewer's own identity
colour**, so they cannot be generated images — a cursor carrying its own colour
would delete the one signal that says who is who. A sheep here means a single
filled path, drawn to read at 18 pixels, which took six candidates and two
rounds of looking for the three that shipped.

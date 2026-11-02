---
version: alpha
name: Immediate connection — after Bret Victor
description: A reactive-document system for one screen where every important number is something you can touch. Prose on white paper with live values embedded in the sentences, charts and small multiples that update every frame as you drag, one colour for what you can manipulate and one for what is computed, and no Apply button anywhere. An homage to the published essays and talks of Bret Victor, not his work, and not affiliated with or endorsed by Bret Victor or Dynamicland.
colors:
  background: "#ffffff"
  primary: "#1b1b1b"
  secondary: "#5f5f5f"
  accent: "#0e7490"
  computed: "#b45309"
  ghost: "#a9cfdb"
  rule: "#e3e3e3"
typography:
  prose:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: 19px
    fontWeight: 400
    lineHeight: 1.6
  value:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: 19px
    fontWeight: 600
    lineHeight: 1.6
    fontFeature: "'tnum' 1"
  heading:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: 30px
    fontWeight: 600
    lineHeight: 1.2
  chart-label:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.3
    fontFeature: "'tnum' 1"
  caption:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.4
rounded:
  none: 0px
  sm: 3px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 32px
  xl: 48px
  measure: 66ch
components:
  document:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.prose}"
    width: "{spacing.measure}"
  scrubbable-value:
    textColor: "{colors.accent}"
    typography: "{typography.value}"
  computed-value:
    textColor: "{colors.computed}"
    typography: "{typography.value}"
  handle:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.full}"
    size: 14px
  small-multiple:
    backgroundColor: "{colors.background}"
    textColor: "{colors.secondary}"
    typography: "{typography.chart-label}"
    padding: "{spacing.sm}"
    width: 160px
  timeline-scrubber:
    backgroundColor: "{colors.rule}"
    rounded: "{rounded.full}"
    height: 4px
---

## Philosophy

- **Immediate connection.** A creator needs to see the effect of a change the moment they make it; every delay between a change and its effect is a wall between the person and the idea ([Inventing on Principle, transcript](https://jamesclear.com/great-speeches/inventing-on-principle-by-bret-victor)).
- **Information software is graphic design.** Most software exists to help someone learn something, so it should show the answer and infer context; interaction is a cost to be spent carefully ([Magic Ink](https://worrydream.com/MagicInk/)).
- **Up and down the ladder.** Understanding comes from moving between concrete examples and the abstract pattern, which means seeing many states at once ([Ladder of Abstraction](https://worrydream.com/LadderOfAbstraction/)).
- **Play with the author's assumptions.** A reader should be able to change the numbers an argument rests on and watch the conclusion move ([Explorable Explanations](https://worrydream.com/ExplorableExplanations/)).
- **Humane, communal computing.** Not one person staring at a screen, but people and physical things together ([Dynamicland](https://dynamicland.org/2024/Intro/)).

## Overview

Build the screen as a document you can play with. It opens already showing the answer for sensible defaults (never an empty form), in a column of prose with the assumptions written into the sentences as live values. Drag any value sideways and every dependent number, sentence and chart updates in the same frame. Beside or below the prose, small multiples show the result across a range of the key parameter, and anything that happens over time has a scrubber. The colours and sizes here are this pack's translation into CSS, not Bret Victor's specification.

## Colors

Ink on white paper, with exactly two meaningful colours used the same way everywhere:

- `accent` `#0e7490` marks everything you can manipulate: scrubbable values (with a dotted underline), drag handles, the scrubber thumb.
- `computed` `#b45309` marks every result that is calculated from them: derived numbers in the prose, the highlighted line or point in a chart.
- `ghost` `#a9cfdb` draws onion-skin trails of earlier states and the unselected small multiples' reference line.
- `primary` `#1b1b1b` is prose and chart ink; `secondary` `#5f5f5f` is axis labels and captions; `rule` `#e3e3e3` is axes and the scrubber track.
- Nothing else is coloured. If it is blue-green you can drag it; if it is amber it was worked out for you.

## Typography

Source Serif 4 for prose at 19px / 1.6, 60–70 characters per line; headings 30/600 in the same face. Live values are the same size in 600 weight with `font-variant-numeric: tabular-nums` so dragging never makes the line jitter. Chart labels and captions in Source Sans 3 at 13–14px, also tabular. Write numbers with their units inside the value ("**12 %** a year", "**30 years**").

## Layout

- One reading column of `66ch`, left-aligned with a 48px margin; charts may break out to the right up to 1040px total width.
- Parameters and their effects sit side by side on screen at the same time: the sentence with the value, and directly beside or below it the chart it drives. Never on a separate tab or behind a button.
- Small multiples: 5–9 identical small charts (160px wide) across a range of one parameter, on a shared scale, the current value's chart outlined.
- A timeline scrubber (full column width, 4px track, 14px thumb) for any process that unfolds over time, with the current step's state shown above it.

## Elevation & Depth

None. It is paper: no shadows, no cards, no layers. Separation is whitespace and a 1px `rule` for axes. The only thing that rises is the drag feedback: while dragging, the active value gets a 3px radius `#e6f3f6` background.

## Shapes

Round handles (14px circles) placed on the thing itself: the end of a bar, a point on a curve, the edge of a region. 3px radius for the active-value highlight. Charts are plain lines and dots; no rounded bars, no decorative containers.

## Components

- **document**: the reading column; prose with embedded live values.
- **scrubbable-value**: `cursor: ew-resize`, dotted 1px underline in `accent`, drag horizontally to change (1 unit per 2–4px), arrow keys step it, `tabindex="0"` and `role="slider"` with `aria-valuenow`.
- **computed-value**: amber, updates in the same frame as its inputs.
- **handle**: a 14px circle on a chart element, draggable directly.
- **small-multiple**: one of a row of identical mini-charts across a parameter's range.
- **timeline-scrubber**: a track and thumb for time, dragging shows every state as it passes.

## Do's and Don'ts

- Do make every important number a live control: `pointerdown` on the value, `pointermove` changes it, recompute and re-render synchronously in the same `requestAnimationFrame`.
- Do open with the answer already computed for reasonable defaults, and say in prose what those defaults are.
- Do put values inside sentences ("If you save **$400** a month at **5 %**, you have **$61,000** in **10 years**."), with the inputs in `accent` and the result in `computed`.
- Do show many states at once: small multiples across the key parameter, or ghost trails of the previous states.
- Do give anything that changes over time a scrubber, and let the reader drag through it.
- Do keep the colour meaning identical everywhere: blue-green manipulable, amber computed.
- Do use `tabular-nums` on every changing number.
- Do let values follow the pointer directly with no easing or transition; animate only to show time passing or cause and effect.
- Do write curious, explanatory copy ("What happens if we double the rate?") and expose every assumption as an editable value.
- Don't add Apply, Submit, Calculate or Update buttons for anything that can be previewed.
- Don't use icon buttons where the reader could grab the thing itself.
- Don't decorate: no gradients, shadows, illustrations or hero images.

## Never

- An edit, submit, wait loop.
- A hidden model: black-box results with assumptions the reader cannot see or change.
- A still picture of something that could move.
- Decoration for flair.

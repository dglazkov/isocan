---
version: alpha
name: Less, but better — after Dieter Rams & Braun
description: A quiet, functional system for building one screen the way a good appliance is built. A neutral field, controls that look like controls and sit in orderly arrays, one orange signal for the one thing that matters, and nothing whose purpose you cannot name. An homage to the published ten principles of Dieter Rams and Braun design, not their specification and not affiliated with or endorsed by them.
colors:
  background: "#f3f2ee"
  surface: "#fbfaf7"
  grey: "#d9d8d4"
  hairline: "#c4c3bf"
  primary: "#222222"
  secondary: "#66655f"
  accent: "#e8641b"
typography:
  readout:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 28px
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: -0.01em
    fontFeature: "'tnum' 1"
  heading:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 28px
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: -0.01em
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0.02em
rounded:
  sm: 2px
  md: 4px
  circle: 50%
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  key: 48px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
    height: 44px
  key:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    size: "{spacing.key}"
  panel:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  readout:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    typography: "{typography.readout}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  indicator-on:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.circle}"
    size: 8px
  control-label:
    textColor: "{colors.secondary}"
    typography: "{typography.label}"
---

## Philosophy

- **As little design as possible.** Concentrate on the essential; everything else is a burden on the thing that matters. Condensed from the ten principles, [Vitsœ: Good design](https://www.vitsoe.com/us/about/good-design).
- **Useful, understandable, honest.** The form explains how to use it and never claims more than the product does.
- **Unobtrusive.** A product is a tool, neutral and restrained, leaving room for the person using it.
- **Long-lasting and thorough.** Avoid what will date; care about the last detail, down to a baseline.
- **Responsible.** Nothing is added that has to be maintained, explained or thrown away later. Background: [Dieter Rams at Vitsœ](https://www.vitsoe.com/us/about/dieter-rams), [Wikipedia](https://en.wikipedia.org/wiki/Dieter_Rams).

## Overview

Build the screen as a product face: a calm off-white field with a grid of controls, each one labelled, each one plainly doing one thing, and a single orange signal reserved for the primary action or the state that is on. The screen should feel like it was designed once and could stay unchanged for ten years. The hex values and pixel numbers here are this pack's translation of the principles into CSS, not a specification Dieter Rams or Braun published.

## Colors

- `background` `#f3f2ee` is the field. The whole page sits on it.
- `surface` `#fbfaf7` is the top of a key or button; `grey` `#d9d8d4` is a recessed track, a slider groove or a switch body.
- `primary` `#222222` is the ink for all text and icons. `secondary` `#66655f` is for small labels and units only.
- `hairline` `#c4c3bf` is the one border colour, always 1px.
- `accent` `#e8641b` is the one signal. It appears on exactly one control per screen (the primary action) and on the indicator of whatever is switched on. It never colours text, headings, backgrounds, charts or decoration. Text on the accent uses `primary`, never white.

## Typography

One neo-grotesk (Inter, falling back to `system-ui`) in at most three sizes: 28px for the one heading or readout, 15px for body and control text, 11px for labels. Weights 400 and 500 only. Labels may be lowercase and sit beside or directly above their control, never in a tooltip. Numbers use `font-variant-numeric: tabular-nums` and always carry their unit ("21 °C", "3 min", "45 %").

## Layout

- 8px base grid, 12 columns, equal 16px gutters. Every edge lands on a multiple of 8px (4px only for a label's gap to its control).
- Group controls by function into arrays of equal keys (48×48px), like a calculator: rows and columns, no scattered buttons.
- Rank by placement and size, not by colour: the most important group top-left or at the natural end of reading, the primary action where the hand ends up.
- Align baselines across a row. Keep equal optical margins on all four sides of a panel.
- Maximum content width 960px, centred; generous empty field around the product face is fine, empty space inside it is not.

## Elevation & Depth

Almost flat. Separate groups with space first, a 1px `hairline` second. A key may have a 1px inset bottom edge (`box-shadow: inset 0 -1px 0 #c4c3bf`) so it reads as pressable; nothing floats, nothing has a blurred drop shadow, nothing is translucent.

## Shapes

Radii are 2px or 4px, or a true circle (50%) for round buttons, dials, indicators and the perforation dots. Nothing in between: no 8px, 12px or pill shapes. A perforated dot grid (2px dots on an 8px pitch in `grey`) is the only texture allowed, and only where it marks something functional such as a speaker or a drag area.

## Components

- **button-primary**: the single orange control. 44px high, `primary` text, 4px radius. Pressed: `transform: translateY(1px)` over 120ms ease-out.
- **key**: the standard control. 48×48px on `surface` with a 1px `hairline` border; arranged in arrays.
- **panel**: a functional group on the field; 16px padding; no background change unless the group is recessed.
- **readout**: the one display of a live value, charcoal with off-white tabular numerals, like an LCD window.
- **indicator-on**: an 8px orange dot beside whatever is on. State is always visible, never implied.
- **control-label**: 11px `secondary` text, lowercase allowed, with units.

## Do's and Don'ts

- Do give every element a function you can name in five words; delete the rest.
- Do use the orange `accent` on exactly one action and on the on-state indicators; everything else is neutral.
- Do show every state: a switch shows on or off by position and by the orange dot, not by colour alone.
- Do arrange controls in grids of equal keys, grouped by function, with 16px between groups and 8px within.
- Do use at most three type sizes (28/15/11px), weights 400/500, and put units after every number.
- Do make controls look like controls: round buttons, visible tracks for sliders, knob-like steppers.
- Do animate like a switch: 120–200ms `ease-out`, transform and opacity only, no bounce, no overshoot; honour `prefers-reduced-motion`.
- Do write terse, factual labels ("start", "timer 5 min", "volume") with no adjectives and no exclamation marks.
- Don't use gradients, illustrations, background photos, glass or glow.
- Don't use a second accent, or colour for status that could be a word or a position.
- Don't use radii other than 2px, 4px or a circle.
- Don't use more than one hairline weight (1px) anywhere.

## Never

- An element without a function.
- More than one accent colour, or colour used as decoration.
- Trend effects that will date: glassmorphism, neon gradients, big soft shadows.
- Hidden state: a setting you cannot see without opening something.
- Marketing adjectives in the interface.

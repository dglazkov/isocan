---
version: alpha
name: Paper and ink — after Matías Duarte & Material Design
description: A tangible, graphic system for one screen built from sheets of paper and ink with physics that mean something. Surfaces at semantic elevations, colour roles derived from one seed with a matching on-colour for every fill, a strict type scale, one floating action button, and motion that shows where things came from. An homage to the published principles of Matías Duarte and Material Design, not Google's specification, and not affiliated with or endorsed by Matías Duarte or Google.
colors:
  primary: "#6750a4"
  on-primary: "#ffffff"
  primary-container: "#eaddff"
  on-primary-container: "#21005d"
  secondary: "#625b71"
  tertiary: "#7d5260"
  surface: "#fffbfe"
  surface-container: "#f3edf7"
  on-surface: "#1c1b1f"
  on-surface-variant: "#49454f"
  outline: "#79747e"
typography:
  display-large:
    fontFamily: "Roboto Flex, Roboto, system-ui, sans-serif"
    fontSize: 57px
    fontWeight: 400
    lineHeight: 64px
    letterSpacing: -0.25px
  headline-medium:
    fontFamily: "Roboto Flex, Roboto, system-ui, sans-serif"
    fontSize: 28px
    fontWeight: 400
    lineHeight: 36px
  title-large:
    fontFamily: "Roboto Flex, Roboto, system-ui, sans-serif"
    fontSize: 22px
    fontWeight: 400
    lineHeight: 28px
  title-medium:
    fontFamily: "Roboto Flex, Roboto, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 24px
    letterSpacing: 0.15px
  body-large:
    fontFamily: "Roboto Flex, Roboto, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: 0.5px
  body-medium:
    fontFamily: "Roboto Flex, Roboto, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0.25px
  label-large:
    fontFamily: "Roboto Flex, Roboto, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: 0.1px
rounded:
  extra-small: 4px
  small: 8px
  medium: 12px
  large: 16px
  extra-large: 28px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
components:
  top-app-bar:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.title-large}"
    height: 64px
    padding: "0 {spacing.md}"
  fab:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    typography: "{typography.label-large}"
    rounded: "{rounded.large}"
    size: 56px
  button-filled:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-large}"
    rounded: "{rounded.full}"
    padding: "10px 24px"
    height: 40px
  card-elevated:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-medium}"
    rounded: "{rounded.medium}"
    padding: "{spacing.md}"
  card-filled:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-medium}"
    rounded: "{rounded.medium}"
    padding: "{spacing.md}"
  list-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-large}"
    height: 56px
    padding: "8px {spacing.md}"
  dialog:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-medium}"
    rounded: "{rounded.extra-large}"
    padding: "{spacing.lg}"
---

## Philosophy

- **Material is the metaphor.** Surfaces behave like paper and ink: tangible, layered, with real physics, and shadows that express how high a sheet sits ([Material Design introduction](https://m1.material.io/material-design/introduction.html), [Wikipedia](https://en.wikipedia.org/wiki/Material_Design)).
- **Bold, graphic, intentional.** Print's fundamentals, a type scale, a grid, colour and imagery, create hierarchy and meaning ([metrics and keylines](https://m1.material.io/layout/metrics-keylines.html)).
- **Motion provides meaning.** Transitions show relationships and continuity, so you always know where something came from and where you are ([Gizmodo interview](https://gizmodo.com/googles-design-mastermind-explains-the-future-of-androi-1596880308)).
- **Tasks as cards.** In webOS, work lived on physical cards you could flick away ([AllThingsD](https://allthingsd.com/20100527/exclusive-palm-loses-mobile-design-guru-matias-duarte/)).
- **Personal and expressive.** Dynamic colour from one seed (Material You, 2021), then springs, new shapes and shape morphing from 46 studies with more than 18,000 participants (Material 3 Expressive, 2025) ([Google Design](https://design.google/library/expressive-material-design-google-research)).

## Overview

Build the screen as a stack of paper: a bold coloured app bar at the top, content on cards and list items at their proper elevations, one round-cornered floating action button for the single most important action, and transitions that grow each detail out of the element that was tapped. Everything is derived from one seed colour. The 8dp grid and the type scale sizes are Material's published values; the hex values are baseline-style roles from a purple seed and the shadows are approximations, this pack's translation rather than Google's specification.

## Colors

- One seed, many roles. `primary` `#6750a4` for the app bar and filled buttons, always with `on-primary` text; `primary-container` / `on-primary-container` for the FAB and selected chips; `secondary` and `tertiary` for accents that need to differ from primary (a filter chip, a badge), never decoratively.
- `surface` `#fffbfe` is the page and elevated cards; `surface-container` `#f3edf7` is filled cards and dialogs; `on-surface` `#1c1b1f` is all body text; `on-surface-variant` `#49454f` is secondary text; `outline` `#79747e` is text-field borders and dividers.
- Every fill has its `on-*` pair. Text never sits on a coloured surface in anything but that surface's `on-*` colour.
- Bold colour blocks are welcome for the app bar and a hero; body areas stay on surface.

## Typography

Roboto Flex (OFL), falling back to Roboto, on the Material 3 scale: display-large 57/64, headline-medium 28/36, title-large 22/28, title-medium 16/24 at 500, body-large 16/24, body-medium 14/20, label-large 14/20 at 500. Sentence case for every label and button; no all-caps buttons. Use only these levels; the scale is the hierarchy.

## Layout

- 8dp layout grid; 4dp for type baselines and icon alignment.
- 16dp screen margins on mobile, 24dp on larger screens; 16dp gutters.
- Keylines: content starts 16dp from the edge, text after an icon or avatar starts at 72dp.
- Touch targets at least 48×48dp with at least 8dp between them.
- Cards hold heterogeneous content; a list item expands into its detail rather than navigating away.

## Elevation & Depth

Elevation is semantic, and every shadow means a height (approximate CSS):

- Resting card, 1dp: `0 1px 2px rgb(0 0 0 / .3), 0 1px 3px 1px rgb(0 0 0 / .15)`
- App bar when content scrolls under it, 4dp: `0 2px 4px rgb(0 0 0 / .2), 0 4px 8px 3px rgb(0 0 0 / .12)`
- FAB, 6dp: `0 3px 5px rgb(0 0 0 / .2), 0 6px 10px 4px rgb(0 0 0 / .14)`
- Menu, 8dp: `0 4px 6px rgb(0 0 0 / .2), 0 8px 12px 6px rgb(0 0 0 / .14)`
- Dialog, 24dp: `0 11px 15px rgb(0 0 0 / .2), 0 24px 38px 3px rgb(0 0 0 / .14)`

Higher surfaces cast larger, softer shadows. Alternatively use M3 tonal elevation (a higher surface is a stronger primary tint), but do not mix the two. Paper never passes through paper: a surface slides over or under another, it does not intersect it.

## Shapes

The M3 shape scale: 4dp extra-small (chips' inner parts), 8dp small (text fields, menus), 12dp medium (cards), 16dp large (FAB), 28dp extra-large (dialogs, sheets), full for buttons and badges. Icons are Material Symbols at 24dp (Apache-2.0), outlined, one weight throughout.

## Components

- **top-app-bar**: 64dp, bold `primary` block with `on-primary` title; gains the 4dp shadow when content scrolls beneath.
- **fab**: exactly one, 56dp, 16dp radius, `primary-container`, 6dp shadow, bottom-right 16dp from the edges; it holds the screen's single most important action.
- **button-filled**: pill, 40dp, `primary` with `on-primary` sentence-case label.
- **card-elevated / card-filled**: 12dp radius, 16dp padding; elevated at 1dp, filled flat on `surface-container`.
- **list-item**: 56dp single-line, 72dp two-line, leading icon or avatar on the 16dp keyline.
- **dialog**: 28dp radius, `surface-container`, 24dp padding, 24dp elevation, scrim behind.

## Do's and Don'ts

- Do give every surface an elevation level and only the shadow for that level.
- Do use exactly one FAB, for the one most important action, and nothing else floating.
- Do derive all colours from one seed and pair every fill with its `on-*` text colour.
- Do lay everything on the 8dp grid with 16/24dp margins and 48dp targets.
- Do show touch feedback as an ink ripple spreading from the touch point (a radial `transform: scale()` of a circle clipped to the surface, 300ms).
- Do use container transform (a card grows into its detail) and shared-axis transitions (x for siblings, z for parent–child), with standard easing `cubic-bezier(0.4, 0, 0.2, 1)` at 200–300ms; honour `prefers-reduced-motion`.
- Do write clear, concise, sentence-case labels ("Add to list", not "ADD TO LIST").
- Do make hierarchy bold: a coloured app bar, a 57px or 28px headline, clear type-scale steps.
- Don't use a shadow that does not mean an elevation, or a shadow on text.
- Don't let two surfaces intersect or pass through each other.
- Don't animate anything whose motion does not say where it came from or where it went.
- Don't put text on a coloured surface in anything but its `on-*` colour.

## Never

- Shadows that do not express elevation.
- Surfaces passing through each other.
- Motion without meaning.
- More than one FAB.
- Low-contrast text on tonal surfaces; always the `on-*` colour.

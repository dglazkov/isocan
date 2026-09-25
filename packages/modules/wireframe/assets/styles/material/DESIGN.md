---
version: alpha
name: Material — a wire style
description: Tonal and soft-cornered, after the ideas of Material Design 3 — a pale violet-tinted ground, one tonal primary for the main action, containers one step darker than the ground, and elevation doing the work a border would. An original token set for isocan's wireframes, inspired by Material Design 3; not Google's theme, and not affiliated with or endorsed by Google.
surface: raised
colors:
  ground: "#fef7ff"
  surface: "#f3edf7"
  line: "#cac4d0"
  ink: "#1d1b20"
  ink-muted: "#49454f"
  bar: "#e6e0e9"
  primary: "#6750a4"
  on-primary: "#ffffff"
typography:
  title:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: 22px
    fontWeight: 500
    lineHeight: 1.27
  body:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.43
    letterSpacing: 0.01em
rounded:
  sm: 8px
  base: 12px
  lg: 16px
  full: 999px
spacing:
  xs: 4px
  base: 8px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: 40px
    padding: "0 {spacing.lg}"
  card:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "{spacing.md}"
  text-field:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: 56px
---

## Overview

A calm, friendly surface for everyday apps. Colour is tonal: every neutral
leans slightly toward the primary, so a screen reads as one family rather than
grey plus an accent. Depth comes from elevation — cards, app bars and sheets
float on soft shadows — rather than from outlines.

## Colors

- **ground** is the page: a near-white with a violet tint.
- **surface** fills quiet containers one tone darker: image placeholders,
  selected navigation, avatars.
- **primary** is the filled action and the selected tab — one per screen.
- **ink** and **ink-muted** carry every word; both clear 4.5:1 on ground and
  surface. **on-primary** is white, 6.4:1 on the primary.

## Typography

One family at three weights of use: a 22px title, 14px body, and 14px
medium labels on controls. Roboto where the device has it, the system face
everywhere else — nothing is downloaded.

## Layout

An 8px base grid; 16px inside cards, 24px between groups.

## Elevation & Depth

`surface: raised` — cards, app bars, sheets and dialogs sit on soft shadows,
and cards drop their outline when they are lifted.

## Shapes

12px corners on cards and controls, full pills on chips and the floating
action button. Nothing is square.

## Components

The filled button is the primary action; secondary actions are outlined in
the primary. Text fields are outlined boxes with the label above.

## Do's and Don'ts

- Do keep one filled primary per screen.
- Don't add borders to lifted surfaces — elevation already separates them.

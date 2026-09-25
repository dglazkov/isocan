---
version: alpha
name: Glass — a wire style
description: Glassmorphism for wireframes — translucent frosted panes over a soft violet-to-blush gradient ground, white hairline edges, and a deep violet primary. An original token set for isocan's wireframes; the gradient is drawn from these colours, and every word is set in ink dark enough to read on the deepest part of it.
surface: glass
colors:
  ground: "#f3f0fc"
  surface: "#fbe4ee"
  line: "rgba(255, 255, 255, 0.7)"
  ink: "#1b1836"
  ink-muted: "#2e2950"
  bar: "#d8d1ef"
  primary: "#5438d0"
  on-primary: "#ffffff"
typography:
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 22px
    fontWeight: 650
    lineHeight: 1.25
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: 10px
  base: 14px
  lg: 20px
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
    rounded: "{rounded.base}"
    height: 44px
  pane:
    backgroundColor: "{colors.ground}"
    borderColor: "{colors.line}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
---

## Overview

Panes of frosted glass floating over a soft gradient. The gradient is the
colour; the panes are light, translucent and blurred, with a thin white edge
catching the light. It reads as depth without a single hard border.

## Colors

- **ground** is a pale lavender, and the gradient's light end.
- **surface** is a blush pink — the gradient's second hue, and the quiet fill
  of placeholders and avatars.
- **primary** is a deep violet: the filled action, and the gradient's
  deepest tint (mixed with the ground, never pure).
- **line** is 70% white: the lit edge of every pane.
- **ink** and **ink-muted** clear 4.5:1 on the ground and on the gradient's
  deepest stop.

## Typography

The system sans; titles a little heavier than usual so they hold on a busy
ground.

## Layout

8px base; panes padded 16px, generous gaps so the gradient shows between them.

## Elevation & Depth

`surface: glass` — cards, bars, sheets, fields and dialogs are translucent
fills with a `backdrop-filter` blur over the gradient ground, lifted by a
soft violet shadow.

## Shapes

Generous corners: 14px on controls, 20px on panes.

## Components

The primary button is solid violet — the one opaque thing on the screen.
Everything else is glass.

## Do's and Don'ts

- Do leave gradient showing between panes; glass over glass over glass is fog.
- Don't set muted text on the gradient's deepest corner at small sizes.

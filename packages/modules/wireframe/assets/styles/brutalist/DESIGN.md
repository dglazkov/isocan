---
version: alpha
name: Brutalist — a wire style
description: Thick black borders, hard offset shadows, square corners, a monospace face and loud flat colour — cream ground, signal-yellow fills and an electric-blue primary. An original token set for isocan's wireframes.
surface: bold
colors:
  ground: "#fffbea"
  surface: "#ffd23f"
  line: "#000000"
  ink: "#000000"
  ink-muted: "#262626"
  bar: "#d4cdb2"
  primary: "#2323ff"
  on-primary: "#ffffff"
typography:
  title:
    fontFamily: "ui-monospace, Menlo, Consolas, 'Liberation Mono', monospace"
    fontSize: 24px
    fontWeight: 800
    lineHeight: 1.15
  body:
    fontFamily: "ui-monospace, Menlo, Consolas, 'Liberation Mono', monospace"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "ui-monospace, Menlo, Consolas, 'Liberation Mono', monospace"
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.3
rounded:
  base: 0px
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
    borderColor: "{colors.ink}"
  card:
    backgroundColor: "{colors.ground}"
    borderColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "{spacing.md}"
---

## Overview

Honest and loud. Every box is drawn with a thick black line and casts a hard
shadow; nothing is rounded, blurred or tinted.

## Colors

- **ground** cream; **surface** signal yellow for fills, placeholders and the
  selected row.
- **line** and **ink** are black.
- **primary** is electric blue with white words at 7.6:1.

## Typography

Monospace throughout — the system's, never downloaded. Titles are heavy.

## Layout

8px base, generous gaps so the shadows have room.

## Elevation & Depth

`surface: bold` — 3px black borders and 4px hard offset shadows instead of
soft elevation.

## Shapes

Square corners everywhere.

## Components

Buttons, cards, fields and chips all wear the black border; the primary
button is the one blue thing.

## Do's and Don'ts

- Do let the shadows be hard and black.
- Don't soften anything.

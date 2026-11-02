---
version: alpha
name: Carbon — a wire style
description: After the ideas of IBM's Carbon — square corners, dense spacing, cool greys and one strong blue; an interface for work, not for show. An original token set for isocan's wireframes, inspired by Carbon; not IBM's theme or typeface, and not affiliated with or endorsed by IBM.
surface: flat
colors:
  ground: "#ffffff"
  surface: "#f4f4f4"
  line: "#8d8d8d"
  ink: "#161616"
  ink-muted: "#525252"
  bar: "#e0e0e0"
  primary: "#0f62fe"
  on-primary: "#ffffff"
typography:
  heading:
    fontFamily: "system-ui, 'Helvetica Neue', Arial, sans-serif"
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.4
  body:
    fontFamily: "system-ui, 'Helvetica Neue', Arial, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0.01em
  label:
    fontFamily: "system-ui, 'Helvetica Neue', Arial, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: 0.02em
rounded:
  base: 0px
spacing:
  xs: 2px
  base: 6px
  md: 12px
  lg: 16px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.base}"
    height: 48px
    padding: "0 {spacing.lg}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    height: 40px
---

## Overview

Square, dense and cool. Everything sits on a strict grid with no corner
rounding, so rows line up and tables read fast.

## Colors

- **ground** white, **surface** a cool grey layer.
- **line** a strong grey border that clears 3:1 against the ground.
- **primary** an interactive blue at 5:1; **on-primary** white.

## Typography

The system sans at 14px body and 12px labels with a hint of tracking; 20px
regular-weight headings. IBM's own typeface is not used or downloaded.

## Layout

A tight 6px base: dense lists and forms.

## Elevation & Depth

`surface: flat` — layers are told apart by grey steps, not shadows.

## Shapes

Square: every corner is 0px.

## Components

Primary buttons are full-height blue rectangles; fields are grey-filled
rectangles.

## Do's and Don'ts

- Do keep every corner square.
- Don't add shadows to separate layers — step the grey.

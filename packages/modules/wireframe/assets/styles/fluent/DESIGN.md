---
version: alpha
name: Fluent — a wire style
description: After the ideas of Microsoft's Fluent 2 — neutral greys, a communication blue, 4px corners, and light, layered shadows. An original token set for isocan's wireframes, inspired by Fluent 2; not Microsoft's theme, and not affiliated with or endorsed by Microsoft.
surface: raised
colors:
  ground: "#ffffff"
  surface: "#f5f5f5"
  line: "#d1d1d1"
  ink: "#242424"
  ink-muted: "#616161"
  bar: "#e0e0e0"
  primary: "#0f6cbd"
  on-primary: "#ffffff"
typography:
  title:
    fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
  caption:
    fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33
rounded:
  sm: 2px
  base: 4px
  lg: 8px
  full: 999px
spacing:
  xs: 4px
  base: 8px
  md: 12px
  lg: 20px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.base}"
    height: 32px
    padding: "0 {spacing.md}"
  card:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
---

## Overview

A productivity look: neutral surfaces layered by light shadows, one
communication blue for the primary action and selection, small precise
corners.

## Colors

- **ground** white, **surface** a neutral grey for quiet fills.
- **primary** the brand-neutral communication blue; **on-primary** white
  at 5.4:1.
- **ink-muted** a neutral grey at 6.2:1.

## Typography

Segoe UI where Windows has it, the system face elsewhere — never downloaded.
14px body, 20px semibold titles.

## Layout

A 4px ramp on an 8px base; 12px inside controls, 20px between groups.

## Elevation & Depth

`surface: raised` — cards, bars and dialogs sit on two-layer shadows, the
lighter the closer to the ground.

## Shapes

4px on controls, 8px on cards.

## Components

Primary buttons are filled blue; secondary buttons are outlined neutral.

## Do's and Don'ts

- Do keep shadows soft and short.
- Don't round controls past 4px.

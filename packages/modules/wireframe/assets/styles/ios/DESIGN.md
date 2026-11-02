---
version: alpha
name: iOS — a wire style
description: After Apple's Human Interface Guidelines — white and grouped-grey grounds, hairline separators, continuous 10px corners, the system face and a system-style blue, darkened to meet 4.5:1 on white. An original token set for isocan's wireframes, inspired by the HIG; not Apple's colours, and not affiliated with or endorsed by Apple.
surface: flat
colors:
  ground: "#ffffff"
  surface: "#f2f2f7"
  line: "#c6c6c8"
  ink: "#000000"
  ink-muted: "#636366"
  bar: "#e5e5ea"
  primary: "#0062d1"
  on-primary: "#ffffff"
typography:
  large-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, 'Helvetica Neue', sans-serif"
    fontSize: 34px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.01em
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, 'Helvetica Neue', sans-serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.3
  footnote:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, 'Helvetica Neue', sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.35
rounded:
  sm: 8px
  base: 10px
  lg: 12px
  full: 999px
spacing:
  xs: 4px
  base: 8px
  md: 16px
  lg: 20px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    height: 50px
  inset-group:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "0 {spacing.md}"
---

## Overview

Content first, chrome quiet. Screens are white or the grouped grey; lists
sit in inset groups with hairline separators; the tint colour marks what can
be tapped.

## Colors

- **ground** is white; **surface** is the grouped-background grey.
- **line** is the separator grey.
- **primary** is a system-style blue, darker than the platform default so a
  tinted word clears 4.5:1 on white — the platform's blue does not.
- **ink-muted** is an opaque secondary grey, 6:1 on white.

## Typography

The system face (`-apple-system`): 17px body, 13px footnotes, and a 34px large
title where the screen has one. Nothing is downloaded.

## Layout

8px base, 16px margins, 20px between groups.

## Elevation & Depth

`surface: flat` — separators and the grouped grey do the layering.

## Shapes

10px continuous corners on groups and controls, 12px on large buttons.

## Components

Filled buttons are tinted blue with white words; navigation is a tab bar at
the bottom; lists are inset groups.

## Do's and Don'ts

- Do tint only what can be tapped.
- Don't outline cards — group them.

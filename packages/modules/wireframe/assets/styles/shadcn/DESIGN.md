---
version: alpha
name: Shadcn — a wire style
description: Crisp and neutral, after the look of shadcn/ui — white ground, zinc greys, hairline borders, small corners and a near-black primary. An original token set for isocan's wireframes, inspired by shadcn/ui; not its theme, and not affiliated with or endorsed by its authors.
surface: flat
colors:
  ground: "#ffffff"
  surface: "#f4f4f5"
  line: "#e4e4e7"
  ink: "#09090b"
  ink-muted: "#63636b"
  bar: "#e4e4e7"
  primary: "#18181b"
  on-primary: "#fafafa"
typography:
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.01em
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: 4px
  base: 6px
  lg: 8px
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
    height: 36px
    padding: "0 {spacing.md}"
  card:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    height: 36px
---

## Overview

A tool-like interface that gets out of the way: neutral zinc greys, one
near-black primary, hairline borders, small corners. It looks finished at
wireframe fidelity because it barely decorates.

## Colors

- **ground** is white; **surface** is zinc-100 for muted fills.
- **line** is a 1px zinc-200 hairline on every card, field and divider.
- **primary** is near-black; **on-primary** is off-white at 17:1.
- **ink-muted** is a zinc grey darkened to clear 4.5:1 on the muted fill too.

## Typography

The system sans at 14px for body and labels, a 20px semibold title with
slightly tightened tracking.

## Layout

8px base; 16px padding in controls, 24px in cards.

## Elevation & Depth

`surface: flat` — borders separate things, not shadows.

## Shapes

6px corners on controls, 8px on cards; pills only for badges.

## Components

Primary buttons are solid near-black; secondary buttons are outlined; inputs
are 36px boxes with a hairline border.

## Do's and Don'ts

- Do let the hairline do the separating.
- Don't introduce a second accent colour.

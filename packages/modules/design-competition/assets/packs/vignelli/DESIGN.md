---
version: alpha
name: Grid is the argument — after Massimo Vignelli & Pentagram
description: A bold modernist Swiss grid system for one screen built with heavy black rules, stark white ground, monumental tight-tracked neo-grotesk headlines, zero rounded corners, and a single Vermilion block for primary action. An homage to the published principles of Massimo Vignelli and Pentagram, not affiliated with or endorsed by the Vignelli Center or Pentagram.
colors:
  background: "#ffffff"
  primary: "#000000"
  secondary: "#404040"
  rule: "#000000"
  accent: "#e32619"
  on-accent: "#ffffff"
typography:
  display:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: 72px
    fontWeight: 700
    lineHeight: 0.94
    letterSpacing: -0.03em
  section:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.015em
  body:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.04em
rounded:
  none: 0px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
components:
  heavy-rule:
    backgroundColor: "{colors.rule}"
    height: 4px
  grid-cell:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "{spacing.md} 0"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.section}"
    rounded: "{rounded.none}"
    height: 56px
    padding: "0 {spacing.lg}"
---

## Philosophy

- **Semantics, syntactics, pragmatics.** Understand what the subject means, build an unbreakable structural syntax of grid and rules, and ensure instant pragmatic comprehension.
- **Discipline over trend.** One neo-grotesk typeface family, extreme scale contrast (`72px` over `15px`), zero decorative ornament.
- **The grid is visible authority.** Heavy `4px` and hairline `1px` black horizontal rules structure the page with zero ambiguity.

## Overview

Build the screen as a stark modernist poster on pure `#ffffff` white divided into 4 columns with flush-left alignment throughout, heavy `4px` black bars above major sections, sharp `0px` corners everywhere, and one `#e32619` Vermilion action block.

## Colors

- `background` `#ffffff` and `primary` `#000000` carry 90% of the page.
- `accent` `#e32619` fills the primary action block with `on-accent` `#ffffff` bold flush-left text.

## Typography

Flush-left neo-grotesk (`Inter` / `Helvetica Neue`), tight tracking (`-0.03em`) at `72px` display scale, crisp `15px` body copy. Never center text.

## Layout

- Strict 4-column modular grid (`24px` gutters), flush-left alignment across every column.
- Heavy `4px solid #000000` structural bars anchor top and primary rows.

## Elevation & Depth

Zero shadows, zero gradients, zero blur. Graphic contrast carries all hierarchy.

## Shapes

Strict `0px` right angles everywhere (`border-radius: 0`).

## Components

- **heavy-rule**: `4px solid #000000` full-width structural band.
- **grid-cell**: Flush-left column block bounded by `1px solid #000000` top hairline.
- **button-primary**: `56px` solid `#e32619` rectangular action block, flush-left `#ffffff` bold label.

## Do's and Don'ts

- Do lock every single text edge to the 4-column grid, flush-left.
- Do use dramatic scale contrast (`72px` tight display headline against `15px` body).
- Do keep `border-radius: 0px` everywhere and separate bands with crisp black horizontal rules.
- Don't center headings, add rounded corners, use pastel tints, or add drop shadows.

## Never

- Rounded pills or soft drop shadows.
- More than two type families or centered multi-line blocks.
- Any Pentagram or Vignelli trademark.

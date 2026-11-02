---
version: alpha
name: Plain words — after Jason Fried & 37signals
description: A calm, copy-first web page system for one screen built around plain English sentences, centered editorial sheets on warm paper, a yellow highlighter stroke on the reassurance line, and one friendly green action button. An homage to the published software design principles of Jason Fried and 37signals, not affiliated with or endorsed by Jason Fried, David Heinemeier Hansson or 37signals.
colors:
  background: "#fbfaf6"
  surface: "#ffffff"
  border: "#e5e2d9"
  primary: "#1c1b18"
  secondary: "#59564f"
  marker: "#fff275"
  accent: "#1d6f42"
  on-accent: "#ffffff"
typography:
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 38px
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: -0.025em
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 17px
    fontWeight: 700
    lineHeight: 1.2
  note:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
rounded:
  sm: 6px
  md: 12px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 28px
  xl: 44px
components:
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.xl}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: 52px
    padding: "0 {spacing.lg}"
---

## Philosophy

- **Copywriting is interface design.** Clear, human sentences solve problems that twenty UI controls only tangle.
- **Calm, opinionated defaults.** Pick one sensible answer instead of asking the person ten configuration questions.
- **One clean page, zero chrome.** No sidebars, no multi-pane dashboards, no visual clutter competing with reading.

## Overview

Build the screen as a single centered sheet (`max-width: 600px`) on warm cream paper (`#fbfaf6`), headed by a bold conversational headline (`38px / 800`), plain readable prose (`18px / 1.6`) with one yellow highlighter mark (`#fff275`), and one green pill button (`#1d6f42`) speaking in first-person human English.

## Colors

- `background` `#fbfaf6` warm cream paper and `surface` `#ffffff` centered sheet bounded by `border` `#e5e2d9`.
- `marker` `#fff275` highlights one reassuring phrase inline behind dark `#1c1b18` ink.
- `accent` `#1d6f42` fills the primary pill button paired with `#ffffff` bold text.

## Typography

Centered bold headline (`38px / 800`), generous readable paragraphs (`18px / 1.6`), zero jargon or uppercase chrome.

## Layout

- Single-column centered reading flow (`max-width: 600px`, `44px` sheet padding).
- Generous vertical spacing (`28px`) between headline, paragraph, and button.

## Elevation & Depth

Subtle paper sheet depth (`0 4px 20px rgb(28 27 24 / 0.05)`) paired with `1px solid #e5e2d9`.

## Shapes

`12px` card corners, `999px` pill button.

## Components

- **sheet**: Centered white editorial page card (`max-width: 600px`).
- **button-primary**: `52px` `#1d6f42` pill button with conversational label.

## Do's and Don'ts

- Do write every headline and button label the way a friendly human speaks aloud.
- Do underline or marker-highlight (`#fff275`) the single key guarantee in the body sentence.
- Do center one calm column on `#fbfaf6` paper with zero sidebars or nav clutter.
- Don't use enterprise jargon, acronyms, or configuration panels.

## Never

- Sidebars, multi-column dense admin grids, or jargon labels.
- Any 37signals, Basecamp, or HEY trademark.

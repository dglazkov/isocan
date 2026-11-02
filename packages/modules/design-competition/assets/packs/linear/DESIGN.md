---
version: alpha
name: Fast is a feature — after Karri Saarinen & Linear
description: A dense, calm, keyboard-first system for one screen of a tool people use all day. Dark-first with an equal light theme, neutral surfaces stepped in small lightness increments, one indigo accent for focus, selection and the primary button, compact rows, a command palette as the front door, hairlines instead of shadows, and changes that happen before you finish the keystroke. An homage to the published principles of Karri Saarinen and Linear, not Linear's theme, and not affiliated with or endorsed by Karri Saarinen or Linear.
colors:
  background: "#08090a"
  panel: "#0f1011"
  elevated: "#1c1d1f"
  hairline: "#23252a"
  primary: "#f7f8f8"
  secondary: "#8a8f98"
  muted: "#62666d"
  accent: "#5e6ad2"
  on-accent: "#ffffff"
  status-started: "#f2c94c"
  status-done: "#4cb782"
  status-blocked: "#eb5757"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.022em
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: -0.01em
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  ui:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
  small:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.35
    fontFeature: "'tnum' 1"
  keycap:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1
  mono:
    fontFamily: "ui-monospace, monospace"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  sidebar: 240px
components:
  sidebar:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.secondary}"
    typography: "{typography.ui}"
    width: "{spacing.sidebar}"
    padding: "{spacing.sm}"
  list-row:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.ui}"
    height: 34px
    padding: "0 {spacing.lg}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    height: 32px
    padding: "0 {spacing.md}"
  button-secondary:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.primary}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    height: 32px
    padding: "0 {spacing.md}"
  command-palette:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    width: 640px
    padding: "{spacing.sm}"
  keycap:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.secondary}"
    typography: "{typography.keycap}"
    rounded: "{rounded.sm}"
    padding: "2px 5px"
    height: 18px
  status-dot:
    backgroundColor: "{colors.status-started}"
    rounded: "{rounded.full}"
    size: 8px
---

## Philosophy

- **Quality is a choice.** Craft is what you do, quality is what comes out, and choosing it every day is a strategy, not a luxury ([Why is quality so rare?, 2025](https://linear.app/now/why-is-quality-so-rare)).
- **Opinionated and purpose-built.** Simple first, then powerful; say no to busy work, decide and move on ([The Linear Method](https://linear.app/method/introduction)).
- **Cut scope to raise quality.** Design with clear opinions; the spec is the baseline, not the finish line ([Figma: Karri Saarinen's 10 rules](https://www.figma.com/blog/karri-saarinens-10-rules-for-crafting-products-that-stand-out/)).
- **Less chrome, more contrast.** Remove noise, raise contrast and hierarchy, and generate a neutral, timeless palette in LCH ([How we redesigned the Linear UI, 2024](https://linear.app/now/how-we-redesigned-the-linear-ui)).
- **Output isn't design.** Generating screens is easy; understanding the problem is the hard part, a warning aimed squarely at AI designers ([Output isn't design, 2026](https://linear.app/now/output-isn-t-design)).

## Overview

Build the screen as a working tool: a 240px sidebar, a dense list of rows as the main view, a detail pane or board when needed, and a command palette (⌘K / Ctrl+K) that can reach every action. Everything is neutral grey except one indigo accent; status is a small coloured dot. Changes apply instantly. The app is calm; any gradient glow belongs to a marketing page, not here. The hex values are this pack's translation, not Linear's theme.

## Colors

- Dark first: `background` `#08090a`, `panel` `#0f1011` (sidebar), `elevated` `#1c1d1f` (menus, palette, dialogs, secondary buttons). Each step is a small lightness increase; generate further steps with `oklch()` by adding about 0.02–0.03 L.
- `primary` `#f7f8f8` text; `secondary` `#8a8f98` supporting text and icons; `muted` `#62666d` placeholders and disabled only.
- `hairline` `#23252a` for every 1px border and divider.
- `accent` `#5e6ad2` is the one colour: focus ring, selected row indicator, the primary button, the active sidebar item's icon. Nothing else.
- Status colours appear only as 8px dots or 14px icons, never as filled blocks or backgrounds.
- Light theme is an equal: `#fcfcfd` background, `#f4f5f8` panel, `#ffffff` elevated, `#e6e7eb` hairline, `#1b1c1f` text, `#6b6f76` secondary, the same accent. Support both with `prefers-color-scheme`.

## Typography

Inter (OFL) throughout. UI text 13px/500, body 14px/400, titles 15px/600, metadata 12px, keycaps 11px/500. One display size (32px/600, −0.022em) for an empty state or page title only. Weights 400, 500, 600. `font-variant-numeric: tabular-nums` on every count, date and ID. Monospace (`ui-monospace`) only for identifiers like `ENG-142`.

## Layout

- 4px base scale; rows 32–36px (34px default); a 240px sidebar; 16px horizontal padding in lists.
- List first: the main view is a list of rows (status dot, ID, title, labels, assignee, date) with split view or board as alternatives.
- The command palette opens centred at 20% from the top, 640px wide, with a search field and grouped results, each result showing its shortcut as keycaps.
- Density is a feature: show 20+ rows on a laptop screen without scrolling.

## Elevation & Depth

Hairlines, not shadows. Surfaces separate by a lightness step plus a 1px `hairline` border (`rgb(255 255 255 / .08)` over dark). The only shadow is under floating layers (palette, menus): `0 8px 24px rgb(0 0 0 / .4)`, paired with a 1px border. No glass, no blur, no glow in the app.

## Shapes

6px radius on buttons and inputs, 8px on menus, the palette and dialogs, 4px on keycaps and tags, full circles for status dots and avatars. Icons are 16px monochrome line icons with a ~1.5px stroke, aligned to the text baseline, drawn in `secondary`.

## Components

- **sidebar**: 240px, `panel`, 13px items 28px tall, active item on a subtle `elevated` fill.
- **list-row**: 34px, hover fills `panel`, selected shows a 2px `accent` bar at the left edge; keyboard focus moves with J/K or arrow keys.
- **button-primary**: the one indigo button, 32px, 6px radius, label plus its shortcut keycap.
- **button-secondary**: `elevated` with a hairline border.
- **command-palette**: `elevated`, 8px radius, hairline border, floating shadow; opens on ⌘K / Ctrl+K in under 100ms.
- **keycap**: 18px tall, 11px text, shown beside every menu item and in tooltips ("Create issue C").
- **status-dot**: an 8px circle in the status colour, before the row title.

## Do's and Don'ts

- Do open a command palette on ⌘K / Ctrl+K, and make every action on the screen reachable from it.
- Do give every action a single-key or modifier shortcut and show it as keycaps in menus, tooltips and buttons.
- Do keep visible focus rings (2px `accent`, 2px offset) and full keyboard navigation of the list.
- Do apply local changes optimistically in the same frame; use a skeleton only for the first network load.
- Do use neutrals plus one accent; show status only as small dots or icons.
- Do use 32–36px rows, a 240px sidebar and 13–14px Inter; show dense data calmly.
- Do animate for 100–200ms with `ease-out`, opacity and transform only; no springs, no bounce; honour `prefers-reduced-motion`.
- Do write terse, precise, sentence-case copy with standard terminology ("Create issue", "Assign to me").
- Do ship good defaults instead of settings.
- Don't use a spinner for a local change.
- Don't put gradients, glows or saturated colour blocks in the app chrome.
- Don't build a modal wizard for a simple action.

## Never

- A mouse-only flow, or a wizard for a simple act.
- Colour blocks in chrome, or a second accent.
- A spinner for a local change.
- Configuration in place of a good default.
- Linear's logo, or anything that copies its trade dress.

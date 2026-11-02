---
version: alpha
name: Road signs, not illustrations — after Susan Kare
description: A 1-bit pixel system for one screen that is friendly, legible and exact. Black pixels on white, icons drawn on a 16 or 32 grid as crisp rects, a bitmap face for chrome and a clear sans for reading, square windows with hard offset shadows, dither patterns instead of fades, and one original smiling character somewhere. An homage to the published principles of Susan Kare, not her artwork, and not affiliated with or endorsed by Susan Kare, Apple or Microsoft.
colors:
  background: "#ffffff"
  primary: "#000000"
  danger: "#aa0000"
  info: "#0000aa"
  ok: "#00aa00"
  highlight: "#ffff55"
typography:
  title:
    fontFamily: "Pixelify Sans, ui-monospace, monospace"
    fontSize: 32px
    fontWeight: 700
    lineHeight: 40px
  chrome:
    fontFamily: "Silkscreen, ui-monospace, monospace"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
  menu:
    fontFamily: "Pixelify Sans, ui-monospace, monospace"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
  body:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
rounded:
  none: 0px
  sm: 2px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  icon: 32px
components:
  window:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "{spacing.md}"
  title-bar:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.chrome}"
    height: 24px
  button:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.menu}"
    rounded: "{rounded.sm}"
    padding: "4px 16px"
    height: 32px
  menu-item-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    typography: "{typography.menu}"
    padding: "0 16px"
    height: 24px
  icon-tile:
    textColor: "{colors.primary}"
    typography: "{typography.menu}"
    size: "{spacing.icon}"
  alert-danger:
    backgroundColor: "{colors.background}"
    textColor: "{colors.danger}"
    typography: "{typography.menu}"
    padding: "{spacing.md}"
---

## Philosophy

- **Road signs, not illustrations.** An icon delivers one idea clearly, concisely and memorably, the way a road sign does, rather than depicting a scene (Kare's point in the Stanford [Making the Macintosh interview](https://web.stanford.edu/dept/SUL/sites/mac/primary/interviews/kare/index.html), paraphrased).
- **The constraint is the medium.** Sketch on graph paper, one square per pixel, borrowing from needlepoint and mosaics ([Hyperallergic on the MoMA acquisition](https://hyperallergic.com/194930/sketches-for-first-mac-icons-acquired-by-moma/)).
- **Borrow what people already know.** Trash can, scissors, paintbrush: familiar objects let a newcomer understand a command on sight ([Smithsonian](https://www.smithsonianmag.com/innovation/how-susan-kare-designed-user-friendly-icons-for-first-macintosh-180973286/)).
- **Warmth and wit.** A friendly face and a card game made a new machine feel less intimidating ([Gizmodo](https://gizmodo.com/everyones-a-winner-with-these-windows-3-0-cards-by-susa-1723146166)).

## Overview

Build the screen as a small, friendly desktop: square windows with striped title bars, a menu of short verbs, and a row of icon-plus-label commands, all in black on white. Every icon is an original drawing of a familiar object on a pixel grid. Colour is off by default and only appears where it means something. Somewhere, usually the empty or error state, an original pixel character smiles. The values here are this pack's translation into CSS, not Susan Kare's specification, and nothing here copies her icons.

## Colors

- 1-bit first: `background` `#ffffff` and `primary` `#000000` do almost everything. Selection is inversion (black fill, white text), not a tint.
- Colour is optional and semantic, from a 16-colour VGA-style set: `danger` `#aa0000` for destructive actions and errors, `info` `#0000aa` for links and information, `ok` `#00aa00` for success pixels in an icon (never text), `highlight` `#ffff55` for a highlighted fill behind black text. If a colour does not mean one of those things, it is black.
- Greys do not exist; a grey is a dither pattern of black and white pixels.

## Typography

- Chrome (title bars, window names): Silkscreen at 16px (or 8/24px), uppercase as the face draws it.
- Menus, buttons, icon labels: Pixelify Sans at 16px, title at 32px. Whole-pixel sizes only, line heights on the 8px grid (24px, 40px).
- Body text and anything longer than a line: Public Sans 16/24px, so reading stays easy.
- Do not use Chicago, Geneva or Monaco clones of unclear licence. Load the OFL faces from Google Fonts; `ui-monospace` is the fallback for chrome.

## Layout

- 4px and 8px units only, so every edge lands on the pixel grid; no fractional pixels, no `transform: scale` by non-integers.
- Windows on a white or 50% dither desktop; a 1px black border, a 24px title bar with six 1px horizontal stripes and the title centred on a white gap.
- Icons are 32×32 (or 16×16) drawn at 1 unit per pixel and displayed at 1×, 2× or 3× with `image-rendering: pixelated`; the label sits centred under the icon, 4px below.
- A menu bar across the top with short verbs; commands in the window as an icon grid with 16px gaps.

## Elevation & Depth

Only the hard offset shadow: `box-shadow: 2px 2px 0 #000000` on windows, menus and buttons (4px 4px 0 for a dialog). No blur, no transparency, no gradients. A pressed button inverts instead of moving. Disabled items are drawn with a 50% checkerboard dither, never with opacity.

## Shapes

Square corners everywhere (0px); 2px only on buttons, drawn as a pixel step, not a smooth curve. Borders are exactly 1px black; the default button gets a second 1px ring 2px outside the first. Icons are built from SVG `<rect>` elements with `shape-rendering="crispEdges"`: no circles, no paths, no anti-aliased diagonals (diagonals are pixel staircases).

## Components

- **window**: white, 1px black border, 2px 2px 0 shadow, 16px padding.
- **title-bar**: 24px, striped with 1px lines, Silkscreen title on a white gap, a square close box at the left.
- **button**: white, 1px black border, 2px pixel corner, 32px high; pressed state inverts to black with white text.
- **menu-item-selected**: inversion, black bar with white text, full width of the menu.
- **icon-tile**: a 32×32 original pixel icon with its label beneath; selected state inverts the icon and the label.
- **alert-danger**: the only red; a pixel warning icon and a plain sentence.

## Do's and Don'ts

- Do draw every icon yourself on a 16×16 or 32×32 grid as SVG rects with `shape-rendering="crispEdges"`, one idea per icon, as a familiar object (a pencil, a folder, a clock).
- Do give every command both an icon and a text label.
- Do scale pixel art only by whole multiples and set `image-rendering: pixelated` on it.
- Do use dither patterns for disabled items, selection backgrounds and the desktop: a hard-edged 2×2 checkerboard, as an SVG pattern or `background: repeating-conic-gradient(#000 0 25%, #fff 0 50%) 0 0/2px 2px` (a pixel pattern, not a fade).
- Do use 1px black borders, square corners and `2px 2px 0 #000` shadows.
- Do animate in frames: `steps()` timing only, e.g. a caret blinking with `animation: blink 1s steps(1) infinite`, a 2-frame wiggle, marching ants; no easing curves.
- Do put one original smiling pixel character in the empty or error state.
- Do write short, friendly menu verbs ("Open…", "Save As…", "Undo") with an ellipsis only when a dialog follows.
- Don't use blur, gradients, glass, opacity fades or soft shadows.
- Don't draw an abstract glyph that needs a tooltip to be understood.
- Don't use colour unless it means danger, information, success or highlight.
- Don't reproduce any icon from the Macintosh, Windows or any other product: no happy computer, no bomb, no trash can as drawn there, no command-key rendering, no card faces.

## Never

- Blur, gradients or glassmorphism.
- Glyphs that need a tooltip to make sense.
- Anti-aliased half-pixels in an icon.
- Any of her actual Apple or Microsoft icons, or a close copy of one.

---
version: alpha
name: Serious toys — after Jesper Kouthoofd & Teenage Engineering
description: A tactile industrial hardware system for one screen built like a pocket synthesizer. Anodized light aluminium chassis divided by crisp CAD hairlines, a recessed black OLED display window, monospaced uppercase silkscreen legends, and color-coded mechanical encoder caps. An homage to the published industrial and UI design principles of Jesper Kouthoofd and Teenage Engineering, not affiliated with or endorsed by Jesper Kouthoofd or Teenage Engineering.
colors:
  background: "#e5e5e3"
  surface: "#f0f0ee"
  oled: "#111111"
  line: "#191919"
  secondary: "#575755"
  accent: "#ff4f00"
  blue: "#0078ff"
  green: "#18a957"
  ochre: "#f2b705"
typography:
  readout:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 28px
    fontWeight: 500
    lineHeight: 1.1
    fontFeature: "'tnum' 1"
  heading:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: -0.02em
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.4
  legend:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0.08em
rounded:
  none: 0px
  sm: 3px
  md: 6px
  cap: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  cap: 48px
components:
  chassis:
    backgroundColor: "{colors.background}"
    textColor: "{colors.line}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  oled-screen:
    backgroundColor: "{colors.oled}"
    textColor: "{colors.surface}"
    typography: "{typography.readout}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  encoder-cap:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.line}"
    typography: "{typography.legend}"
    rounded: "{rounded.cap}"
    size: "{spacing.cap}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.legend}"
    rounded: "{rounded.sm}"
    height: "{spacing.cap}"
    padding: "0 {spacing.md}"
---

## Philosophy

- **Serious instruments, playful spirit.** High-precision engineering paired with toy-like color coding and immediate physical curiosity.
- **Hardware and UI as one CAD drawing.** Hairline structural partitions, exposed registration marks, and monospaced silkscreen callouts unify physical bezel and screen.
- **Color is channel identity.** Four calibrated mechanical cap colors (`#ff4f00`, `#0078ff`, `#18a957`, `#f2b705`) map directly to parameters so hands never hunt.

## Overview

Build the screen as a compact machined faceplate on `#e5e5e3` anodized aluminium divided by `1px` `#191919` CAD lines. A crisp `#111111` OLED display strip across the top shows live telemetry and vector graphics; beneath it sit aligned mechanical switch banks labelled in `11px` uppercase monospace, culminating in one `#ff4f00` orange trigger switch.

## Colors

- `background` `#e5e5e3` is the machined aluminium body; `surface` `#f0f0ee` is a raised keycap.
- `oled` `#111111` is the recessed high-contrast display bezel.
- `line` `#191919` draws every `1px` structural partition and primary text glyph; `secondary` `#575755` marks unit legends.
- `accent` `#ff4f00` marks the primary action key and active vector highlight; `blue` `#0078ff`, `green` `#18a957`, and `ochre` `#f2b705` identify secondary encoder channels.

## Typography

Monospaced uppercase legends (`11px`, `+0.08em`) name every cell and switch (`CH-01 // POT`). Tabular monospaced numerals (`28px`) drive the OLED readout. Clean neo-grotesk (`Inter`, `14px`–`20px`) carries concise instructions.

## Layout

- Strict `8px` mechanical lattice; zero floating unanchored cards.
- Every functional zone sits inside a crisp `1px solid #191919` structural cell on the faceplate.

## Elevation & Depth

Tactile key switch depth only: `box-shadow: 0 2px 0 #191919` on raised caps, snapping down (`transform: translateY(2px); box-shadow: none`) on press over `80ms`. No soft blurs.

## Shapes

`6px` outer chassis corners, `3px` keyswitches, true circles (`999px`) for rotary encoder caps and corner screw markers.

## Components

- **chassis**: Anodized `#e5e5e3` panel with `1px solid #191919` structural grid lines.
- **oled-screen**: `#111111` display window with crisp SVG line telemetry and tabular readout.
- **encoder-cap**: `48px` circular parameter button with `2px` hard shadow detent.
- **button-primary**: `#ff4f00` mechanical rectangular switch (`48px` tall).

## Do's and Don'ts

- Do divide every zone on the anodized chassis with crisp `1px solid #191919` structural lines.
- Do include an interactive `#111111` OLED readout window that updates live when switches are clicked.
- Do label every switch cell with compact uppercase monospaced legends (`01 // SPEC`).
- Don't use soft drop shadows, rounded `24px` web cards, or corporate stock photos.

## Never

- Soft web marketing cards or gradients.
- Unlabelled sliders without numeric readouts.
- Any Teenage Engineering trademark or product name used as endorsement.

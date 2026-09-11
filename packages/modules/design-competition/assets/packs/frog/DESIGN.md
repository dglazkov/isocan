---
version: alpha
name: Form follows emotion — after frog design
description: An expressive, research-led system for one screen that makes you feel something before you use it. A warm Fog and Platinum chassis, one bold brand colour poured into large fields, heavy wide display type over a quiet body, and a single signature groove motif carried through every component so the screen reads as one member of a product family. An homage to the published principles of frog design, not frog's brand guidelines and not affiliated with or endorsed by frog, Hartmut Esslinger or Capgemini.
colors:
  background: "#efece4"
  platinum: "#d8d5ce"
  surface: "#f8f6f0"
  groove: "#c4bfb4"
  primary: "#1f1c18"
  secondary: "#5c564d"
  accent: "#d10a72"
  on-accent: "#ffffff"
  support: "#ffc233"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: 72px
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: -0.03em
    fontVariation: "'wdth' 125"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.015em
    fontVariation: "'wdth' 112"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.01em
  overline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.12em
    fontVariation: "'wdth' 125"
rounded:
  sm: 6px
  md: 14px
  lg: 28px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 32px
  xl: 56px
  xxl: 96px
  groove-pitch: 10px
components:
  hero-field:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.display}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl} 48px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "16px 28px"
    height: 52px
  button-on-field:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "16px 28px"
    height: 52px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  groove-rule:
    backgroundColor: "{colors.groove}"
    height: 2px
  progress-bar:
    backgroundColor: "{colors.platinum}"
    rounded: "{rounded.pill}"
    height: 10px
  eyebrow:
    textColor: "{colors.accent}"
    typography: "{typography.overline}"
---

## Philosophy

- **Form follows emotion.** Using a device should be an emotional, sensual process that bonds people to the technology; a purely technical form leaves them cold ([Red Dot Design Museum](https://www.red-dot-design-museum.org/essen/exhibitions/design-fundamentals/basic-design-principles/form-follows-emotion)).
- **One family, one language.** Snow White unified a whole product line with a single vocabulary of colour, grooves and proportion ([Snow White design language](https://en.wikipedia.org/wiki/Snow_White_design_language)).
- **Design is strategy.** It decides what a product is for people, and is not styling applied at the end ([Hartmut Esslinger, Designers & Books](https://www.designersandbooks.com/designer/bio/hartmut-esslinger)).
- **Research-led, and brave.** Human-centred work across hardware, enterprise software and services, with the courage to be expressive ([frog50](https://www.frog.co/designmind/frog50)).

## Overview

Before any markup, write the emotional brief: two adjectives for how this product should feel (default "warm, confident" if the brief gives no cue), in an HTML comment on the first line. Every choice below defends those two words. The screen is a warm chassis with one big field of brand colour, a heavy wide headline that makes a promise, and the groove motif tying header, dividers, empty state and progress together. The hex values are this pack's translation of the spirit (Fog and Platinum are Snow White colour names, the values approximate), not frog's specification.

## Colors

- `background` Fog `#efece4` is the chassis; `surface` `#f8f6f0` is a card lifted off it; `platinum` `#d8d5ce` is a recessed track or secondary panel.
- `primary` `#1f1c18` is the ink; `secondary` `#5c564d` is supporting text.
- `accent` `#d10a72` is the brand colour, used boldly: a hero field, a primary panel, the primary button, the eyebrow. At least one large field (≥ 30% of the first viewport) is `accent` with `on-accent` white text.
- `support` `#ffc233` is the one supporting colour, used only for the single moment of delight (a badge, a success burst, the finished progress segment). Never text on Fog.
- `groove` `#c4bfb4` is only for the signature motif.

## Typography

One family, Archivo (OFL, variable width), in two voices. Display 72px / 800 / `font-variation-settings: 'wdth' 125`, tracking −0.03em, line-height 0.95 — used once, for the promise. Headline 32/700 at width 112. Body 17/400 at normal width, 1.55 line-height, max 62ch: quiet so the display can shout. Labels 15/600. Eyebrows 12/700 wide, uppercase, +0.12em tracking, in `accent`. Headlines read as promises ("Your week, already sorted"), not descriptions.

## Layout

- 8px base with a 10px groove pitch for the motif: the grooves are 2px lines every 10px, echoing Snow White's shallow grooves.
- A bold asymmetric hero: the brand field spans 7 of 12 columns, content or product image breaks out of it by 32–56px.
- Generous vertical rhythm: 56px between sections, 96px above the first section after the hero.
- A second screen or state must be recognisably the same family: same field, same groove, same type voices.

## Elevation & Depth

Tactile, not floating. Cards rest flat with a 1px `groove` edge and lift 2px on hover (`transform: translateY(-2px); box-shadow: 0 8px 20px rgb(31 28 24 / .12)`). The primary button presses in: `transform: translateY(1px); box-shadow: inset 0 2px 0 rgb(0 0 0 / .18)`. No glass, no blur.

## Shapes

Friendly, confident radii: 6px small, 14px cards, 28px the hero field, pills for buttons and the progress bar. The groove motif is the only texture: `background-image: repeating-linear-gradient(to bottom, #c4bfb4 0 2px, transparent 2px 10px)` in headers, as dividers (three grooves), in empty states and as the progress track. Icons are a custom set drawn at a 2px stroke with one quirk used on every glyph (rounded terminals), never a stock set.

## Components

- **hero-field**: the brand colour as a field, 28px radius, white display type, the promise and one action.
- **button-primary**: magenta pill, 52px, white label; presses in; a 300ms overshoot on first appearance (`cubic-bezier(.34,1.56,.64,1)`).
- **button-on-field**: Fog pill for the action inside the magenta field.
- **card**: lifted surface, 14px radius, lifts 2px on hover.
- **groove-rule**: three 2px grooves on a 10px pitch; the only divider.
- **progress-bar**: a Platinum pill track with the groove inside, filled in `accent`, the final segment in `support`.
- **eyebrow**: the small wide label above a headline.

## Do's and Don'ts

- Do put `<!-- emotion: warm, confident -->` (your two adjectives) on the first line and make the palette, type and motion defend them.
- Do give the brand colour at least one large field in the first viewport, not just links.
- Do use one supporting colour at most, and only for the delight moment.
- Do use the groove motif in at least three places (header, divider, progress or empty state) and nowhere random.
- Do set the display line in Archivo 800 at width 125, 56–80px, tight tracking.
- Do make states tactile: press-in on buttons, 2px lift on cards, a small overshoot on the primary action; keep every animation under 400ms and honour `prefers-reduced-motion`.
- Do keep body text at 4.5:1 or better and targets at 44px or more; delight never costs usability.
- Do write warm, confident copy with a human voice; headlines promise, microcopy speaks like a person.
- Don't ship a template SaaS hero: centred headline, grey subhead, two buttons, a stock illustration.
- Don't mix motifs; the groove is the only one.
- Don't use a stock icon set unchanged.
- Don't leave any screen purely grey and functional with no moment of delight.

## Never

- A generic template look over a default component kit.
- Function with no moment of delight.
- Delight that costs contrast or target size.
- Unrelated motifs mixed together.
- A frog, or any frog mark.

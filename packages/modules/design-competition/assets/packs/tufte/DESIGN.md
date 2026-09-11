---
version: alpha
name: Show the data — after Edward Tufte
description: A handout-style system for one screen where the evidence is the design. Warm paper and near-black ink, a serif text column with a wide margin for sidenotes and small figures, charts stripped to their data with lines labelled at their ends, small multiples on a shared scale, sparklines inside sentences, and one red mark for the point. An homage to the published principles of Edward Tufte, not his work, and not affiliated with or endorsed by Edward Tufte.
colors:
  background: "#fffff8"
  primary: "#111111"
  secondary: "#5f5f5f"
  context: "#a0a0a0"
  accent: "#a61b1b"
  series: "#35608c"
typography:
  title:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: 40px
    fontWeight: 400
    lineHeight: 1.1
  heading:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: 26px
    fontWeight: 400
    lineHeight: 1.2
  body:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.5
  sidenote:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.35
  table-number:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "'lnum' 1, 'tnum' 1"
  chart-label:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.2
    fontFeature: "'lnum' 1"
rounded:
  none: 0px
  dot: 50%
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 32px
  xl: 48px
  main-column: 55%
  margin-column: 30%
components:
  main-column:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    width: "{spacing.main-column}"
  sidenote:
    textColor: "{colors.primary}"
    typography: "{typography.sidenote}"
    width: "{spacing.margin-column}"
  sparkline:
    textColor: "{colors.context}"
    height: 1em
    width: 5em
  sparkline-point:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.dot}"
    size: 4px
  data-table:
    textColor: "{colors.primary}"
    typography: "{typography.table-number}"
  chart-label:
    textColor: "{colors.secondary}"
    typography: "{typography.chart-label}"
  small-multiple:
    textColor: "{colors.primary}"
    typography: "{typography.chart-label}"
    width: 140px
---

## Philosophy

- **Above all else show the data.** Maximise the share of ink that carries data and erase the rest, within reason ([VDQI](https://en.wikipedia.org/wiki/The_Visual_Display_of_Quantitative_Information), [EDAV notes on data-ink](https://jtr13.github.io/cc19/tuftes-principles-of-data-ink.html)).
- **Chartjunk harms understanding.** Ink that tells the viewer nothing new costs attention and can mislead.
- **Compared to what?** Comparison is the heart of analysis; small multiples put the comparisons side by side at the same scale.
- **Integrate words, numbers and images.** Sparklines are data-intense, design-simple, word-sized graphics that live inside sentences and tables ([edwardtufte.com](https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/)).
- **Templates and bullet outlines corrupt reasoning.** Fragmenting an argument into bullets hides the evidence ([The Cognitive Style of PowerPoint](https://www.edwardtufte.com/notebook/new-edition-of-the-cognitive-style-of-powerpoint/)).

## Overview

Build the screen as a printed handout that happens to be on a screen: a title, a paragraph of real prose stating the finding with sparklines inline, one principal graphic that shows the evidence, small multiples for the comparison, a precise table, and sidenotes in the margin carrying sources, definitions and asides. The paper `#fffff8` and ink `#111` are Tufte CSS's published values ([tufte-css](https://github.com/edwardtufte/tufte-css)); the other colours and sizes are this pack's translation. ET Book (MIT, [et-book](https://github.com/edwardtufte/et-book)) is the original face; this pack uses EB Garamond from Google Fonts, falling back to Georgia.

## Colors

- `background` `#fffff8` paper and `primary` `#111111` ink are nearly the whole page.
- Colour encodes data only. Context (comparison lines, other series, axes' range frames) is `context` grey `#a0a0a0`.
- `accent` red `#a61b1b` marks *the* point: the one line, dot or value the reader must see. At most one or two red marks per graphic.
- `series` `#35608c` is only for a second data series that must be distinguished and cannot be labelled apart by position.
- `secondary` `#5f5f5f` is for chart labels and captions. No brand colours in charts, no background fills anywhere.

## Typography

One serif, EB Garamond (fallback Georgia). Body 20px/1.5 in a column of 55% width; headings 26px regular and italic subtitle; title 40px regular. Sidenotes 15px, numbered with superscript references in the text. Numbers in tables and charts use lining, tabular figures (`font-variant-numeric: lining-nums tabular-nums`). Italic for emphasis, never bold blocks; no all caps except small caps for abbreviations.

## Layout

- Main column about 55% wide, left-aligned with a 12% left margin; a right margin about 30% wide for sidenotes, margin notes and small figures, aligned to the line they annotate (`float: right; margin-right: -60%` pattern). Never footnotes, popovers or tooltips.
- A full-width figure is allowed for the principal graphic when the data need it.
- Small multiples: a grid of 4–12 identical 140px charts with one shared scale, labelled once.
- Tables: right-aligned numbers, left-aligned text, a rule at top, one under the header, one at the bottom; no vertical lines, no zebra stripes.
- Density is respect: put comparisons on the same page, next to each other, rather than across tabs, carousels or pagination.

## Elevation & Depth

None. The page is paper. No shadows, cards, borders around charts, background panels or 3-D. Separation is whitespace and, in tables, three thin rules.

## Shapes

No rounded corners and no containers. The only round thing is a data point (a 4px dot). Lines are 1px (1.5px for the principal series); axes are range frames, drawn only across the span of the data, in `context` grey, with a few labelled ticks.

## Components

- **main-column**: the prose, 55% wide, 20px serif, the finding stated in full sentences.
- **sidenote**: margin text beside the line it explains, carrying source, units and caveats.
- **sparkline**: an inline SVG one line tall (about 1em × 5em) in `context` grey, with a 4px dot on the last value (red if it is the point) and small grey dots on min and max; the last value written right after it.
- **sparkline-point**: the red dot.
- **data-table**: booktabs rules, tabular lining numerals, right-aligned, units in the header.
- **chart-label**: the direct label at the end of each line, in the line's colour or `secondary`.
- **small-multiple**: one of a grid of identical mini-charts on a shared scale.

## Do's and Don'ts

- Do state the finding in a sentence before the graphic, with the key numbers and a sparkline inline.
- Do label lines directly at their right ends; delete the legend.
- Do delete gridlines, chart borders, background fills, tick marks that carry nothing, and 3-D.
- Do use range-frame axes and start scales where the data honestly allow; show zero when the quantity is a magnitude.
- Do prefer dot plots and slopegraphs to pie charts, and small multiples to a single overloaded chart.
- Do put source, units and dates on or beside every graphic, in a sidenote if not on it.
- Do use grey for context and one red mark for the point; colour for data only.
- Do use right-aligned tabular numbers and three horizontal rules in tables.
- Do keep everything visible: no hover-only values, no motion, no transitions, no icons (words instead).
- Don't write bullet lists as the content; write sentences and paragraphs.
- Don't use dual axes, truncated or distorted scales, or area for one-dimensional data.
- Don't split things meant to be compared across tabs, carousels or pages.

## Never

- Chartjunk: 3-D, gradients, drop shadows, decorative icons, moiré fills.
- Bullets as content.
- A truncated or distorted scale.
- A carousel or pagination for things meant to be compared.
- Data hidden behind a hover.

---
version: alpha
name: Build to think — after IDEO
description: A mid-fidelity prototyping system for one screen that is honest about being a prototype. Greyscale wireframe surfaces, a clearly fictional person with one need, three deliberately different concepts before one is developed, numbered sticky-note annotations tying every choice to that need, and a strip of what we would test next. An homage to the published human-centred design methods of IDEO, not IDEO's own toolkit and not affiliated with or endorsed by IDEO.
colors:
  background: "#fafafa"
  surface: "#ffffff"
  fill: "#ececec"
  wire: "#c8c8c8"
  primary: "#222222"
  secondary: "#555555"
  sticky: "#ffd84d"
typography:
  display:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.25
  annotation:
    fontFamily: "Caveat, Comic Neue, cursive"
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.15
  callout-number:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1
rounded:
  none: 0px
  sm: 4px
  note: 2px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  target: 48px
components:
  concept-frame:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  persona-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  sticky-note:
    backgroundColor: "{colors.sticky}"
    textColor: "{colors.primary}"
    typography: "{typography.annotation}"
    rounded: "{rounded.note}"
    padding: "12px 14px"
    width: 180px
  callout-marker:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.callout-number}"
    rounded: "{rounded.full}"
    size: 24px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "14px 20px"
    height: "{spacing.target}"
  test-strip:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    padding: "{spacing.lg}"
  image-placeholder:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
---

## Philosophy

- **Start with people.** Observe, empathise and design with the people you serve; work moves from inspiration to ideation to implementation ([Design Kit](https://www.designkit.org/human-centered-design.html)).
- **Three lenses.** A good idea is desirable to people, feasible to build and viable as a business ([Tim Brown, "Design Thinking", HBR 2008](https://hbr.org/2008/06/design-thinking)).
- **Build to think.** Cheap, early, plentiful prototypes settle arguments that meetings cannot; the Nightline team redesigned a shopping cart in five days ([Umbrex profile](https://umbrex.com/resources/profiles-of-the-top-consulting-firms/overview-profile-and-history-of-ideo/)).
- **Diverge, then converge.** Defer judgment, encourage wild ideas, build on others' ideas, stay focused, be visual, go for quantity ([IDEO U, 7 rules of brainstorming](https://www.ideou.com/blogs/inspiration/7-simple-rules-of-brainstorming)).
- **Machines diverge, people converge.** In IDEO's own 2020 experiment an AI was strong at generating options and weak at choosing among them ([IDEO Journal](https://www.ideo.com/journal/the-rules-of-brainstorming-change-when-artificial-intelligence-gets-involved-heres-how)).

## Overview

The entry is a working prototype, and looks like one on purpose. From top to bottom: a "How might we…?" line; a persona card for a clearly fictional person with a name, a context and one need; three small, deliberately different concepts (A, B, C) side by side with one sentence each; the chosen concept built out as one clickable flow with numbered sticky-note callouts explaining why; and a "What we'd test" strip. Greyscale throughout, with sticky yellow for annotations only. The hex values are this pack's translation, not IDEO's specification.

## Colors

- `background` `#fafafa` is the page; `surface` `#ffffff` is a frame, card or screen in the prototype; `fill` `#ececec` is a placeholder or strip; `wire` `#c8c8c8` is the stroke of placeholders and the dashed frame of unchosen concepts.
- `primary` `#222222` is ink and the 1.5px wireframe stroke; `secondary` `#555555` is metadata.
- `sticky` `#ffd84d` is only the background of annotation notes and the callout highlight. It never fills a button, a heading or a screen area of the prototype itself, and text on it is always `primary`.
- No other colours. If the concept needs colour to work, write that down as an assumption to test.

## Typography

Atkinson Hyperlegible (OFL, designed for low-vision readers) for everything in the prototype: display 28/700 for the How-might-we line, title 20/700, body 18/400 (large on purpose), label 16/700. Annotations are handwritten, in Caveat 22/600, so nobody mistakes the notes for UI. Callout numbers 14/700 white in a 24px black circle. Real words everywhere: realistic names, amounts, times and one edge case. Never lorem ipsum.

## Layout

- 8px base; 48px minimum targets with at least 8px between them.
- Top to bottom: How-might-we (full width) → persona card (one third) beside the need, in the persona's own words → concepts A/B/C in three equal columns → the chosen concept at full width with annotations in a right-hand margin of about 220px → "What we'd test" strip.
- Concept frames are 1.5px `primary` strokes; unchosen concepts use a dashed `wire` stroke and a one-line reason they were set aside.
- Annotations sit beside what they explain, joined by a numbered marker on the element (1, 2, 3…) matching the numbered sticky note.

## Elevation & Depth

Flat, like paper on a wall. The only depth is a sticky note: rotate each note between −2° and 2° and give it `box-shadow: 0 2px 0 rgb(0 0 0 / .12)`. Everything else has no shadow. Frames are strokes, not raised surfaces.

## Shapes

4px radius on frames and buttons, 2px on sticky notes, circles for callout markers, square placeholders with a diagonal cross (two 1px `wire` lines) where an image would go. 1.5px strokes for every wireframe outline, drawn in `primary`.

## Components

- **concept-frame**: a white frame with a 1.5px stroke holding one concept; the chosen one is solid, the others dashed.
- **persona-card**: name, age or context, one need, one quote in their words, one constraint (the extreme-user detail).
- **sticky-note**: yellow, handwritten, 180px wide, slightly rotated; begins with its callout number.
- **callout-marker**: 24px black circle with a white number, placed on the element being explained.
- **button-primary**: black, 48px high, 4px radius; the prototype's one flow runs through it.
- **test-strip**: grey band listing three questions for users and the riskiest assumption, labelled as such.
- **image-placeholder**: a grey box with a cross and a label of what goes there.

## Do's and Don'ts

- Do open with one line: "How might we … for <persona name> …?"
- Do invent a clearly fictional person with a name, a context and one need; show them on the entry. Mark them as fictional ("a composite, not a real person").
- Do show three deliberately different concepts before building one, and say in one sentence why you chose it.
- Do build one flow end to end that actually clicks, rather than many screens that do not.
- Do tie every design choice to the need with a numbered sticky note.
- Do end with a "What we'd test" strip: three questions and the riskiest assumption, labelled "riskiest assumption".
- Do include one extreme-user scenario (low vision, one hand, slow connection, first-time user) and design for it: 18px body, 48px targets, high contrast, plain language.
- Do keep motion to a minimum: instant state changes, at most a 150ms fade; honour `prefers-reduced-motion`.
- Do write warm, plain, jargon-free copy, the way a helpful person would say it.
- Don't polish: no brand colour, no gradients, no custom illustration, no shadows beyond the sticky notes.
- Don't use yellow for anything except annotations.
- Don't name anyone "User" or "John Doe", and don't use lorem ipsum.

## Never

- Polish before the concept is tested.
- A single option presented as the answer.
- A person called "User".
- Hidden assumptions; label every one.

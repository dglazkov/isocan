---
version: alpha
name: Inevitable — after Jony Ive & Apple
description: A calm, content-first system for one screen that feels machined from a single idea. Near-white ground, near-black ink, one tint for everything you can touch, hierarchy from size and weight, generous space instead of lines, and one primary action. An homage to the published principles of Jony Ive and Apple design (deference, clarity, depth), not Apple's Human Interface Guidelines and not affiliated with or endorsed by Jony Ive, LoveFrom or Apple.
colors:
  background: "#f5f5f7"
  surface: "#ffffff"
  primary: "#1d1d1f"
  secondary: "#6e6e73"
  separator: "#d2d2d7"
  accent: "#0071e3"
  on-accent: "#ffffff"
typography:
  large-title:
    fontFamily: "system-ui, Inter, sans-serif"
    fontSize: 34px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  title:
    fontFamily: "system-ui, Inter, sans-serif"
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.27
    letterSpacing: -0.01em
  headline:
    fontFamily: "system-ui, Inter, sans-serif"
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "system-ui, Inter, sans-serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.47
  caption:
    fontFamily: "system-ui, Inter, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.38
rounded:
  sm: 8px
  md: 12px
  lg: 20px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  xxl: 64px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.headline}"
    rounded: "{rounded.md}"
    padding: "14px 28px"
    height: 50px
  button-text:
    textColor: "{colors.accent}"
    typography: "{typography.headline}"
    padding: "14px 16px"
    height: 44px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  floating-bar:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.headline}"
    height: 52px
  list-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    padding: "11px 16px"
    height: 44px
  caption-text:
    textColor: "{colors.secondary}"
    typography: "{typography.caption}"
---

## Philosophy

- **Simplicity is order, not absence.** Removing clutter is a side effect; the work is bringing order to complexity so the result feels like it could not have been otherwise ([iOS 7 introduction, 2013, via TechRadar](https://www.techradar.com/pro/quote-of-the-day-by-former-apple-design-chief-jony-ive-true-simplicity-is-derived-from-so-much-more-than-just-the-absence-of-clutter-and-ornamentation-laying-the-foundation-for-a-timeless-design-philosophy)).
- **Deference, clarity, depth.** The interface helps people understand the content and never competes with it; layering carries hierarchy ([summary of the iOS 7 principles](https://uxdesign.cc/did-apple-abandoned-its-own-design-heuristics-accessibility-principles-2d616ed7ace5)). Apple restated this in 2025 as hierarchy, harmony and consistency ([WWDC25](https://developer.apple.com/videos/play/wwdc2025/356/)).
- **One object.** Hardware, software and material are designed together, and the care goes all the way down, even to a typeface ([Wallpaper* on LoveFrom Serif](https://www.wallpaper.com/design-interiors/corporate-design-branding/lovefrom-serif-a-modern-interpretation-of-baskerville-created-by-jony-ives-lovefrom)).

## Overview

Build one screen with one purpose you can say in a sentence. The content is the hero, set on a near-white ground with the text on whitespace beside it; chrome recedes. Everything you can tap is the same blue, and there is exactly one filled button. The values below are this pack's translation of those principles into CSS, not Apple's published specification; never bundle SF Pro (its licence limits it to Apple-platform mockups) — `system-ui` gives the platform face where it exists and Inter elsewhere.

## Colors

- `background` `#f5f5f7` is the ground; `surface` `#ffffff` is for grouped cards and list rows set on it.
- `primary` `#1d1d1f` is all text. `secondary` `#6e6e73` is for captions and supporting text only.
- `accent` `#0071e3` is the single tint for everything interactive: the primary button fill, text buttons, links, selected states, focus rings, toggles when on. Nothing non-interactive is ever blue.
- `separator` `#d2d2d7` exists for the rare hairline inside a list; prefer space.
- No second accent, no gradients on controls. Status that must be coloured uses a word first.

## Typography

One family: `system-ui, Inter, sans-serif`. Build hierarchy from size and weight, never from colour: large title 34/700 (one per screen), title 22/600, headline 17/600 (also the button label), body 17/400, caption 13/400. Tighten large sizes slightly (−0.02em at 34px). Sentence case everywhere. No all-caps labels, no italics for emphasis, no more than these five levels.

## Layout

- 8pt rhythm: every margin, gap and height is a multiple of 8 (4 allowed inside a control).
- Generous margins: at least 20px on narrow screens, 6–8vw on wide screens; a centred reading measure of about 640px for text.
- One primary action per screen, placed where the task ends (bottom of the content or trailing edge of the bar).
- Group related items into one inset card or list; separate groups with 32–40px of space, not lines.
- Imagery or the key content edge to edge; text sits on whitespace beside it, never on top of a busy image.

## Elevation & Depth

Depth is layering, used sparingly. Cards on the ground get either no shadow or one large, soft, low shadow: `0 10px 30px rgb(0 0 0 / .08)`. Translucency is reserved for bars that float over scrolling content: `background: rgb(245 245 247 / .72); backdrop-filter: blur(20px) saturate(180%)`. Nothing else is translucent and no two shadows compete.

## Shapes

Continuous-feeling radii, consistent everywhere: 8px for small controls, 12px for buttons and fields, 20px for cards and sheets. Nested shapes keep concentric corners (inner radius = outer radius − padding). Icons are monoline glyphs whose stroke matches the weight of the text beside them; no multicolour icons in chrome.

## Components

- **button-primary**: the one filled blue button, 50px high, 12px radius, white 17/600 label that is a plain verb ("Continue", "Done").
- **button-text**: every other action; blue text, no fill, 44px hit area.
- **card**: white, 20px radius, 24px padding, soft shadow or none.
- **floating-bar**: the only translucent surface, 52px, pinned over scrolling content.
- **list-row**: 44px minimum, 16px side insets, hairline only between rows inside one group.
- **caption-text**: 13px secondary text for supporting detail.

## Do's and Don'ts

- Do state the screen's purpose in one sentence in an HTML comment at the top, and cut anything that does not serve it.
- Do use `#0071e3` for every interactive element and for nothing else.
- Do have exactly one filled primary button per screen; everything else is a text button.
- Do build hierarchy with the five type levels (34/22/17/17/13) and weight, never with extra colours.
- Do make every hit area at least 44×44px.
- Do use the 8pt rhythm and separate with space; use a separator only inside a list.
- Do animate spring-like, 350–500ms, from the tapped origin (zoom out of the element that was pressed), e.g. `transition: transform 400ms cubic-bezier(.2,.8,.2,1)`; honour `prefers-reduced-motion`.
- Do write calm, short copy: plain verbs on buttons, no exclamation marks, no jargon.
- Don't put translucency, blur or glass on anything except a bar floating over content.
- Don't add borders around cards or dividers between sections.
- Don't use more than one shadow style, or any hard or coloured shadow.
- Don't use SF Pro, any Apple icon, or any Apple mark.

## Never

- Skeuomorphic texture: linen, leather, stitching, wood.
- A second accent colour, or a gradient on a button.
- Ten competing cards on one screen.
- The Apple logo, Apple product silhouettes, or Apple trade dress.

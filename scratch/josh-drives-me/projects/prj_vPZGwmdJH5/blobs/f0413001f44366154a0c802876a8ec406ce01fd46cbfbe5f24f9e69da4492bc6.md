---
version: "1.0"
name: "Kitt — Knight Rider dashboard"
description: "The look of the Josh Drives Me (Crazy?) canvas: a black dashboard at night, one red scanner light, amber instrument text, and a cool blue reserved for anything that happens after dark."
colors:
  background: "#0a0a0e"
  backgroundDeep: "#07070a"
  surface: "#101014"
  surfaceRaised: "#151519"
  panel: "#1c1c22"
  panelHigh: "#1f1f27"
  line: "#2a2a33"
  lineSoft: "#23232b"
  lineStrong: "#33333d"
  text: "#f2efe6"
  textSoft: "#e6e0d1"
  textPill: "#e8e2d3"
  muted: "#b9b3a6"
  dim: "#8d8778"
  faint: "#6f6a5f"
  scanner: "#ff2a2a"
  danger: "#ff3b3b"
  dangerBright: "#ff4b4b"
  dangerSoft: "#ff5a5a"
  dangerLight: "#ff6b6b"
  primary: "#ffcf5a"
  amber: "#ffcf5a"
  night: "#9fd3ff"
  nightDeep: "#7fbfff"
  nightLine: "#2b4f6b"
  nightBar: "#3d7bd6"
  bossDeep: "#3a0d12"
  bossDark: "#1c0a0d"
  chalk: "#e9e6f5"
  have: "#1f3d2a"
  haveLine: "#5bd18a"
typography:
  display:
    fontFamily: "Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "64px"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-1px"
  h1:
    fontFamily: "Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 1.02
  kicker:
    fontFamily: "ui-monospace, Menlo, monospace"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "3px"
  section:
    fontFamily: "ui-monospace, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "2.6px"
  body:
    fontFamily: "Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.3
  small:
    fontFamily: "ui-monospace, Menlo, monospace"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.5
rounded:
  card: "14px"
  panel: "16px"
  pill: "999px"
  bar: "9px"
spacing:
  cardPad: "34px 38px 30px"
  row: "6px"
  gap: "10px"
  block: "18px"
---

## Overview

A car dashboard at night. Everything sits on near-black; the only saturated things are the red scanner light (KITT's voice), amber instrument text for what matters, and a cool blue that means "this happens after dark". Fun comes from the game framing — levels, boss battles, an odometer — not from decoration.

## Colors

`background` is the ground of every card, deepened to `backgroundDeep` on posters. `surface` and `panel` are the two raised greys, separated by `line`. Red is reserved for danger and for the scanner bar: `danger` outlines a boss battle, `dangerLight` is Kitt speaking. `amber` is the instrument colour: level numbers, section headings, the road's centre line. `night` marks any session that counts toward the ten night hours, always with a 🌙. `have`/`haveLine` are only for "already mastered" in the skill tree.

## Typography

One sans for prose (`body`, `h1`, `display`), one monospace for instrument labels (`kicker`, `section`, `small`). Kickers and section heads are uppercase with wide tracking. Nothing under 13px on a card — cards are read as thumbnails first.

## Layout

Every card is a column: kicker, title, sub, sections, and a boss battle pinned to the bottom with `margin-top:auto`. Level cards are 640×1340, rule cards 720 wide. Lists are rows separated by a dashed `lineSoft`, each with a monospace index on the left.

## Elevation & Depth

Flat. Depth is a border (`line`) and a slightly lighter fill, never a drop shadow — the one glow on the canvas is the scanner bar.

## Shapes

`card` radius for boss boxes and tips, `panel` for gauges, `pill` for chips. The scanner bar is a full-width 8px strip at the top of every card.

## Components

- **Scanner**: 8px bar at the top, one red sweep animating left↔right. Every card has one.
- **Boss battle**: `bossDeep`→`bossDark` gradient, `danger` border, red monospace label, pinned at the bottom.
- **Pill**: `panelHigh` fill, `lineStrong` border; night pills use `night` text and `nightLine` border.
- **Tip**: `surfaceRaised` with a 4px `amber` left rule.
- **Odometer**: gauge rows with a `danger`→`amber` bar, blue for night hours.

## Do's and Don'ts

- Do keep one skill, one card, one boss.
- Do mark every night session with the 🌙 and the `night` colour, nowhere else.
- Don't add a second accent colour; if something needs emphasis it is amber, and if it is danger it is red.
- Don't use drop shadows, gradients on text, or a purple anything.

/**
 * Two synthetic design systems for the style tests — a warm brand and a dark
 * tool. Made up for these tests; the tokens are shaped like the
 * design-competition packs' (`colors`, `typography`, `rounded`, `spacing`,
 * `components` referring to them).
 */

export const ACME_WARM = `---
version: alpha
name: Acme Warm
description: A warm, bold system for Acme's ordering app — one magenta for action, fog and platinum grounds.
colors:
  background: "#efece4"
  platinum: "#d8d5ce"
  surface: "#f8f6f0"
  groove: "#c4bfb4"
  primary: "#1f1c18"
  secondary: "#5c564d"
  accent: "#d10a72"
  on-accent: "#ffffff"
typography:
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: 32px
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: 17px
rounded:
  sm: 6px
  md: 14px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
---

## Overview

Acme Warm, for tests.
`;

export const ACME_NIGHT = `---
version: alpha
name: Acme Night
description: A dense dark system for Acme's back office — one indigo accent.
colors:
  background: "#08090a"
  panel: "#0f1011"
  elevated: "#1c1d1f"
  hairline: "#23252a"
  primary: "#f7f8f8"
  secondary: "#8a8f98"
  accent: "#5e6ad2"
  on-accent: "#ffffff"
typography:
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 14px
  mono:
    fontFamily: "ui-monospace, monospace"
    fontSize: 12px
rounded:
  md: 6px
spacing:
  sm: 8px
  md: 16px
---

## Overview

Acme Night, for tests.
`;

/** What a well-read answerer would pick for each role, by system. */
export const PICKS: Record<string, Record<string, string>> = {
  "Acme Warm": {
    ground: "background", surface: "platinum", line: "groove", ink: "primary", "ink-muted": "secondary",
    bar: "platinum", primary: "accent", "on-primary": "on-accent", radius: "md", space: "sm",
  },
  "Acme Night": {
    ground: "background", surface: "elevated", line: "hairline", ink: "primary", "ink-muted": "secondary",
    bar: "elevated", primary: "accent", "on-primary": "on-accent", font: "body", space: "sm",
  },
};

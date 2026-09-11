import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { css, rules, selectorsOf } from "./cssrules.ts";

/**
 * **A menu carries its own ground, so a hovered row looks the same wherever
 * it opens.**
 *
 * Reported by Dion on 8 Sep 2026, with a screenshot of `Background ▸` open:
 * *"when I mouse over the submenu it doesn't show the same hover color as the
 * main menu so it's hard to see"*. The two halves of one menu really were
 * different colours, and neither half was a bug on its own.
 *
 * `--panel` is `rgba(255, 255, 255, 0.92)`. What it RENDERS depends on what is
 * behind it, and a right-click menu is the one piece of chrome that can open
 * over anything: his main menu sat over the chat panel and rendered ~#fdfdfc,
 * while the submenu hung 4px past its right edge over a Space Galaxy ground
 * and rendered ~#ebebeb. `--chip-hover` is opaque, chosen against the first.
 * On the second it is a contrast ratio of 1.02 — not a faint highlight, no
 * highlight.
 *
 * ## Why the guard is not "the submenu must match the menu"
 *
 * That is the symptom, and a guard written to it would pass the moment both
 * halves happened to sit over the same thing. It was never about the submenu:
 * the same menu opened over a photograph in the dark theme puts `--panel` at
 * ~#2c2f34 and `--chip-hover` at #2f343d, the identical collision mirrored.
 * The invariant is that **the menu's ground is its own**, and the hover on it
 * reads as strongly as the hover on every other row in the app — which is
 * `--card`, where `.btn` and `.share-link-row` sit.
 *
 * The last case is the negative control, and it is deliberately written to
 * expire: it asserts that a borrowed ground really does cancel the hover out,
 * which is the whole reason for the first two. Change the tokens far enough
 * that it no longer would, and this fails to tell you the argument is stale
 * rather than the code.
 */

const LIGHT = /:root,\s*:root\[data-theme="light"\]\s*\{(.*?)\n\}/s;
const DARK = /:root\[data-theme="dark"\]\s*\{(.*?)\n\}/s;

type Rgb = [number, number, number];

function token(scope: RegExp, name: string): string {
  const block = scope.exec(css);
  expect(block, `no :root block matched ${scope}`).toBeTruthy();
  const value = new RegExp(`--${name}:\\s*([^;]+);`).exec(block![1]!);
  expect(value, `--${name} is not declared there`).toBeTruthy();
  return value![1]!.trim();
}

/** A hex or `rgba(…)` as channels and an alpha. */
function parse(value: string): { rgb: Rgb; alpha: number } {
  const fn = /rgba?\(([^)]+)\)/.exec(value);
  if (fn) {
    const parts = fn[1]!.split(",").map((p) => Number(p.trim()));
    return { rgb: [parts[0]!, parts[1]!, parts[2]!], alpha: parts[3] ?? 1 };
  }
  const hex = value.replace("#", "");
  return { rgb: [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb, alpha: 1 };
}

/** What the eye sees when `top` is painted over an opaque `ground`. */
function over(top: string, ground: string): Rgb {
  const { rgb, alpha } = parse(top);
  const back = parse(ground).rgb;
  return rgb.map((v, i) => v * alpha + back[i]! * (1 - alpha)) as Rgb;
}

function luminance(rgb: Rgb): number {
  return rgb
    .map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, c, i) => sum + [0.2126, 0.7152, 0.0722][i]! * c, 0);
}

function ratio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** The `background` the menu declares, as written. */
function menuBackground(): string {
  const rule = rules().find((r) => selectorsOf(r).includes(".context-menu"));
  expect(rule, ".context-menu must have a rule").toBeTruthy();
  const declared = /background:\s*([^;]+);/.exec(rule!.body);
  expect(declared, ".context-menu must set its own background").toBeTruthy();
  return declared![1]!.trim();
}

/** Both spellings of the menu: the panel and the children that hang off it
 *  wear one class, so one ground covers both. */
const MENU_CLASS = "context-menu";

describe("the right-click menu paints its own ground", () => {
  it("ends its background in an opaque colour", () => {
    /* The bottom layer is what decides whether anything behind the menu can
       reach the eye. A translucent one hands the answer to the canvas. */
    const base = /var\(--([a-z-]+)\)\s*$/.exec(menuBackground());
    expect(base, `the menu's background must end in an opaque token: ${menuBackground()}`).toBeTruthy();
    for (const [theme, scope] of [["light", LIGHT], ["dark", DARK]] as const) {
      const value = token(scope, base![1]!);
      expect(parse(value).alpha, `--${base![1]} is translucent in ${theme}: ${value}`).toBe(1);
    }
  });

  it("hangs its children off the same class, so one ground covers both", () => {
    /* The reported bug was a submenu that looked different from its parent.
       It cannot be, while both are this class — and if a future submenu grows
       a ground of its own, that is the drift to catch here rather than in a
       screenshot. */
    const sub = rules().find((r) => selectorsOf(r).includes(".context-submenu"));
    expect(sub, ".context-submenu must have a rule").toBeTruthy();
    expect(sub!.body, ".context-submenu must not paint a second ground").not.toMatch(/background/);
    const component = readFileSync(
      fileURLToPath(new URL("../src/components/ContextMenu.tsx", import.meta.url)),
      "utf8",
    );
    expect(component, "the submenu must wear the menu's own class").toContain(
      `${MENU_CLASS} context-submenu`,
    );
  });

  it("shows a hovered row as clearly as every other row in the app", () => {
    for (const [theme, scope] of [["light", LIGHT], ["dark", DARK]] as const) {
      const card = token(scope, "card");
      const hover = parse(token(scope, "chip-hover")).rgb;
      /* Where a hover is read everywhere else: `.btn`, `.share-link-row`. */
      const elsewhere = ratio(hover, parse(card).rgb);
      const onMenu = ratio(hover, over(token(scope, "panel"), card));
      expect(onMenu, `${theme}: a menu row's hover must read like a button's`).toBeGreaterThanOrEqual(
        elsewhere * 0.98,
      );
    }
  });

  it("is the thing that was wrong: a borrowed ground cancels the hover out", () => {
    /* The worst ground each theme can be opened over — a black starfield under
       the light theme, a white photograph under the dark one. Both are grounds
       a person can actually set, which is why this was reported rather than
       theorised. */
    for (const [theme, scope, worst] of [
      ["light", LIGHT, "#000000"],
      ["dark", DARK, "#ffffff"],
    ] as const) {
      const hover = parse(token(scope, "chip-hover")).rgb;
      const borrowed = over(token(scope, "panel"), worst);
      expect(ratio(hover, borrowed), `${theme}: the hover would still have been visible`).toBeLessThan(1.1);
    }
  });
});

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

/** The `background` a hovered menu row declares. */
function menuHoverBackground(): string {
  const rule = rules().find((r) => selectorsOf(r).includes(".context-item:hover:enabled"));
  expect(rule, ".context-item:hover:enabled must have a rule").toBeTruthy();
  const declared = /background:\s*([^;]+);/.exec(rule!.body);
  expect(declared, ".context-item:hover:enabled must set its background").toBeTruthy();
  return declared![1]!.trim();
}

/** First `rgba(...)` stop in a `--glass` gradient token. */
function glassStop(scope: RegExp): string {
  const raw = token(scope, "glass");
  const stop = /rgba\([^)]+\)/.exec(raw);
  expect(stop, `--glass must contain an rgba() stop: ${raw}`).toBeTruthy();
  return stop![0]!;
}

function rgbToHex(rgb: Rgb): string {
  return `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Both spellings of the menu: the panel and the children that hang off it
 *  wear one class, so one ground covers both. */
const MENU_CLASS = "context-menu";

describe("the right-click menu wears glass with a translucent hover", () => {
  it("uses the shared --glass surface and --glass-chip-hover row highlight", () => {
    expect(menuBackground()).toBe("var(--glass)");
    expect(menuHoverBackground()).toBe("var(--glass-chip-hover)");
    for (const [theme, scope] of [["light", LIGHT], ["dark", DARK]] as const) {
      const hoverVal = token(scope, "glass-chip-hover");
      expect(
        parse(hoverVal).alpha,
        `--glass-chip-hover must stay translucent in ${theme}: ${hoverVal}`,
      ).toBeLessThan(0.5);
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

  it("keeps hovered rows visible over both white and black canvas grounds", () => {
    for (const [theme, scope] of [["light", LIGHT], ["dark", DARK]] as const) {
      const glass = glassStop(scope);
      const hover = token(scope, "glass-chip-hover");
      for (const ground of ["#ffffff", "#000000"] as const) {
        const menuRgb = over(glass, ground);
        const hoveredRgb = over(hover, rgbToHex(menuRgb));
        expect(
          ratio(hoveredRgb, menuRgb),
          `${theme} over ${ground}: hover must stay clearly visible`,
        ).toBeGreaterThanOrEqual(1.12);
      }
    }
  });

  it("is the thing that was wrong: an opaque hover cancels out on a borrowed ground", () => {
    /* The negative control: pairing a translucent menu ground with opaque
       `--chip-hover` cancels the highlight out when the canvas behind it is
       dark in light mode or bright in dark mode. */
    for (const [theme, scope, worst] of [
      ["light", LIGHT, "#000000"],
      ["dark", DARK, "#ffffff"],
    ] as const) {
      const hover = parse(token(scope, "chip-hover")).rgb;
      const borrowed = over(token(scope, "panel"), worst);
      expect(ratio(hover, borrowed), `${theme}: the opaque hover would still have cancelled out`).toBeLessThan(1.1);
    }
  });
});

describe("a submenu can escape the menu it hangs off", () => {
  it("keeps containing-block properties off the menu box, so a fixed child is placed in the viewport", () => {
    /* 19 Oct 2026: Background ▸ and Groups ▸ stopped opening. The submenu is a
       `position: fixed` panel placed in viewport coordinates, and any of these
       on an ancestor makes THAT ancestor its containing block — the glass
       unification put `backdrop-filter` on `.context-menu`, so the child landed
       ~1000px right of the menu's own box and was clipped by its scroll. The
       frost lives on `.context-menu::before`, where it contains nothing. */
    const boxes = rules().filter((r) =>
      selectorsOf(r).some((s) => s === ".context-menu" || s === ".context-submenu"),
    );
    expect(boxes.length, ".context-menu must have a rule").toBeGreaterThan(0);
    for (const rule of boxes) {
      expect(rule.body).not.toMatch(/(^|[;\s{])(-webkit-)?(backdrop-filter|filter|transform|perspective|contain|will-change|container-type)\s*:/);
    }
    const layer = rules().find((r) => selectorsOf(r).includes(".context-menu::before"));
    expect(layer, "the frost must still be drawn, on a layer").toBeTruthy();
    expect(layer!.body).toMatch(/backdrop-filter:\s*var\(--glass-filter\)/);
  });
});

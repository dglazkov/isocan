import { describe, expect, it } from "vitest";
import {
  BRIGHTEST_PICTURE,
  type CanvasTheme,
  CONTRAST_BODY,
  CONTRAST_UI,
  GROUND_INK,
  GROUND_INK_FLOOR,
  GROUND_MEAN,
  GROUND_TEXT_SHADES,
  type GroundInkRole,
  type GroundTone,
  THEMES,
  TEXT_COLOURS,
  TEXT_COLOUR_SHADES,
  TEXT_SURFACES,
  bestInk,
  contrastRatio,
  groundColour,
  groundPatch,
  spokenColour,
  themePatch,
  toneOfGround,
} from "@isocan/core";

import { groundToken } from "../src/lib/groundtoken.ts";
import { css, rules, selectorsOf, sheets } from "./cssrules.ts";
import { appInkOnGround } from "./groundtext.ts";

/**
 * **Every ink on the ground, measured on every ground** (smart contrast,
 * design §6) — the forcing function.
 *
 * Chrome drawn straight onto the canvas took its ink from the app's theme,
 * and a canvas's ground does not follow the app's theme: the dark app's
 * muted name measured 3.07 on Ocean and 2.70 on the brightest picture, and a
 * chromeless note's words 1.19 on Snow. Core's `toneOfGround` now decides
 * which ink family a ground takes, by the ink sets themselves; this file is
 * what makes that decision hold for every ground the build can draw. A new
 * ground cannot ship without a mean in core that matches its stylesheet
 * token, a tone, and every ground-ink token passing on it.
 *
 * Modelled on `textcolour.test.ts` (shades held at 4.5:1 per surface) and
 * `groundtoken.test.ts` (a row for every ground). Since phase 2 it measures
 * the stylesheet's tier itself — the values a browser paints — and holds them
 * equal to core's `GROUND_INK`, so neither copy can move alone; and "the
 * inventory holds": everything in `groundtext.ts` paints with the tier, not
 * with the app's tokens.
 */

const canvasOn = (theme: CanvasTheme) => ({
  properties: themePatch(theme).properties as Record<string, string>,
});
const picture = { properties: groundPatch("a".repeat(64)).properties as Record<string, string> };

/**
 * The grounds no ink family reads on, each with why that is acceptable.
 * Adding a ground here is a decision, so it carries its reason; a ground that
 * lands in `mid` without one fails below.
 */
const MID: Partial<Record<CanvasTheme, string>> = {
  desert:
    "white 4.11, the light ink 3.70: neither family holds on #ab703b. Decided 19 Oct 2026 " +
    "(design.md, end): chrome stands on a glass plate; text nodes take the higher ink plus a halo.",
};

/** Every ground the guard measures: the seeded ones, the dot grid in both app
 *  themes, and a picture at its brightest. */
const GROUNDS: { name: string; colour: string; tone: GroundTone }[] = [
  ...THEMES.map((t) => ({ name: t, colour: groundColour(canvasOn(t), "light"), tone: toneOfGround(canvasOn(t), "light") })),
  { name: "dot grid (light app)", colour: groundColour({}, "light"), tone: toneOfGround({}, "light") },
  { name: "dot grid (dark app)", colour: groundColour({}, "dark"), tone: toneOfGround({}, "dark") },
  { name: "picture (brightest)", colour: groundColour(picture, "light"), tone: toneOfGround(picture, "light") },
];

describe("the tone of every ground", () => {
  it("takes the tone the design measured", () => {
    expect(Object.fromEntries(GROUNDS.map((g) => [g.name, g.tone]))).toEqual({
      galaxy: "dark",
      ocean: "dark",
      mountains: "dark",
      farm: "dark",
      desert: "mid",
      meadow: "dark",
      night: "dark",
      snow: "light",
      aurora: "dark",
      pond: "dark",
      zen: "light",
      "dot grid (light app)": "light",
      "dot grid (dark app)": "dark",
      "picture (brightest)": "dark",
    });
  });

  it("lets no seeded ground be mid without a reason", () => {
    const unexplained = GROUNDS.filter((g) => g.tone === "mid" && !MID[g.name as CanvasTheme]).map((g) => g.name);
    expect(unexplained, "a ground no ink reads on — give it a reason in MID, or a mean an ink can read").toEqual([]);
    // …and no reason outlives the ground it was for.
    const stale = Object.keys(MID).filter((t) => toneOfGround(canvasOn(t as CanvasTheme), "light") !== "mid");
    expect(stale, "these are no longer mid — delete their reason").toEqual([]);
  });

  it("measures the dot grid and the picture where core says they are", () => {
    expect(groundColour({}, "light")).toBe(TEXT_SURFACES.light.ground);
    expect(groundColour({}, "dark")).toBe(TEXT_SURFACES.dark.ground);
    expect(groundColour(picture, "light")).toBe(BRIGHTEST_PICTURE);
  });
});

/** The tier's five tokens and the role in core's `GROUND_INK` each one
 *  carries. Two accents because today they are two tokens — the accent as
 *  words (`--accent-text`) and as a line (`--accent`) — and a ground of its
 *  own makes them one colour. The ring is a line: `CONTRAST_UI`. */
const TIER: { token: string; role: GroundInkRole; app: string; floor: number }[] = [
  { token: "--ground-ink", role: "ink", app: "--ink", floor: GROUND_INK_FLOOR.ink },
  { token: "--ground-ink-muted", role: "muted", app: "--ink-muted", floor: GROUND_INK_FLOOR.muted },
  { token: "--ground-ink-soft", role: "soft", app: "--ink-soft", floor: GROUND_INK_FLOOR.soft },
  { token: "--ground-accent", role: "accent", app: "--accent-text", floor: GROUND_INK_FLOOR.accent },
  { token: "--ground-ring", role: "accent", app: "--accent", floor: CONTRAST_UI },
];

/** The declarations of the one top-level rule whose selector is exactly
 *  `selector` — and, where several share it (`:root`), that holds `holding`. */
function declarations(selector: string, holding = ""): Record<string, string> {
  const found = rules(css).filter((r) => r.selector === selector && r.at.length === 0 && r.body.includes(holding));
  expect(found.length, `exactly one top-level ${selector} rule`).toBe(1);
  return Object.fromEntries(
    found[0]!.body.split(";").map((d) => d.split(/:(.*)/s).map((x) => x.trim())).filter(([k, v]) => k && v),
  );
}
/** A token from the theme blocks, which must say the same thing in both:
 *  the ground's sets do not follow the app's theme. */
function themeToken(name: string): string {
  const read = (block: RegExp) => new RegExp(`${name}:\\s*(#[0-9a-f]{6})\\s*;`).exec(block.exec(css)?.[1] ?? "")?.[1];
  const light = read(/:root,\s*:root\[data-theme="light"\]\s*\{(.*?)\n\}/s);
  const dark = read(/:root\[data-theme="dark"\]\s*\{(.*?)\n\}/s);
  expect(light, `${name} in the light block`).toBeTruthy();
  expect(dark, `${name} in the dark block`).toBe(light);
  return light!;
}
/** `var(--x)` resolved through the theme blocks; anything else as written. */
const resolved = (value: string) => {
  const name = /^var\((--[a-z-]+)\)$/.exec(value)?.[1];
  return name ? themeToken(name) : value;
};
/** A tone's tier, each token resolved to the colour a browser paints. */
const toneRule = (tone: "dark" | "light") =>
  Object.fromEntries(
    Object.entries(declarations(`.canvas-page[data-ground-tone="${tone}"]`)).map(([k, v]) => [k, resolved(v)]),
  );

describe("the ground tier", () => {
  it("is the app's own tokens with no ground, so the dot grid is unchanged", () => {
    const defaults = declarations(":root", "--ground-ink:");
    for (const t of TIER) expect(defaults[t.token], t.token).toBe(`var(${t.app})`);
  });

  it("is core's GROUND_INK under each tone, token for token", () => {
    for (const tone of ["dark", "light"] as const) {
      const rule = toneRule(tone);
      for (const t of TIER) expect(rule[t.token], `${tone} ${t.token}`).toBe(GROUND_INK[tone][t.role]);
    }
  });

  it("on mid, puts chrome on the app's full ink and the ring on core's best accent", () => {
    const mid = declarations('.canvas-page[data-ground-tone="mid"]');
    expect(mid["--ground-ink-muted"]).toBe("var(--ink)");
    expect(mid["--ground-ink-soft"]).toBe("var(--ink)");
    expect(mid["--ground-ring"]).toBe("var(--ground-mid-ring, var(--accent))");
  });

  it("is registered as colours, so a change of ground crossfades, and not under reduced motion", () => {
    for (const t of TIER) {
      /* By regex: `rules()` reads an at-rule as a scope, and `@property`'s
         block holds descriptors, not rules. */
      const reg = new RegExp(`@property ${t.token} \\{([^}]*)\\}`).exec(css)?.[1];
      expect(reg, `@property ${t.token}`).toBeTruthy();
      expect(reg!).toMatch(/syntax:\s*"<color>"/);
      expect(reg!).toMatch(/inherits:\s*true/);
    }
    const moving = rules(css).filter((r) => r.selector === ".canvas-page" && /transition:/.test(r.body) && r.at.length === 0);
    expect(moving.length).toBe(1);
    for (const t of TIER) expect(moving[0]!.body).toMatch(new RegExp(`${t.token} 0\\.2s`));
    const still = rules(css).find((r) => r.selector === ".canvas-page" && r.at.some((a) => /prefers-reduced-motion:\s*reduce/.test(a)));
    expect(still?.body ?? "").toMatch(/transition:\s*none/);
  });
});

describe("every ground-ink token reads on every ground of its tone", () => {
  for (const g of GROUNDS) {
    if (g.tone === "mid") continue; // the plate's ink is the app's, measured on glass
    it(`${g.name} (${g.colour}, ${g.tone})`, () => {
      /* The stylesheet's values, not core's: core decides the tone by its own
         set, so measuring that set again could never fail. The tier is what
         a browser paints, and the case above holds it to core. */
      const rule = toneRule(g.tone as "dark" | "light");
      const short = TIER.map((t) => ({ ...t, ink: rule[t.token]!, ratio: contrastRatio(rule[t.token]!, g.colour) ?? 0 }))
        .filter((m) => m.ratio < m.floor)
        .map((m) => `${m.token} ${m.ink} is ${m.ratio}:1, needs ${m.floor}`);
      expect(short).toEqual([]);
    });
  }
});

describe("the inventory holds", () => {
  it("paints everything on the ground with the tier, never the app's inks", () => {
    const found = sheets.flatMap((s) => appInkOnGround(rules(s.text)).map((hit) => `${s.file}: ${hit}`));
    expect(
      found,
      "these stand on the ground and name an app ink — use --ground-ink, -muted, -soft, --ground-accent or --ground-ring",
    ).toEqual([]);
  });

  it("would have caught the rules it moved", () => {
    expect(appInkOnGround(rules(".item-titlebar { color: var(--ink-muted); }"))).toHaveLength(1);
    expect(appInkOnGround(rules(".item.selected { outline: 2px solid var(--accent); z-index: 1; }"))).toHaveLength(1);
    expect(appInkOnGround(rules(".file-mark { border: 1px solid var(--ink-soft); }"))).toHaveLength(1);
    // A state with an opaque fill of its own has left the ground.
    expect(appInkOnGround(rules(".item-open-source:hover { background: var(--chip); color: var(--ink); }"))).toEqual([]);
    // A card inside a selected item is not the ring.
    expect(appInkOnGround(rules(".item.selected .item-content { color: var(--ink); }"))).toEqual([]);
  });
});

/**
 * **Named colours on a chromeless note.** On a dark ground a note takes
 * core's `GROUND_TEXT_SHADES` (the dark theme's shades, red lifted), on a
 * light ground the paper shades. Measured before this was built: no hue
 * reaches 4.5 on Zen (the paper shades are 3.30–3.37) or on Ocean and the
 * brightest picture (the dark shades 2.10–4.49), and lifting red that far
 * turns it pink, which `spokenColour` rightly refuses. So a named colour on a
 * seeded ground is held at 3:1 — WCAG's floor for large text, which a note
 * mostly is. The dot grid keeps the app's own shades, at 4.5, exactly as
 * before (`core/test/textcolour.test.ts`).
 */
describe("named colours on a chromeless note follow the ground", () => {
  const dark = declarations('.canvas-page[data-ground-tone="dark"] .item.textnode:not(.paper)');
  const light = declarations('.canvas-page[data-ground-tone="light"] .item.textnode:not(.paper)');

  /**
   * The one hue that cannot clear 3:1 everywhere and still be itself. Brown
   * on Ocean measures 2.39 and on the brightest picture 2.10; a brown light
   * enough for 3:1 there is ochre (`#cb8f00` was tried), and `spokenColour`
   * calls an orange hue brown only below 0.4 lightness — so "the brown one"
   * would be a colour nobody calls brown. Kept as the app's dark brown,
   * excused on those two grounds only; decided 19 Oct 2026 by the conductor.
   */
  const EXCUSED: Record<string, string[]> = { brown: ["ocean", "picture (brightest)"] };

  it("re-declares every hue: core's ground shades on dark, the paper shades on light", () => {
    for (const c of TEXT_COLOURS) {
      expect(resolved(dark[`--text-${c}`]!), `dark ${c}`).toBe(GROUND_TEXT_SHADES[c]);
      expect(light[`--text-${c}`], `light ${c}`).toBe(`var(--paper-text-${c})`);
    }
  });

  it("differs from the app's dark shades only where a lift was needed, and keeps each name", () => {
    const lifted = TEXT_COLOURS.filter((c) => GROUND_TEXT_SHADES[c] !== TEXT_COLOUR_SHADES[c].dark);
    expect(lifted).toEqual(["red"]);
    for (const c of TEXT_COLOURS) expect(spokenColour(GROUND_TEXT_SHADES[c]), c).toBe(c);
  });

  it("clears 3:1 on every seeded ground and the brightest picture, brown excused where it cannot", () => {
    const short: string[] = [];
    const excusedSeen: string[] = [];
    for (const g of GROUNDS) {
      if (g.tone === "mid" || g.name.startsWith("dot grid")) continue;
      for (const c of TEXT_COLOURS) {
        const shade = g.tone === "dark" ? GROUND_TEXT_SHADES[c] : TEXT_COLOUR_SHADES[c].paper;
        const r = contrastRatio(shade, g.colour) ?? 0;
        if (r >= CONTRAST_UI) continue;
        if (EXCUSED[c]?.includes(g.name)) excusedSeen.push(`${c} on ${g.name}`);
        else short.push(`${c} ${shade} on ${g.name} is ${r}:1`);
      }
    }
    expect(short).toEqual([]);
    // An excuse that no longer fails is stale: delete it.
    expect(excusedSeen.sort()).toEqual(Object.entries(EXCUSED).flatMap(([c, gs]) => gs.map((g) => `${c} on ${g}`)).sort());
  });

  it("leaves the dot grid's shades as they were, at 4.5 in both themes", () => {
    for (const c of TEXT_COLOURS) {
      expect(contrastRatio(TEXT_COLOUR_SHADES[c].light, TEXT_SURFACES.light.ground)!).toBeGreaterThanOrEqual(CONTRAST_BODY);
      expect(contrastRatio(TEXT_COLOUR_SHADES[c].dark, TEXT_SURFACES.dark.ground)!).toBeGreaterThanOrEqual(CONTRAST_BODY);
    }
  });
});

describe("core's ground means are the stylesheet's", () => {
  /** A token's value inside one theme block. Both blocks declare the
   *  `--theme-*` means, because a ground is the same picture in either app
   *  theme; both are read, so neither can drift. */
  const BLOCKS = {
    light: /:root,\s*:root\[data-theme="light"\]\s*\{(.*?)\n\}/s,
    dark: /:root\[data-theme="dark"\]\s*\{(.*?)\n\}/s,
  };
  for (const [app, block] of Object.entries(BLOCKS)) {
    it(`GROUND_MEAN equals the --theme-* values in the ${app} block`, () => {
      const scope = block.exec(css)?.[1];
      expect(scope, `no ${app} :root block`).toBeTruthy();
      for (const theme of THEMES) {
        /* The token comes from `groundToken`, the same table the top fade
           paints with, so core, the fade and the ground name one colour. */
        const token = groundToken(canvasOn(theme))!;
        const value = new RegExp(`${token}:\\s*(#[0-9a-f]{6})\\s*;`, "i").exec(scope!)?.[1];
        expect(value, `${token} is not declared in the ${app} block`).toBeTruthy();
        expect(GROUND_MEAN[theme], `${theme}: core says ${GROUND_MEAN[theme]}, ${token} says ${value}`).toBe(value!.toLowerCase());
      }
    });
  }
});

/**
 * **Mid: the plate** (phase 3, design §3). A ground no ink family holds puts
 * its chrome on a pill of the menus' glass, with the app's ink on it. The
 * glass is translucent, so it is measured composited over the ground at both
 * ends of its gradient: that is where the muted ink failed (3.70 light, 3.83
 * dark on Desert) and why the plate's ink is the full `--ink`.
 */
describe("a mid ground puts its chrome on a plate", () => {
  const PLATED = [
    ".item-titlebar .chrome-left::before",
    ".note-of::before",
    ".item.canvas-group .area-title",
    ".stack-band",
    ".group-column-label",
    ".group-row-label",
  ];
  const MIDS = GROUNDS.filter((g) => g.tone === "mid");

  it("has a mid ground to measure — or this block proves nothing", () => {
    expect(MIDS.map((g) => g.name)).toEqual(["desert"]);
  });

  it("plates every piece of chrome on the menus' glass", () => {
    const plated = rules(css).filter((r) => r.at.length === 0 && r.selector.includes('[data-ground-tone="mid"]') && /background:\s*var\(--glass\)/.test(r.body) && /backdrop-filter:\s*var\(--glass-filter\)/.test(r.body));
    const covered = plated.flatMap((r) => selectorsOf(r));
    for (const sel of PLATED) expect(covered, sel).toContain(`.canvas-page[data-ground-tone="mid"] ${sel}`);
  });

  /** `--glass`'s two stops in one theme block, as [r, g, b, alpha]. */
  const glassStops = (theme: "light" | "dark") => {
    const block = (theme === "light" ? /:root,\s*:root\[data-theme="light"\]\s*\{(.*?)\n\}/s : /:root\[data-theme="dark"\]\s*\{(.*?)\n\}/s).exec(css)![1]!;
    const glass = /--glass:\s*([^;]+);/.exec(block)![1]!;
    return [...glass.matchAll(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g)].map((m) => m.slice(1, 5).map(Number));
  };
  const appInk = (theme: "light" | "dark", name: string) =>
    new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`).exec(
      (theme === "light" ? /:root,\s*:root\[data-theme="light"\]\s*\{(.*?)\n\}/s : /:root\[data-theme="dark"\]\s*\{(.*?)\n\}/s).exec(css)![1]!,
    )![1]!;
  const over = (stop: number[], ground: string) => {
    const g = [1, 3, 5].map((i) => parseInt(ground.slice(i, i + 2), 16));
    return `#${g.map((v, i) => Math.round(stop[i]! * stop[3]! + v * (1 - stop[3]!)).toString(16).padStart(2, "0")).join("")}`;
  };

  it("reads at 4.5 on the plate in both themes: the full ink, and the selected name's accent", () => {
    const short: string[] = [];
    for (const g of MIDS) {
      for (const theme of ["light", "dark"] as const) {
        const stops = glassStops(theme);
        expect(stops.length, `${theme} --glass stops`).toBe(2);
        for (const stop of stops) {
          const plate = over(stop, g.colour);
          for (const name of ["ink", "accent-text"]) {
            const r = contrastRatio(appInk(theme, name), plate) ?? 0;
            if (r < CONTRAST_BODY) short.push(`${theme} --${name} on the plate ${plate} over ${g.name} is ${r}:1`);
          }
          // The kind icon and the marks: non-text, 3:1.
          const soft = contrastRatio(appInk(theme, "ink"), plate) ?? 0;
          if (soft < CONTRAST_UI) short.push(`${theme} icon ink on ${plate} is ${soft}:1`);
        }
      }
    }
    expect(short).toEqual([]);
  });

  /**
   * Where no plate goes: a chromeless note's words and the ring. Recorded,
   * not only bounded, so a change to Desert or to the sets shows up as a
   * number moving: black words at 5.11 (white would be 4.11; WCAG's 3:1
   * large-text floor is what is held), a ring of `#182889` at 3.
   */
  const MEASURED: Record<string, { words: string; ratio: number; ring: string; ringRatio: number }> = {
    desert: { words: "#000000", ratio: 5.11, ring: "#182889", ringRatio: 3 },
  };

  it("gives a note's words and the ring core's best ink, at their floors", () => {
    for (const g of MIDS) {
      const words = bestInk(g.colour, "ink");
      const ring = bestInk(g.colour, "accent", CONTRAST_UI);
      const got = { words, ratio: contrastRatio(words, g.colour)!, ring, ringRatio: contrastRatio(ring, g.colour)! };
      expect(got, g.name).toEqual(MEASURED[g.name]);
      expect(got.ratio).toBeGreaterThanOrEqual(CONTRAST_UI);
      expect(got.ringRatio).toBeGreaterThanOrEqual(CONTRAST_UI);
    }
  });

  it("draws those words with a halo, and no card behind them", () => {
    const words = rules(css).find((r) => r.selector.includes('[data-ground-tone="mid"] .item.textnode:not(.paper) .md-view'));
    expect(words?.body).toMatch(/color:\s*var\(--text-ink, var\(--ground-mid-ink/);
    // A glow, not a hairline: Desert's dark streaks swallowed a lone 1px halo.
    const shadow = /text-shadow:([^;]*)/.exec(words?.body ?? "")?.[1] ?? "";
    expect(shadow.match(/var\(--ground-mid-halo/g)?.length ?? 0, "halo layers").toBeGreaterThanOrEqual(3);
    expect(shadow).toMatch(/0 0 4px/);
    expect(words?.body).not.toMatch(/background/);
  });
});


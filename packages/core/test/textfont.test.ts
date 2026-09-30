import { describe, expect, it } from "vitest";
import type { Item } from "../src/model.ts";
import {
  TEXT_FACE_STACK,
  TEXT_FONTS,
  TEXT_FONT_PROP,
  TEXT_STYLE_SIZE,
  textBox,
  textDrawSize,
  textFaceOf,
  textFontFrom,
  textFontOf,
  textNodeFit,
  textNodeRefit,
  textStackOf,
  type TextFont,
  type TextStyle,
} from "../src/textnode.ts";

const actor = { id: "usr_a", name: "A" };
const node = (properties: Record<string, string>, box = { width: 100, height: 40 }): Item => ({
  id: "itm_1",
  x: 0,
  y: 0,
  ...box,
  title: "t",
  description: "",
  properties: { kind: "text", ...properties },
  versions: [],
  currentVersionId: "",
  createdAt: "",
  createdBy: actor,
  updatedAt: "",
  updatedBy: actor,
});

describe("a font names a family and keeps its face", () => {
  it("reads a name in any case, and refuses one that is not on the list", () => {
    expect(textFontFrom("fraunces")?.name).toBe("Fraunces");
    expect(textFontFrom("  JETBRAINS mono ")?.name).toBe("JetBrains Mono");
    expect(textFontFrom("Comic Sans MS")).toBeNull();
    expect(textFontFrom("")).toBeNull();
  });

  it("is between eight and twelve families, every one with a face and a width no smaller than its face", () => {
    expect(TEXT_FONTS.length).toBeGreaterThanOrEqual(8);
    expect(TEXT_FONTS.length).toBeLessThanOrEqual(12);
    expect(new Set(TEXT_FONTS.map((f) => f.name)).size).toBe(TEXT_FONTS.length);
    for (const f of TEXT_FONTS) {
      expect(TEXT_FACE_STACK[f.face], f.name).toBeTruthy();
      // The fallback is the face itself, so a factor under 1 would promise a
      // box narrower than the words drawn in the fallback.
      expect(f.width, f.name).toBeGreaterThanOrEqual(1);
    }
  });

  it("decides the face, so the fallback and the estimate agree with the family", () => {
    // The stored face says sans; the font is a serif. The font wins, because
    // the letters on screen are Fraunces or, failing that, Georgia.
    const item = node({ textFace: "sans", [TEXT_FONT_PROP]: "Fraunces" });
    expect(textFontOf(item)?.name).toBe("Fraunces");
    expect(textFaceOf(item)).toBe("serif");
    expect(textStackOf(item)).toBe(`"Fraunces", ${TEXT_FACE_STACK.serif}`);
  });

  it("falls back to the plain face for a family that is not on the list", () => {
    const item = node({ textFace: "mono", [TEXT_FONT_PROP]: "Papyrus" });
    expect(textFontOf(item)).toBeNull();
    expect(textFaceOf(item)).toBe("mono");
    expect(textStackOf(item)).toBe(TEXT_FACE_STACK.mono);
  });

  it("draws at the ladder's size — no family here needs the hand face's boost", () => {
    for (const f of TEXT_FONTS) {
      expect(textDrawSize(node({ textStyle: "title", [TEXT_FONT_PROP]: f.name })), f.name).toBe(TEXT_STYLE_SIZE.title);
    }
  });
});

/**
 * **Measured, not guessed: each family's box holds its words.**
 *
 * The numbers are regular-weight advance widths in em, taken 30 Sep 2026 in
 * headless Chrome against the real files (Google Fonts' latin subsets; Inter
 * from `web/public/fonts`) — the width of each string at 1px. They are what a
 * browser DRAWS, and `textBox` is what the CLI GUESSES; lessons #94 is the
 * day the guess was smaller.
 *
 * The bar is the estimate's own promise: after the family's real width, the
 * box still has its tenth of slack (`SLACK`) and its padding. A family with
 * no width factor spends the slack on being wide, and the case below fails —
 * which the last case proves it would.
 */
const MEASURED: Record<string, Record<string, number>> = {
  Inter: { "Design system review": 10.3462, "Ship it on Friday, 0123456789": 14.042, "Acme quarterly planning": 11.5855, Onboarding: 5.5572, Roadmap: 4.462, Wayfinding: 5.3198, Quarterly: 4.4112, MILESTONE: 5.71 },
  "IBM Plex Sans": { "Design system review": 9.695, "Ship it on Friday, 0123456789": 13.6331, "Acme quarterly planning": 10.9831, Onboarding: 5.237, Roadmap: 4.2861, Wayfinding: 4.9731, Quarterly: 4.205, MILESTONE: 5.4141 },
  "Space Grotesk": { "Design system review": 10.442, "Ship it on Friday, 0123456789": 14.1556, "Acme quarterly planning": 11.8594, Onboarding: 5.6212, Roadmap: 4.5328, Wayfinding: 5.4597, Quarterly: 4.5016, MILESTONE: 5.2541 },
  "DM Sans": { "Design system review": 9.9641, "Ship it on Friday, 0123456789": 13.5681, "Acme quarterly planning": 11.322, Onboarding: 5.4611, Roadmap: 4.3891, Wayfinding: 5.14, Quarterly: 4.3561, MILESTONE: 5.285 },
  Manrope: { "Design system review": 9.9447, "Ship it on Friday, 0123456789": 13.1973, "Acme quarterly planning": 11.1944, Onboarding: 5.4191, Roadmap: 4.3661, Wayfinding: 5.1491, Quarterly: 4.3205, MILESTONE: 5.3184 },
  "IBM Plex Serif": { "Design system review": 10.165, "Ship it on Friday, 0123456789": 14.1791, "Acme quarterly planning": 11.767, Onboarding: 5.632, Roadmap: 4.497, Wayfinding: 5.3591, Quarterly: 4.5, MILESTONE: 5.807 },
  Fraunces: { "Design system review": 10.1602, "Ship it on Friday, 0123456789": 13.7655, "Acme quarterly planning": 11.6809, Onboarding: 5.6616, Roadmap: 4.5258, Wayfinding: 5.4298, Quarterly: 4.5869, MILESTONE: 6.0109 },
  Lora: { "Design system review": 10.082, "Ship it on Friday, 0123456789": 13.37, "Acme quarterly planning": 11.442, Onboarding: 5.5491, Roadmap: 4.327, Wayfinding: 5.2591, Quarterly: 4.502, MILESTONE: 5.8291 },
  "IBM Plex Mono": { "Design system review": 12, "Ship it on Friday, 0123456789": 17.4, "Acme quarterly planning": 13.8, Onboarding: 6, Roadmap: 4.2, Wayfinding: 6, Quarterly: 5.4, MILESTONE: 5.4 },
  "JetBrains Mono": { "Design system review": 12, "Ship it on Friday, 0123456789": 17.4, "Acme quarterly planning": 13.8, Onboarding: 6, Roadmap: 4.2, Wayfinding: 6, Quarterly: 5.4, MILESTONE: 5.4 },
};

/** Lines that stay one line at each end of the ladder: phrases at body, words at display. */
const LINES: Record<TextStyle, string[]> = {
  body: ["Design system review", "Ship it on Friday, 0123456789", "Acme quarterly planning", "MILESTONE"],
  heading: [],
  title: [],
  display: ["Onboarding", "Roadmap", "Wayfinding", "Quarterly", "MILESTONE"],
};
const SLACK = 1.1;
const PAD_X = 12;

/** The strings a font's box is too narrow for, at the smallest and largest step. */
function clipped(font: TextFont): string[] {
  const out: string[] = [];
  for (const style of ["body", "display"] as const) {
    const size = TEXT_STYLE_SIZE[style];
    for (const line of LINES[style]) {
      const drawn = MEASURED[font.name]![line]! * size;
      const box = textBox(line, style, font.face, font);
      if (box.width + 1 < drawn * SLACK + PAD_X) out.push(`${style}: ${line} (${box.width} < ${Math.ceil(drawn * SLACK + PAD_X)})`);
    }
  }
  return out;
}

describe("the fit estimate stays honest for every family", () => {
  it("has a measurement for every font on the list", () => {
    expect(Object.keys(MEASURED).sort()).toEqual(TEXT_FONTS.map((f) => f.name).sort());
  });

  it("gives every family a box that holds its words with the slack intact, at S and at XL", () => {
    for (const font of TEXT_FONTS) expect(clipped(font), font.name).toEqual([]);
  });

  it("would clip without the width factors — the case above is not vacuous", () => {
    const naked = TEXT_FONTS.filter((f) => f.width > 1).map((f) => ({ ...f, width: 1 }) as TextFont);
    expect(naked.length).toBeGreaterThan(0);
    expect(naked.filter((f) => clipped(f).length > 0).map((f) => f.name)).toContain("Space Grotesk");
  });

  it("grows a caption that changes to a wider family, and fits it from scratch too", () => {
    const words = "Wayfinding";
    const item = node({ textStyle: "display" }, textBox(words, "display", "sans"));
    const refit = textNodeRefit(item, words, { properties: { [TEXT_FONT_PROP]: "Space Grotesk" } });
    expect(refit, "a wider family must grow the box").not.toBeNull();
    expect(refit!.width).toBeGreaterThan(item.width);
    const set = node({ textStyle: "display", [TEXT_FONT_PROP]: "Space Grotesk" });
    expect(textNodeFit(set, words)).toEqual(refit);
  });
});

import { describe, expect, it } from "vitest";
import {
  UI_KNOBS,
  UI_PIECES,
  compileUiTweaksCss,
  findUiKnob,
  findUiPiece,
  knobsForPiece,
  normalizeUiTweakValue,
  parseUiTweaks,
  resetUiTweaks,
  serializeUiTweaks,
  setUiTweak,
} from "../src/ui-tweaks.ts";

describe("ui-tweaks schema and compiler", () => {
  it("gives every UI piece at least one knob and unique keys", () => {
    const pieceIds = new Set(UI_PIECES.map((p) => p.id));
    expect(pieceIds.size).toBe(UI_PIECES.length);
    for (const piece of UI_PIECES) {
      expect(findUiPiece(piece.id)).toEqual(piece);
      expect(knobsForPiece(piece.id).length).toBeGreaterThan(0);
    }

    const keys = new Set<string>();
    for (const knob of UI_KNOBS) {
      expect(keys.has(knob.key)).toBe(false);
      keys.add(knob.key);
      expect(pieceIds.has(knob.piece)).toBe(true);
      expect(findUiKnob(knob.key)).toEqual(knob);
    }
  });

  it("normalizes, clamps, and expands hex colors", () => {
    const opacityKnob = findUiKnob("glass.opacity")!;
    expect(normalizeUiTweakValue(opacityKnob, "0.95")).toBe(0.95);
    expect(normalizeUiTweakValue(opacityKnob, 5)).toBe(1);
    expect(normalizeUiTweakValue(opacityKnob, -2)).toBe(0.2);
    expect(normalizeUiTweakValue(opacityKnob, "nope")).toBeNull();
    expect(normalizeUiTweakValue(opacityKnob, "reset")).toBe(0.78);

    const colorKnob = findUiKnob("colors.accent")!;
    expect(normalizeUiTweakValue(colorKnob, "#abc")).toBe("#aabbcc");
    expect(normalizeUiTweakValue(colorKnob, "#1F3FD0")).toBe("#1f3fd0");
    expect(normalizeUiTweakValue(colorKnob, "reset")).toBe("");
    expect(normalizeUiTweakValue(colorKnob, "blue")).toBeNull();
  });

  it("drops defaults and invalid entries when parsing and serializing", () => {
    const raw = JSON.stringify({
      "glass.opacity": 0.96,
      "glass.blur": 6, // default, dropped
      "rail.btnSize": "48",
      "unknown.knob": 10,
      "colors.accent": "#ff5500",
    });
    const parsed = parseUiTweaks(raw);
    expect(parsed).toEqual({
      "glass.opacity": 0.96,
      "rail.btnSize": 48,
      "colors.accent": "#ff5500",
    });

    const serialized = serializeUiTweaks(parsed);
    expect(serialized).toBe(
      JSON.stringify({
        "glass.opacity": 0.96,
        "rail.btnSize": 48,
        "colors.accent": "#ff5500",
      }),
    );

    expect(serializeUiTweaks({})).toBeNull();
    expect(parseUiTweaks("not-json")).toEqual({});
  });

  it("sets and resets individual knobs, whole pieces, or all tweaks", () => {
    const first = setUiTweak({}, "rail.btnSize", 46);
    expect(first.error).toBeUndefined();
    expect(first.tweaks).toEqual({ "rail.btnSize": 46 });

    const second = setUiTweak(first.tweaks, "rail.gap", 8);
    const third = setUiTweak(second.tweaks, "zoom.height", 50);
    expect(third.tweaks).toEqual({ "rail.btnSize": 46, "rail.gap": 8, "zoom.height": 50 });

    const bad = setUiTweak(third.tweaks, "unknown", 1);
    expect(bad.error).toContain('Unknown UI knob "unknown"');

    // Resetting one knob
    expect(resetUiTweaks(third.tweaks, "rail.gap")).toEqual({
      "rail.btnSize": 46,
      "zoom.height": 50,
    });

    // Resetting a whole piece
    expect(resetUiTweaks(third.tweaks, "rail")).toEqual({
      "zoom.height": 50,
    });

    // Resetting all
    expect(resetUiTweaks(third.tweaks)).toEqual({});
  });

  it("compiles empty string for defaults and targeted CSS rules for active tweaks", () => {
    expect(compileUiTweaksCss({})).toBe("");

    const css = compileUiTweaksCss({
      "glass.opacity": 0.96,
      "glass.blur": 30,
      "toolbar.height": 42,
      "rail.btnSize": 44,
      "rail.iconScale": 1.2,
      "zoom.zIndex": 80,
      "minimap.scale": 1.3,
      "dock.fontSize": 14,
      "items.radius": 14,
      "layers.zFloat": 35,
      "colors.accent": "#e04040",
    });

    expect(css).toContain("--glass: linear-gradient(");
    expect(css).toContain("backdrop-filter: blur(30px) saturate(1.45)");
    expect(css).toContain("--pill-h: 42px;");
    expect(css).toContain(".toolbar { height: 42px; }");
    expect(css).toContain(".tool-rail .tool-btn { width: 44px; height: 44px; }");
    expect(css).toContain(".tool-rail .tool-btn > svg { transform: scale(1.2); }");
    expect(css).toContain(".zoom-controls { z-index: 80; }");
    expect(css).toContain(".minimap-dock { transform: scale(1.3); transform-origin: 0 100%; }");
    expect(css).toContain(".dock-panel { font-size: 14px; }");
    expect(css).toContain("--radius: 14px;");
    expect(css).toContain("--z-float: 35;");
    expect(css).toContain("--accent: #e04040;");
  });
});

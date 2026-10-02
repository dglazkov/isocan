import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Operation } from "@isocan/core";
import { TEXT_COLOURS, TEXT_COLOUR_SHADES, TEXT_SURFACES, textFontFrom, textLookPatch, textLookProperties } from "@isocan/core";

/**
 * **Text colour and named fonts, from the web's side** (30 Sep 2026).
 *
 * The CLI's half is `packages/cli/test/text-refit.test.ts`, against a real
 * daemon. This half pins the two things only the web can get wrong: that the
 * ops the composer sends are core's one spelling — the same `textLookPatch`
 * `isocan text` and `isocan set` write — and that the stylesheet's shades are
 * the shades core measured.
 */

const sent: Operation[] = [];
vi.mock("../src/lib/upload.ts", () => ({
  uploadOrStageTextBlob: async () => ({ upload: { blobHash: "hash_acme", size: 4 }, stagedBlob: undefined }),
}));
vi.mock("../src/lib/groupplacement.ts", () => ({
  creationDestination: () => ({ originGroupMode: "legacy" }),
  sendCreatedItem: async (_c: string, _a: unknown, op: Operation) => void sent.push(op),
}));
vi.mock("../src/stores/canvasStore.ts", () => ({
  sendEchoed: async (_c: string, _a: unknown, op: Operation) => void sent.push(op),
}));

const { addTextNode, restyleTextNode } = await import("../src/lib/text.ts");
const actor = { id: "usr_acme", name: "Acme" };

beforeEach(() => {
  sent.length = 0;
});

describe("the web sends the ops the CLI sends", () => {
  it("births a node with core's properties for the look — colour, font and the font's face", async () => {
    await addTextNode("prj_acme", actor, "Acme roadmap", { x: 0, y: 0, chosen: true }, undefined, "title", "sans", null, undefined, {
      colour: "blue",
      font: "Fraunces",
    });
    const add = sent[0] as Extract<Operation, { type: "item.add" }>;
    expect(add.properties).toEqual(
      textLookProperties({ style: "title", face: "sans", paper: null, colour: "blue", font: textFontFrom("Fraunces") }),
    );
    expect(add.properties).toMatchObject({ textColor: "blue", textFont: "Fraunces", textFace: "serif" });
  });

  it("restyles with core's patch, and one item.update is one undo", async () => {
    await restyleTextNode("prj_acme", actor, "itm_1", "body", "mono", "yellow", null, { colour: "#aa3300", font: null });
    expect(sent).toHaveLength(1);
    expect((sent[0] as Extract<Operation, { type: "item.update" }>).patch).toEqual(
      textLookPatch({ style: "body", face: "mono", paper: "yellow", colour: "#aa3300", font: null }),
    );
  });

  it("leaves a colour and font alone when a caller does not name them", async () => {
    await restyleTextNode("prj_acme", actor, "itm_1", "heading", "sans", null);
    const patch = (sent[0] as Extract<Operation, { type: "item.update" }>).patch;
    expect(patch.removeProperties).not.toContain("textColor");
    expect(patch.removeProperties).not.toContain("textFont");
  });
});

describe("the stylesheet draws core's shades", () => {
  const css = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");
  const light = /:root,\s*:root\[data-theme="light"\]\s*\{(.*?)\n\}/s.exec(css)![1]!;
  const dark = /:root\[data-theme="dark"\]\s*\{(.*?)\n\}/s.exec(css)![1]!;
  const token = (block: string, name: string) => new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`).exec(block)?.[1];

  it.each(TEXT_COLOURS)("%s: light, dark and paper tokens are the measured values", (colour) => {
    const shade = TEXT_COLOUR_SHADES[colour];
    expect(token(light, `text-${colour}`)).toBe(shade.light);
    expect(token(dark, `text-${colour}`)).toBe(shade.dark);
    expect(token(light, `paper-text-${colour}`)).toBe(shade.paper);
    expect(token(dark, `paper-text-${colour}`)).toBe(shade.paper);
  });

  it("measures against the grounds and papers the stylesheet actually paints", () => {
    for (const [theme, block] of [["light", light], ["dark", dark]] as const) {
      expect(token(block, "ground"), `${theme} ground`).toBe(TEXT_SURFACES[theme].ground);
      for (const [paper, hex] of Object.entries(TEXT_SURFACES[theme].papers)) {
        expect(token(block, `paper-${paper}`), `${theme} ${paper}`).toBe(hex);
      }
    }
  });

  it("colours a caption's words, on paper and off, with the theme's ink as the fallback", () => {
    expect(css).toMatch(/\.item\.textnode \.md-view \{[^}]*color: var\(--text-ink, var\(--ink\)\)/);
    expect(css).toMatch(/\.item\.textnode\.paper \.md-view \{ color: var\(--text-ink, var\(--paper-ink\)\); \}/);
  });
});

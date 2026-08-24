import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ITEM_KINDS, designSystemProperties } from "@isocan/core";
import type { Item, ItemKind } from "@isocan/core";
import { ICON_NOUN, KIND_LABEL, iconKindFor, type IconKind } from "../src/lib/kinds.ts";

/**
 * Every kind has a mark, and the mark never disagrees with the filter.
 *
 * The icon vocabulary is allowed to be MORE specific than `ItemKind` — a design
 * system gets a palette though its kind is "document" — but it must never say
 * something `isocan ls --kind` would contradict, and there must never be a kind
 * with no picture at all.
 */

function itemOf(mimeType: string, properties: Record<string, string> = {}): Item {
  return {
    id: "itm_1",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    title: "T",
    description: "",
    properties,
    currentVersionId: "ver_1",
    versions: [{ id: "ver_1", blobHash: "h", mimeType, filename: "f", size: 1 }],
  } as unknown as Item;
}

const source = readFileSync(
  fileURLToPath(new URL("../src/components/KindIcon.tsx", import.meta.url)),
  "utf8",
);

/** The file with its prose removed — what actually renders.
 *
 * The comments in that file NAME the emoji the vocabulary arrived as, in order
 * to say why they are not used. A rule about pixels that reads its own
 * rationale as a violation is a rule that cannot be explained. */
const drawings = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("the kind icons", () => {
  it("draws every kind, plus the design system", () => {
    // `PATHS` is a Record<IconKind, …> so a missing one is a type error — but a
    // type error is not a test, and this file is what fails if the record is
    // ever loosened to a partial.
    for (const kind of [...ITEM_KINDS, "design-system" as const]) {
      expect(source, `no drawing for ${kind}`).toMatch(
        new RegExp(`(^|\\s)"?${kind}"?:\\s*\\(`, "m"),
      );
    }
  });

  it("names every kind in a tooltip and every ItemKind in a group heading", () => {
    for (const kind of ITEM_KINDS) {
      expect(ICON_NOUN[kind], `no noun for ${kind}`).toBeTruthy();
      expect(KIND_LABEL[kind], `no group label for ${kind}`).toBeTruthy();
    }
    expect(ICON_NOUN["design-system"]).toBeTruthy();
  });

  it("gives the design system its own mark, ahead of its kind", () => {
    const style = itemOf("text/markdown", designSystemProperties());
    expect(iconKindFor(style)).toBe("design-system");
  });

  it("leaves the design system filterable as what it is", () => {
    // The presentation may be more specific than the filter. It may not
    // disagree: `isocan ls --kind document` has to keep finding this.
    const style = itemOf("text/markdown", designSystemProperties());
    expect(iconKindFor(style)).not.toBe(style.properties["kind"]);
    expect(KIND_LABEL["document"]).toBe("Documents");
  });

  it("falls through to the plain kind for everything else", () => {
    const cases: Array<[string, ItemKind]> = [
      ["text/html", "screen"],
      ["text/markdown", "document"],
      ["image/png", "image"],
      ["video/mp4", "video"],
      ["application/zip", "other"],
    ];
    for (const [mime, kind] of cases) {
      expect(iconKindFor(itemOf(mime))).toBe(kind as IconKind);
    }
  });

  it("draws with currentColor only — no hardcoded ink", () => {
    // The mark has to follow the title row into the accent and the page into
    // dark mode. A literal colour in here is a mark that stays put when
    // everything around it moves, and no theme test would see it.
    const colours = drawings.match(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/g) ?? [];
    expect(colours, `hardcoded colour in the icon set: ${colours.join(", ")}`).toEqual([]);
  });

  it("is not emoji", () => {
    // The vocabulary arrived as emoji and the meanings were right; the
    // rendering was not. Emoji are full-colour, differ per platform, and
    // cannot take the accent — and `/design-audit` counts them among the tells
    // of a machine-made interface.
    expect(drawings).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});

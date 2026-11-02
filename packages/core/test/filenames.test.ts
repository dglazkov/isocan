import { describe, expect, it } from "vitest";
import {
  deckFilename,
  docFilenameFrom,
  extensionOf,
  filenameFromTitle,
  filenamesInUse,
  renamedFilename,
  titleSlug,
  uniqueFilename,
} from "../src/index.ts";
import { apply, nv, seedState } from "./helpers.ts";

describe("filenameFromTitle", () => {
  it("makes a title into a filename, keeping the extension", () => {
    expect(filenameFromTitle("Bass tab v2", "sketch.svg")).toBe("bass-tab-v2.svg");
  });

  it("does not change what kind of file it is", () => {
    expect(filenameFromTitle("Notes", "reference.png")).toBe("notes.png");
    expect(extensionOf("reference.png")).toBe(".png");
  });

  it("survives punctuation, accents, and runs of spaces", () => {
    expect(filenameFromTitle("  Café  —  Menu!! ", "a.md")).toBe("cafe-menu.md");
  });

  it("keeps the old name when a title has nothing to make a name from", () => {
    expect(filenameFromTitle("🎸", "sketch.svg")).toBe("sketch.svg");
    expect(filenameFromTitle("   ", "sketch.svg")).toBe("sketch.svg");
  });

  it("leaves an extensionless file extensionless", () => {
    expect(filenameFromTitle("Read me", "LICENSE")).toBe("read-me");
  });
});

/**
 * **One title, one filename, whichever door it leaves by** (cleanup DU-2,
 * 27 Sep 2026).
 *
 * There were six spellings of this rule. The canonical one decomposed accents
 * and never removed the marks, so a mark in the middle of a word became a
 * hyphen ("Crème brûlée" → `cre-me-bru-le-e`; "Café" only passed above
 * because its accent is the last letter). The ASCII copies — a placed Google
 * Doc, a deck download, a wireframe screen — dropped the accented letter
 * outright ("Café" → `caf`) and turned a Japanese title into the fallback.
 * Each case below runs every former copy on the same title.
 */
describe("titleSlug, the one rule every filename is made by", () => {
  const cases: [string, string][] = [
    ["Crème brûlée", "creme-brulee"],
    ["Café", "cafe"],
    ["Ångström über naïve Øre", "angstrom-uber-naive-øre"],
    ["東京 タワー", "東京-タワー"],
    // A dakuten is a combining mark after NFKD; only Latin letters lose theirs,
    // so デ stays デ rather than becoming テ.
    ["データ", "データ"],
    // Devanagari vowel signs are marks too, and a word without them is a
    // different word.
    ["हिन्दी", "हिन्दी"],
    ["Ｆｕｌｌ ﬁle №1", "full-file-no1"],
  ];

  it.each(cases)("%s → %s", (title, stem) => {
    expect(titleSlug(title)).toBe(stem);
    expect(filenameFromTitle(title, "old.svg")).toBe(`${stem}.svg`);
    expect(docFilenameFrom(title)).toBe(`${stem}.md`);
    expect(deckFilename(title, "html")).toBe(`${stem}.html`);
  });

  it("answers nothing for a title with nothing in it, so each caller keeps its own fallback", () => {
    expect(titleSlug("🎸 !!")).toBe("");
    expect(docFilenameFrom("***")).toBe("document.md");
    expect(deckFilename("  ", "pdf")).toBe("deck.pdf");
  });

  it("cuts at a length without leaving a hyphen or half a character behind", () => {
    expect(titleSlug("Acme launch plan", { max: 12 })).toBe("acme-launch");
    expect(titleSlug("𠀀𠀁𠀂", { max: 2 })).toBe("𠀀𠀁");
  });

  it("keeps to ASCII for a name whose grammar is ASCII, folding accents rather than dropping letters", () => {
    expect(titleSlug("Crème brûlée", { ascii: true })).toBe("creme-brulee");
    expect(titleSlug("東京", { ascii: true })).toBe("");
  });
});

describe("uniqueFilename", () => {
  it("leaves a free name alone", () => {
    expect(uniqueFilename("sketch.svg", ["other.svg"])).toBe("sketch.svg");
  });

  it("steps aside from a taken one", () => {
    expect(uniqueFilename("sketch.svg", ["sketch.svg"])).toBe("sketch-2.svg");
    expect(uniqueFilename("sketch.svg", ["sketch.svg", "sketch-2.svg"])).toBe("sketch-3.svg");
  });

  it("treats case as the same name — the filesystem would", () => {
    expect(uniqueFilename("Sketch.svg", ["sketch.SVG"])).toBe("Sketch-2.svg");
  });
});

describe("renamedFilename", () => {
  it("does not collide an item with itself", () => {
    const state = seedState();
    // itm_1's own current file is ver_1b.md; renaming to that same stem is fine.
    const name = renamedFilename(state.canvas, "itm_1", "ver 1b", "ver_1b.md");
    expect(name).toBe("ver-1b.md");
  });

  it("steps aside from a name another item is already using", () => {
    let state = seedState();
    state = apply(state, {
      type: "item.add",
      itemId: "itm_new",
      version: { ...nv("ver_new"), filename: "notes.md" },
      width: 10,
      height: 10,
      placement: { x: 0, y: 0 },
    })!;
    expect(renamedFilename(state.canvas, "itm_1", "Notes", "ver_1b.md")).toBe("notes-2.md");
  });

  it("counts every version's filename, not just the visible one", () => {
    const state = seedState();
    expect(filenamesInUse(state.canvas)).toContain("ver_1.md");
    expect(filenamesInUse(state.canvas, "itm_1")).not.toContain("ver_1.md");
  });
});

describe("item.update with a filename", () => {
  it("renames the current version's file and nothing else", () => {
    let state = seedState();
    const before = state.canvas.items.itm_1!;
    state = apply(state, {
      type: "item.update",
      itemId: "itm_1",
      patch: { title: "Renamed" },
      filename: "renamed.md",
    })!;
    const after = state.canvas.items.itm_1!;
    expect(after.title).toBe("Renamed");
    expect(after.versions.find((v) => v.id === after.currentVersionId)!.filename).toBe("renamed.md");
    // The version that is not on top keeps the name it was uploaded under.
    const older = after.versions.find((v) => v.id !== after.currentVersionId)!;
    expect(older.filename).toBe(before.versions.find((v) => v.id === older.id)!.filename);
  });
});

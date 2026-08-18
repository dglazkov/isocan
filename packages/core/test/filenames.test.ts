import { describe, expect, it } from "vitest";
import {
  extensionOf,
  filenameFromTitle,
  filenamesInUse,
  renamedFilename,
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

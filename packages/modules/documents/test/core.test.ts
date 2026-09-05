import { afterEach, describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "@isocan/core";
import { TEXT_PROPERTIES, moduleCommands, noteProperties, registerModule, unregisterModule, withModuleCommands } from "@isocan/core";
import { documentsModule, documentsOn, isDocumentItem, outlineOf, outlineText, readingMinutes, wordCount } from "../src/core.ts";

/**
 * **Documents**: what counts as one, the outline read from its text with
 * fenced code left alone, the size a writer would count, and the two
 * commands laid under the built-ins while the module is loaded.
 */
const at = "2026-09-05T10:00:00.000Z";
const actor = { id: "usr_a", name: "A" };
function item(id: string, mime: string, properties: Record<string, string> = {}, updatedAt = at): Item {
  return {
    id,
    title: id,
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    createdAt: at,
    updatedAt,
    createdBy: actor,
    updatedBy: actor,
    description: "",
    versions: [{ id: `ver_${id}`, blobHash: `hash_${id}`, mimeType: mime, filename: `${id}.md`, size: 1, createdAt: at, createdBy: actor }],
    currentVersionId: `ver_${id}`,
    properties,
    reactions: {},
  } as Item;
}
const canvas = (items: Item[]): CanvasContents =>
  ({ items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {}, edges: {} }) as unknown as CanvasContents;

afterEach(() => unregisterModule(documentsModule.name));

describe("what is a document", () => {
  it("is markdown or text brought as prose — not a caption, a note, the design system, a pdf or a screen", () => {
    expect(isDocumentItem(item("plan", "text/markdown"))).toBe(true);
    expect(isDocumentItem(item("readme", "text/plain"))).toBe(true);
    expect(isDocumentItem(item("caption", "text/markdown", TEXT_PROPERTIES))).toBe(false);
    expect(isDocumentItem(item("note", "text/markdown", noteProperties("plan")))).toBe(false);
    expect(isDocumentItem(item("style", "text/markdown", { role: "design-system" }))).toBe(false);
    expect(isDocumentItem(item("paper", "application/pdf"))).toBe(false);
    expect(isDocumentItem(item("screen", "text/html"))).toBe(false);
  });

  it("lists newest edit first", () => {
    const older = item("a", "text/markdown", {}, "2026-09-01T00:00:00.000Z");
    const newer = item("b", "text/markdown", {}, "2026-09-04T00:00:00.000Z");
    expect(documentsOn(canvas([older, newer, item("s", "text/html")])).map((d) => d.id)).toEqual(["b", "a"]);
  });
});

describe("the outline", () => {
  const md = "# Plan\n\nintro words here\n\n## Why\n\n```sh\n# not a heading\necho hi\n```\n\n### Because ##\n\n## How\n";

  it("reads ATX headings with their lines and skips fenced code", () => {
    expect(outlineOf(md)).toEqual([
      { level: 1, text: "Plan", line: 1 },
      { level: 2, text: "Why", line: 5 },
      { level: 3, text: "Because", line: 12 },
      { level: 2, text: "How", line: 14 },
    ]);
    expect(outlineText(outlineOf(md))).toBe("Plan\n  Why\n    Because\n  How");
    expect(outlineText([])).toBe("(no headings)");
  });

  it("counts words the way a writer would, code fences out", () => {
    expect(wordCount(md)).toBe(7);
    expect(readingMinutes(7)).toBe(1);
    expect(readingMinutes(1000)).toBe(5);
  });
});

describe("the commands", () => {
  it("are laid under the built-ins while the module is loaded, and a built-in of the same name wins", () => {
    expect(moduleCommands()).toEqual([]);
    registerModule(documentsModule);
    expect(moduleCommands().map((c) => [c.name, c.source])).toEqual([
      ["outline", "module"],
      ["summarize", "module"],
    ]);
    const builtIn = { name: "outline", description: "ours", usage: "", body: "b", source: "built-in" as const };
    const merged = withModuleCommands([builtIn]);
    expect(merged.map((c) => [c.name, c.source])).toEqual([
      ["outline", "built-in"],
      ["summarize", "module"],
    ]);
  });
});

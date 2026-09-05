import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/model.ts";
import { deck, isNote, noteFor, noteProperties, noteSpot, notesMarkdown, notesOn, slides } from "../src/slides.ts";
import { deckPages } from "../src/deckexport.ts";
import { TEXT_PROPERTIES } from "../src/textnode.ts";

/**
 * **Speaker notes** — a text item that points at its slide. Never a slide
 * itself, never in the deck's fallback walk; found from its slide; landing
 * under it; and the handout says which slides have nothing written.
 */
const at = "2026-09-05T10:00:00.000Z";
const actor = { id: "usr_a", name: "A" };
function item(id: string, x: number, y: number, properties: Record<string, string> = {}, title = id): Item {
  return {
    id,
    title,
    x,
    y,
    width: 800,
    height: 450,
    createdAt: at,
    updatedAt: at,
    createdBy: actor,
    updatedBy: actor,
    description: "",
    versions: [{ id: `ver_${id}`, blobHash: `hash_${id}`, mimeType: "text/html", filename: `${id}.html`, size: 1, createdAt: at, createdBy: actor }],
    currentVersionId: `ver_${id}`,
    properties,
    reactions: {},
  } as Item;
}
const canvas = (items: Item[]): CanvasContents =>
  ({ items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {}, edges: {} }) as unknown as CanvasContents;

const a = item("a", 0, 0, { slide: "yes" }, "Opening");
const b = item("b", 900, 0, { slide: "yes" }, "The ask");
const noteA = item("n_a", 0, 474, noteProperties("a"), "Notes for Opening");

describe("a speaker note", () => {
  it("wears the text node's properties and its slide's id", () => {
    expect(noteProperties("a")).toEqual({ ...TEXT_PROPERTIES, noteFor: "a" });
    expect(isNote(noteA)).toBe(true);
    expect(isNote(a)).toBe(false);
  });

  it("is never a slide and never in the fallback walk, even when marked", () => {
    const markedNote = item("n_m", 0, 474, { ...noteProperties("a"), slide: "yes" });
    expect(slides(canvas([a, b, noteA, markedNote])).map((i) => i.id)).toEqual(["a", "b"]);
    // Nothing marked: every item is a slide — except the notes.
    const plain = item("p", 0, 0);
    expect(deck(canvas([plain, noteA])).map((i) => i.id)).toEqual(["p"]);
  });

  it("is found from its slide, the first by id when two race", () => {
    const second = item("n_b", 0, 900, noteProperties("a"));
    expect(noteFor(canvas([a, second, noteA]), "a")?.id).toBe("n_a");
    expect(noteFor(canvas([a, b]), "a")).toBeNull();
  });

  it("lands under its slide, the slide's width", () => {
    expect(noteSpot(a)).toEqual({ x: 0, y: 450 + 24, width: 800, height: 160 });
  });

  it("rides the deck's pages by blob, and the handout says which slides have none", () => {
    const c = canvas([a, b, noteA]);
    expect(deckPages(c).map((p) => [p.id, p.note?.blobHash ?? null])).toEqual([
      ["a", "hash_n_a"],
      ["b", null],
    ]);
    expect(notesOn(c).map(({ slide, note }) => [slide.id, note?.id ?? null])).toEqual([
      ["a", "n_a"],
      ["b", null],
    ]);
    expect(notesMarkdown(c, () => "Say hello.\n")).toBe("## 1. Opening\n\nSay hello.\n\n## 2. The ask\n\n_No notes._\n");
  });
});

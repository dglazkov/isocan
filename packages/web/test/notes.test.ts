import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Speaker notes on the three surfaces the app has for a deck.** On the
 * canvas the note says which slide it speaks for; in full screen N shows it
 * under the stage, never over it, remembered per browser; in the deck view
 * "With notes" prints it under the slide on the same sheet. The menu makes
 * the same item the CLI makes.
 */
const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const itemView = read("../src/components/ItemView.tsx");
const fullScreen = read("../src/components/FullScreen.tsx");
const deckPrint = read("../src/components/DeckPrint.tsx");
const menu = read("../src/lib/menuentries.tsx");
const notes = read("../src/lib/notes.ts");
const css = read("../src/styles.css");
const store = read("../src/stores/uiStore.ts");

describe("speaker notes", () => {
  it("name their slide on the canvas, as a caption and not a card", () => {
    expect(itemView).toContain("noteTarget(item)");
    expect(itemView).toContain('className="note-of"');
    expect(css).toContain(".item.textnode .note-of {");
  });

  it("show under the stage in full screen on N, remembered per browser", () => {
    expect(fullScreen).toContain('(e.key === "n" || e.key === "N")');
    expect(fullScreen).toContain("noteFor(s.canvas, itemId)");
    expect(fullScreen).toContain('<aside className="fs-notes"');
    expect(fullScreen).toContain("fullscreen-stage${presenterNotes ? \" with-notes\" : \"\"}");
    expect(store).toContain('const PRESENTER_NOTES_KEY = "isocan.presenterNotes";');
    expect(store).toContain("presenterNotes: readFlag(PRESENTER_NOTES_KEY, false),");
  });

  it("print under the slide on the same sheet when asked, from the flag the CLI sets", () => {
    expect(deckPrint).toContain('params.get("notes") === "1"');
    expect(deckPrint).toContain('className="deck-sheet"');
    expect(deckPrint).toContain("deckHtml(title, contents, { withNotes })");
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toContain(".deck-sheet { break-after: page;");
    expect(print).toContain(".with-notes .deck-page { flex: 0 0 62%; }");
  });

  it("are made from the slide's menu as the item the CLI makes", () => {
    expect(menu).toContain('label: "Add speaker notes"');
    expect(menu).toContain('label: "Go to speaker notes"');
    expect(notes).toContain("properties: noteProperties(slide.id)");
    expect(notes).toContain("const spot = noteSpot(slide);");
  });
});

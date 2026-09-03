import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const peek = read("../src/components/CardPeek.tsx");
const lib = read("../src/lib/cardpeek.ts");

/**
 * **The card peek shows the thing.** A row is a thumbnail of the item the
 * seam is about, drawn by the one thumbnail renderer, and a link to it; a
 * seam about a conversation quotes its opening line through the same
 * sentence every surface uses. Still lazy: nothing is read until somebody
 * points at the card, and the snapshot rides along with the log.
 */
describe("the peek shows the thing, not only the verb", () => {
  it("draws the item with the lens's thumbnail, and links the row to it", () => {
    expect(peek).toContain("<ItemThumb canvasId={canvasId} itemId={item.id} item={item} width={62} height={44} />");
    expect(peek).toContain("to={itemPath(canvasId, item.id)}");
  });

  it("says the one sentence every surface says for a seam with no picture", () => {
    expect(peek).toContain("{item ? words : majorWhat(seam)}");
  });

  it("reads the snapshot with the log, once, and survives a snapshot that will not open", () => {
    expect(lib).toContain("getSnapshot(canvasId).catch(() => null)");
    expect(lib).toContain("items: snapshot?.canvas.items ?? {}");
    expect(lib).toContain("const seen = new Map<string, Peek>();");
  });
});

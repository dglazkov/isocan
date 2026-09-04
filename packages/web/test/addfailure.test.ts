import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AddFilesError, addFailure } from "../src/lib/upload.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * **An upload that fails says something** (#51). Every path that brings a
 * file onto the canvas ends in a sentence a person can read — and when a
 * drop of several got partway, the sentence counts, and the ones that landed
 * are selected rather than lost.
 */
describe("a drop that got partway says how far", () => {
  it("counts the landed against the total, names the file, and hands the landed back", () => {
    const err = new AddFilesError("the home refused the blob", ["itm_a", "itm_b"], "third.png", 5);
    const { landed, notice } = addFailure(err, 5, "Those files could not be added.");
    expect(landed).toEqual(["itm_a", "itm_b"]);
    expect(notice).toBe("2 of 5 added — third.png: the home refused the blob");
  });

  it("names just the file when there was one", () => {
    const err = new AddFilesError("offline", [], "deck.pdf", 1);
    expect(addFailure(err, 1, "That file could not be added.").notice).toBe("deck.pdf: offline");
  });

  it("falls back to the plain sentence for any other throw, with nothing landed", () => {
    expect(addFailure(new Error(""), 3, "Those files could not be added.")).toEqual({
      landed: [],
      notice: "Those files could not be added.",
    });
    expect(addFailure("boom", 1, "That file could not be added.").notice).toBe("That file could not be added.");
  });
});

describe("every upload path ends in a notice, not an unhandled rejection", () => {
  const viewport = read("../src/components/CanvasViewport.tsx");
  const tools = read("../src/components/CanvasTools.tsx");
  const upload = read("../src/lib/upload.ts");

  it("the drop and the rail both read the failure through addFailure and select what landed", () => {
    expect(viewport).toContain("addFailure(err, files.length,");
    expect(tools).toContain("addFailure(err, files.length,");
    expect(viewport).toContain("return landed;");
    expect(tools).toContain("return landed;");
  });

  it("a version dropped onto an item is caught and said", () => {
    const drop = viewport.slice(viewport.indexOf("addVersionFromFile(canvasId"), viewport.indexOf("addFailure(err"));
    expect(drop).toContain("} catch (err) {");
    expect(drop).toContain("could not be added as a version");
  });

  it("a dragged link is tested for http(s) first, so only a real upload failure is said", () => {
    expect(viewport).toContain('if (!/^https?:\\/\\//i.test(link)) return;');
    expect(viewport).not.toContain("// Not http(s) — nothing to project.\n        }");
    expect(viewport).toContain("That site could not be added.");
  });

  it("addFiles throws its own error carrying the landed ids at both places a file can fail", () => {
    const loop = upload.slice(upload.indexOf("export async function addFiles"), upload.indexOf("export const BROWSER_SIZE"));
    expect(loop.match(/throw new AddFilesError\(/g)?.length).toBe(2);
  });
});

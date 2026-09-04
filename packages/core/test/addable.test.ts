import { describe, expect, it } from "vitest";
import { addableWords, classifyAddable, looksLikeSite } from "../src/addable.ts";

/**
 * **One door reads what you gave it.** The order is the order of
 * confidence, and the one ambiguity that matters — words that could be a
 * canvas title or a site — is settled by shape: a scheme or a dot is a
 * site, anything else is looked up among your canvases.
 */
const canvases = [
  { id: "prj_lake", title: "Lake House" },
  { id: "prj_lake2", title: "Lake House Rules" },
  { id: "prj_arch", title: "Archery" },
  { id: "prj_self", title: "This one" },
];
const DOC = "https://docs.google.com/document/d/195j9eDD3ccgjQRttHhJPymLJUCOUjs-jmwTrekvdjFE/edit";

describe("classifying a paste", () => {
  it("knows a Google Doc before anything else", () => {
    expect(classifyAddable(`${DOC}?usp=sharing`, canvases)).toMatchObject({ kind: "doc", id: "195j9eDD3ccgjQRttHhJPymLJUCOUjs-jmwTrekvdjFE" });
  });

  it("knows a canvas address at any home, with the title when this home has it", () => {
    expect(classifyAddable("https://isocan.io/p/prj_lake", canvases)).toMatchObject({ kind: "canvas", canvasId: "prj_lake", origin: "https://isocan.io", title: "Lake House" });
    expect(classifyAddable("https://elsewhere.example/p/prj_far", canvases)).toMatchObject({ kind: "canvas", canvasId: "prj_far", title: null });
  });

  it("knows a canvas by id, or by exactly one title", () => {
    expect(classifyAddable("prj_arch", canvases)).toMatchObject({ kind: "canvas", canvasId: "prj_arch" });
    expect(classifyAddable("archery", canvases)).toMatchObject({ kind: "canvas", canvasId: "prj_arch", title: "Archery" });
    // An exact title wins over the prefix it is also a prefix of.
    expect(classifyAddable("lake house", canvases)).toMatchObject({ kind: "canvas", canvasId: "prj_lake" });
    // Two prefix matches is a search, not a guess.
    expect(classifyAddable("lake", canvases)).toMatchObject({ kind: "search", query: "lake" });
  });

  it("never offers the canvas you are on as a card of itself", () => {
    expect(classifyAddable("This one", canvases, "prj_self")).toMatchObject({ kind: "search" });
    expect(classifyAddable("prj_self", canvases, "prj_self")).toMatchObject({ kind: "search" });
  });

  it("reads an address as a site, and words as a search", () => {
    expect(classifyAddable("localhost:5173", canvases)).toMatchObject({ kind: "site", url: "http://localhost:5173/" });
    expect(classifyAddable("lakehouse.io", canvases)).toMatchObject({ kind: "site" });
    expect(classifyAddable("https://example.com/x", canvases)).toMatchObject({ kind: "site", url: "https://example.com/x" });
    expect(classifyAddable("what did we decide", canvases)).toMatchObject({ kind: "search" });
    expect(classifyAddable("   ", canvases)).toEqual({ kind: "empty" });
  });

  it("tells site from title by shape", () => {
    expect(looksLikeSite("Lake House")).toBe(false);
    expect(looksLikeSite("lakehouse.io")).toBe(true);
    expect(looksLikeSite("localhost")).toBe(true);
    expect(looksLikeSite("127.0.0.1:4441")).toBe(true);
    expect(looksLikeSite("notes.md")).toBe(true); // a dotted word reads as a host; a file is the picker's job
  });

  it("says what Enter would do", () => {
    expect(addableWords(classifyAddable(DOC, canvases))).toMatch(/^Add as a document/);
    expect(addableWords(classifyAddable("archery", canvases))).toBe("Place the canvas “Archery”");
    expect(addableWords(classifyAddable("localhost:5173", canvases))).toMatch(/as a live site$/);
    expect(addableWords(classifyAddable("", canvases))).toBeNull();
  });
});

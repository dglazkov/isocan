import { describe, expect, it } from "vitest";
import {
  collectItemRefCandidates,
  extractItemRefs,
  findItemRefSpans,
} from "../src/index.ts";
import { apply, seedState } from "./helpers.ts";

const notes = { id: "itm_n", title: "notes.md" };
const notesById = { id: "itm_n", title: "itm_n" };
const design = { id: "itm_d", title: "Design" };
const designDoc = { id: "itm_dd", title: "Design doc" };

describe("extractItemRefs", () => {
  it("matches full titles, case-insensitively", () => {
    expect(extractItemRefs("see #notes.md for detail", [notes, design])).toEqual(["itm_n"]);
    expect(extractItemRefs("see #NOTES.MD", [notes])).toEqual(["itm_n"]);
  });

  it("matches by id and dedupes to one item", () => {
    expect(extractItemRefs("look at #itm_n", [notes, notesById])).toEqual(["itm_n"]);
    expect(extractItemRefs("#notes.md and again #itm_n", [notes, notesById])).toEqual(["itm_n"]);
  });

  it("collects multiple distinct references", () => {
    expect(extractItemRefs("#Design vs #notes.md", [notes, design])).toEqual(["itm_n", "itm_d"]);
  });

  it("gives titles no first-token shorthand — the whole title or nothing", () => {
    expect(extractItemRefs("#Design", [designDoc])).toEqual([]);
    expect(extractItemRefs("#Design doc", [designDoc])).toEqual(["itm_dd"]);
  });

  it("requires # to start a word — URL fragments and headings refer to nothing", () => {
    expect(extractItemRefs("see example.com#Design", [design])).toEqual([]);
    expect(extractItemRefs("# Design", [design])).toEqual([]); // a markdown heading
    expect(extractItemRefs("#Designer", [design])).toEqual([]);
  });

  it("handles punctuation after the title", () => {
    expect(extractItemRefs("#Design, please.", [design])).toEqual(["itm_d"]);
    expect(extractItemRefs("(#notes.md)", [notes])).toEqual(["itm_n"]);
  });
});

describe("findItemRefSpans", () => {
  it("locates each reference, longest title first", () => {
    const body = "#Design doc beats #Design";
    expect(findItemRefSpans(body, [design, designDoc])).toEqual([
      { start: 0, end: 11, itemId: "itm_dd", text: "Design doc" },
      { start: 18, end: 25, itemId: "itm_d", text: "Design" },
    ]);
    expect(body.slice(0, 11)).toBe("#Design doc");
  });

  it("keeps the body's own casing in the span", () => {
    expect(findItemRefSpans("see #design", [design])).toEqual([
      { start: 4, end: 11, itemId: "itm_d", text: "design" },
    ]);
  });
});

describe("collectItemRefCandidates", () => {
  it("offers each live item under its title and its id; trashed items are out", () => {
    const candidates = collectItemRefCandidates(seedState().canvas);
    const names = candidates.map((c) => `${c.id}:${c.title}`);
    expect(names).toContain("itm_1:One");
    expect(names).toContain("itm_1:itm_1");
    expect(names).toContain("itm_2:ver_2.md"); // untitled items answer to their filename
    expect(names).toContain("itm_2:itm_2");
    expect(names.some((n) => n.startsWith("itm_trashed:"))).toBe(false);
  });
});

describe("comment.items through the reducer", () => {
  it("stores resolved item references on the comment, and omits empty ones", () => {
    const state = apply(seedState(), {
      type: "thread.reply",
      threadId: "thr_1",
      comment: { id: "cmt_ref", body: "see #One", items: ["itm_1"] },
    })!;
    const comments = state.canvas.threads["thr_1"]!.comments;
    expect(comments.find((c) => c.id === "cmt_ref")!.items).toEqual(["itm_1"]);
    expect(comments.find((c) => c.id === "cmt_1")!.items).toBeUndefined();
  });
});

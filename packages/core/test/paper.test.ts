import { describe, expect, it } from "vitest";
import { PAPERS, PAPER_PROP, PAPER_SIZE, isPaper, paperOf, paperPatch, isTextItem } from "../src/textnode.ts";
import { TEXT_PROPERTIES } from "../src/textnode.ts";
import type { Item } from "../src/model.ts";

/**
 * **The post-it is a text node wearing paper** — not a new op, not a new kind,
 * and not a comment. `docs/research/2026-09-01-post-it-notes.md` is the
 * argument; this is the part of it a machine can check.
 */
const node = (props: Record<string, string> = {}): Item =>
  ({
    id: "itm_1",
    title: "note",
    x: 0,
    y: 0,
    width: 220,
    height: 220,
    properties: { ...TEXT_PROPERTIES, ...props },
    versions: [],
    currentVersionId: "v",
    createdAt: "",
    updatedAt: "",
  }) as unknown as Item;

describe("paper", () => {
  it("is absent by default, which is every note written before it existed", () => {
    expect(paperOf(node())).toBe(null);
  });

  it("is still an ordinary text node underneath", () => {
    // The whole reason this is a property: strip it and nothing breaks. A
    // client that has never heard of paper renders a markdown note.
    const sticky = node({ [PAPER_PROP]: "yellow" });
    expect(isTextItem(sticky)).toBe(true);
    expect(paperOf(node())).toBe(null);
  });

  it("ignores a value nobody offered, rather than rendering it", () => {
    // Properties are free-form strings on the wire, so the reader is the
    // gate. A colour resolved from somebody's local taste would render one
    // collaborator's canvas differently from another's.
    expect(paperOf(node({ [PAPER_PROP]: "chartreuse" }))).toBe(null);
    expect(isPaper("chartreuse")).toBe(false);
    for (const one of PAPERS) expect(isPaper(one)).toBe(true);
  });

  it("clears by REMOVING, because properties merge", () => {
    // An unpaper that wrote an empty string would leave the note yellow
    // forever — the same trap `slidePatch` names.
    expect(paperPatch(null)).toEqual({ removeProperties: [PAPER_PROP] });
    expect(paperPatch("blue")).toEqual({ properties: { [PAPER_PROP]: "blue" } });
  });

  it("starts square, because that is the constraint that makes it useful", () => {
    // A note sized to its words is a text node with a background: the shape
    // would be doing no work. A post-it will not hold an essay.
    expect(PAPER_SIZE).toBeGreaterThan(0);
    expect(PAPERS.length).toBeGreaterThan(1);
  });
});

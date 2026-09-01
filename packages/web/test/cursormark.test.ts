import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { faceMark, markOf } from "@isocan/core";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * **A mark is a chosen thing that may be absent, and there is one place that
 * knows it.**
 *
 * `faceMark` answers "what glyph goes in the disc" and falls back to an
 * initial, because a disc is never empty. A cursor chip already carries the
 * name, so the same fallback there would print the first letter twice —
 * "D Dion". `markOf` is the raw question, and `faceMark` is written in terms
 * of it so the two cannot drift about what "no mark" means.
 */
describe("the mark somebody chose", () => {
  const ada = { id: "usr_ada", name: "Ada" };

  it("is null when nobody chose one", () => {
    expect(markOf({}, ada)).toBe(null);
    expect(markOf(undefined, ada)).toBe(null);
  });

  it("is the emoji when they did", () => {
    expect(markOf({ usr_ada: "⚓" }, ada)).toBe("⚓");
  });

  it("still falls back to an initial where a disc must not be empty", () => {
    expect(faceMark({}, ada)).toBe("A");
    expect(faceMark({ usr_ada: "⚓" }, ada)).toBe("⚓");
  });
});

describe("the cursor chip", () => {
  const src = read("../src/components/CursorLayer.tsx");

  it("wears the mark in front of the name", () => {
    // A cursor is where somebody is identified at a glance, and it is the one
    // that moves — a glyph is easier to follow than a word is to read.
    expect(src).toContain("markOf(marks, session.actor)");
    expect(src).toContain('<b className="cursor-mark">');
  });

  it("asks for the raw mark, not the disc's fallback", () => {
    // `faceMark` here would render "D Dion".
    const chip = src.slice(src.indexOf("cursor-chip"));
    expect(chip.slice(0, chip.indexOf("</span>"))).not.toContain("faceMark");
  });
});

/**
 * **The mark is settable from the terminal too**, or it is a fact one client
 * can set and the other cannot — which this project calls a habit.
 */
describe("choosing a mark", () => {
  const cli = read("../../cli/src/main.ts");

  it("is offered by the CLI beside the colour it resembles", () => {
    expect(cli).toContain('"--mark <emoji>"');
    expect(cli).toContain('type: "actor.setMark"');
  });

  it("is gated by core's rule rather than a second opinion", () => {
    // One emoji, not a word: a mark is drawn on every face on every canvas,
    // so a terminal that accepted "hello" would put a word where a glyph goes
    // on somebody else's screen.
    expect(cli).toContain("isFaceMark(wanted)");
  });

  it("clears with the same word the colour uses", () => {
    expect(cli).toMatch(/wanted\.toLowerCase\(\) === "none"/);
  });
});

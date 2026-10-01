import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AGENT_POINTER, faceMark, markOf, pointerMark } from "@isocan/core";

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

  it("is a robot on an agent's pointer when nobody chose one — and only there", () => {
    const rover = { id: "usr_rover" };
    expect(AGENT_POINTER).toBe("🤖");
    expect(pointerMark({}, rover, true)).toBe(AGENT_POINTER);
    expect(pointerMark({ usr_rover: "🐕" }, rover, true)).toBe("🐕");
    expect(pointerMark({}, ada, false)).toBe(null);
    expect(pointerMark({ usr_ada: "⚓" }, ada, false)).toBe("⚓");
  });

  it("still falls back to an initial where a disc must not be empty", () => {
    expect(faceMark({}, ada)).toBe("A");
    expect(faceMark({ usr_ada: "⚓" }, ada)).toBe("⚓");
  });
});

describe("the cursor chip", () => {
  const src = read("../src/components/CursorLayer.tsx");
  const own = read("../src/components/OwnCursor.tsx");

  it("wears the mark AS the pointer — everyone else's, and your own", () => {
    // A cursor is where somebody is identified at a glance, and it is the one
    // that moves — a glyph is easier to follow than a word is to read.
    // `.cursor-chip` is `flex-direction: column` so the status `<em>` stacks
    // below, which means the mark and name must share an inline `<span>` or
    // flexbox stacks the emoji on a line above the name.
    expect(src).toContain("pointerMark(marks, session.actor,");
    // A remote cursor wears the mark as its pointer (agent pointers, 30 Sep
    // 2026) — the chip is the name alone, so the glyph is said once.
    expect(src).toContain('{mark && <b className="cursor-glyph">{mark}</b>}');
    expect(src).not.toContain("cursor-mark");
    expect(own).toContain("markOf(marks, actor)");
    // Your own pointer too (1 Oct 2026): the canvas's shape is the default and
    // a mark you chose replaces it, on your screen as on everyone else's —
    // so the chip under your hand is the name alone, as theirs is.
    expect(own).toContain('{mark && <b className="cursor-glyph">{mark}</b>}');
    expect(own).toContain('own-cursor${mark ? " marked" : ""}');
    expect(own).not.toContain("cursor-mark");
  });

  it("asks for the raw mark, not the disc's fallback", () => {
    // `faceMark` here would render "D Dion".
    const chip = src.slice(src.indexOf("cursor-chip"));
    expect(chip).not.toContain("faceMark");
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

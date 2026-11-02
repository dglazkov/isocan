import { describe, expect, it } from "vitest";
import { findCommandSpans } from "../src/index.ts";

/**
 * **A message that ran something should say so.**
 *
 * `/anatomy` followed by a path rendered as plain text: the one word saying
 * work was asked for looked like every other word, and there was nothing to
 * click to find out what it does. A mention has been a chip for months; a
 * command is the same kind of thing — a reference to something the canvas
 * knows about — and was not.
 *
 * The rule lives in core because it is a fact about a body, and both surfaces
 * read bodies. What is tested here is the two halves that keep it from
 * chipping things that are not commands: it must be a verb this canvas
 * actually has, and it must start a line.
 */
const VERBS = ["anatomy", "rc", "rc end", "sprint"];

describe("finding the commands in a message", () => {
  it("finds one on its own line", () => {
    expect(findCommandSpans("/anatomy", VERBS)).toEqual([{ start: 0, end: 8, name: "anatomy" }]);
  });

  it("finds one with its arguments after it", () => {
    const [span] = findCommandSpans("/anatomy ~/code/isocan", VERBS);
    expect(span).toEqual({ start: 0, end: 8, name: "anatomy" });
    // And the path after it is left alone, slashes and all — it is an
    // argument, not three more commands.
    expect(findCommandSpans("/anatomy ~/code/isocan", VERBS)).toHaveLength(1);
  });

  it("prefers the longer verb, so `/rc end` is one command and not two", () => {
    expect(findCommandSpans("/rc end", VERBS)).toEqual([{ start: 0, end: 7, name: "rc end" }]);
  });

  it("ignores a verb this canvas does not have", () => {
    // A chip that offers to open something absent is worse than no chip: the
    // module may not be loaded here, and the palette would have nothing.
    expect(findCommandSpans("/anatomy", ["sprint"])).toEqual([]);
    expect(findCommandSpans("/nonsense", VERBS)).toEqual([]);
  });

  it("ignores a slash that is not starting a line", () => {
    // The three ways this would otherwise chip ordinary prose.
    expect(findCommandSpans("and/or", ["or"])).toEqual([]);
    expect(findCommandSpans("see http://x/anatomy for more", VERBS)).toEqual([]);
    expect(findCommandSpans("the path is ~/code/anatomy", VERBS)).toEqual([]);
  });

  it("ignores a verb that is only a prefix of the word written", () => {
    // `/rcfoo` is not `/rc`, and treating it as one would chip the wrong span.
    expect(findCommandSpans("/rcfoo", VERBS)).toEqual([]);
    expect(findCommandSpans("/anatomys", VERBS)).toEqual([]);
  });

  it("finds one per line in a message that ran several", () => {
    const spans = findCommandSpans("/anatomy ~/code/isocan\n/sprint", VERBS);
    expect(spans.map((one) => one.name)).toEqual(["anatomy", "sprint"]);
  });

  it("returns nothing for a body with no commands, and does not crash on an empty one", () => {
    expect(findCommandSpans("just talking", VERBS)).toEqual([]);
    expect(findCommandSpans("", VERBS)).toEqual([]);
    expect(findCommandSpans("/anatomy", [])).toEqual([]);
  });
});

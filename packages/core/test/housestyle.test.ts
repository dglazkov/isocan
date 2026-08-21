import { describe, expect, it } from "vitest";
import {
  HOUSE_STYLE_ROLE,
  SLOP_RULES,
  houseStyle,
  houseStyleProperties,
  isHouseStyle,
  slopRulesAsText,
  type CanvasState,
} from "../src/index.ts";

const ACTOR = { id: "usr_1", name: "Di" };
const item = (id: string, props: Record<string, string>, updatedAt = "2026-08-21T10:00:00.000Z") => ({
  id, x: 0, y: 0, width: 10, height: 10, title: id, description: "", properties: props,
  versions: [{ id: `v_${id}`, blobHash: "h", mimeType: "text/markdown", filename: "style.md", size: 1, createdAt: updatedAt, createdBy: ACTOR }],
  currentVersionId: `v_${id}`, createdAt: updatedAt, createdBy: ACTOR, updatedAt, updatedBy: ACTOR,
});
const canvas = (items: ReturnType<typeof item>[]): CanvasState => ({
  items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {}, trash: [],
});

describe("the house style", () => {
  it("is an ordinary item wearing one property", () => {
    const styled = item("a", houseStyleProperties());
    expect(isHouseStyle(styled)).toBe(true);
    expect(styled.properties.role).toBe(HOUSE_STYLE_ROLE);
  });

  it("is not every markdown file on the canvas", () => {
    expect(isHouseStyle(item("a", {}))).toBe(false);
    expect(isHouseStyle(item("a", { role: "spec" }))).toBe(false);
  });

  it("is found on a canvas that has one, and null on one that does not", () => {
    expect(houseStyle(canvas([item("a", {}), item("b", houseStyleProperties())]))?.id).toBe("b");
    expect(houseStyle(canvas([item("a", {})]))).toBeNull();
  });

  it("takes the most recently updated when somebody made two", () => {
    // Two is a mistake, not a feature; the newest is the likelier answer to
    // "which one is real".
    const old = item("old", houseStyleProperties(), "2026-08-01T10:00:00.000Z");
    const now = item("now", houseStyleProperties(), "2026-08-21T10:00:00.000Z");
    expect(houseStyle(canvas([now, old]))?.id).toBe("now");
    expect(houseStyle(canvas([old, now]))?.id).toBe("now");
  });
});

describe("the tells of a machine-made interface", () => {
  it("every rule says how to SPOT it, or an agent reports a vibe", () => {
    for (const rule of SLOP_RULES) {
      expect(rule.spot.length, rule.name).toBeGreaterThan(20);
      expect(rule.instead.length, rule.name).toBeGreaterThan(20);
      // The failure mode is a vibe, so name it: "looks generic" and "feels
      // cluttered" cannot be pointed at in a file. A CSS declaration is one
      // good answer and a list of literal words to search for is another, so
      // the check is on what must NOT be there rather than on a syntax.
      expect(rule.spot, rule.name).not.toMatch(/\b(looks?|feels?|seems?|appears?)\b/i);
    }
  });

  it("names each tell once", () => {
    expect(new Set(SLOP_RULES.map((r) => r.name)).size).toBe(SLOP_RULES.length);
  });

  it("renders as a numbered list an agent can work through", () => {
    const text = slopRulesAsText();
    expect(text.split("\n")).toHaveLength(SLOP_RULES.length);
    expect(text).toContain("spot it:");
  });

  it("is worth having at all", () => {
    expect(SLOP_RULES.length).toBeGreaterThanOrEqual(12);
  });
});

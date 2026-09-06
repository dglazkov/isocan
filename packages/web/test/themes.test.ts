import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **A colour outside the stylesheet.**
 *
 * `tokens.test.ts` holds the line inside `styles.css`: every colour is a
 * token, every token has a value in both blocks. This covers the place a
 * colour can still be theme-blind after that check is green — **an SVG
 * presentation attribute takes no `var()`**, so `stroke="#fff"` in a component
 * is a colour no theme can move, and no test that reads the stylesheet can
 * see it.
 *
 * Written on 24 August on a branch that never landed, and recovered on 6
 * September. It found three live ones on `main` the day it was recovered: the
 * remote cursor's outline and the local one's, white in both themes, which is
 * the panel in light and a hard halo on graphite; and the minimap's viewport
 * rectangle in the LIGHT accent, measured 2.25:1 on the dark ground.
 *
 * **And a fourth that the original could not see**, which is why the matcher
 * grew a second pass. It looked for a hex after `stroke=` with no quote in
 * between — so it caught `stroke="#fff"` and was blind to
 * `stroke={cond ? "#1f3fd0" : "#fff"}`, where the colours live inside quotes
 * inside a JSX expression. Three of four is lesson #27's shape: a check that
 * enumerates the forms of a defect has to enumerate all of them.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "..", "src");
describe("no component paints a colour the theme cannot move", () => {
  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return walk(full);
      return /\.tsx?$/.test(e.name) ? [full] : [];
    });
  }

  /** `fill="#c6c9c0"`, `style={{ color: "#fff" }}`, and the rest of the family. */
  const PAINT_PROPS =
    "fill|stroke|stopColor|floodColor|lightingColor|color|background|backgroundColor|" +
    "borderColor|outlineColor|boxShadow|textShadow|caretColor";

  /** A colour written straight into the attribute: `stroke="#fff"`. */
  const PAINTS = new RegExp(
    `\\b(${PAINT_PROPS})\\s*[:=]\\s*[{("'\`][^"'\`\\n]*?(#[0-9a-fA-F]{3,8}\\b|\\brgba?\\()`,
    "g",
  );

  /**
   * A colour written INSIDE a JSX expression:
   * `stroke={followed ? "#1f3fd0" : "#fff"}`.
   *
   * The pass above cannot see these, and not by accident — it forbids a quote
   * between the property and the hex, so a colour that lives inside quotes
   * inside braces is invisible to it. That is how the original found three of
   * the four literals on `main` and reported clean about the fourth, which
   * carried two colours on one line.
   */
  const PAINTS_IN_EXPRESSION = new RegExp(
    `\\b(${PAINT_PROPS})\\s*=\\s*\\{[^}]*?(#[0-9a-fA-F]{3,8}\\b|\\brgba?\\()`,
    "g",
  );

  it("finds the source at all", () => {
    expect(walk(src).length).toBeGreaterThan(20);
  });

  /** Ink chosen for a foreign palette, not paint on ours. See above. */
  const ALLOWED = new Set(["lib/designview.ts"]);

  it("declares no hex or rgb() literal where it paints", () => {
    const offenders: string[] = [];
    for (const file of walk(src)) {
      const rel = path.relative(src, file).split(path.sep).join("/");
      if (ALLOWED.has(rel)) continue;
      // Comments blanked to their own newlines, so a line number still points
      // at the real line — the same trick tokens.test.ts uses on the CSS.
      const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) =>
        m.replace(/[^\n]/g, " "),
      );
      text.split("\n").forEach((line, i) => {
        for (const re of [PAINTS, PAINTS_IN_EXPRESSION]) {
          for (const m of line.matchAll(re)) offenders.push(`${rel}:${i + 1} ${m[0].trim()}`);
        }
      });
    }
    expect(
      offenders,
      "a literal here cannot move with the theme — SVG presentation attributes " +
        "take no var(), so give the element a class and colour it in styles.css",
    ).toEqual([]);
  });
});

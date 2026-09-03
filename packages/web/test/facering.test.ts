import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { faceMarkClass } from "../src/lib/face.ts";

const src = fileURLToPath(new URL("../src", import.meta.url));
const css = readFileSync(path.join(src, "styles.css"), "utf8");

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* files(full);
    else if (/\.tsx$/.test(name)) yield full;
  }
}

/**
 * **An emoji gets a ring, not a disc.** The rule lives in one helper and
 * one CSS class, so a new place that draws a face cannot quietly paint the
 * colour under the mark again: every `.face-mark` in the app is classed by
 * `faceMarkClass` and coloured by `faceMarkStyle`, never by an inline
 * background.
 */
describe("the face's colour rings an emoji and fills behind an initial", () => {
  it("classes a face by whether it wears a mark", () => {
    const actor = { id: "usr_1" };
    expect(faceMarkClass({}, actor)).toBe("face-mark");
    expect(faceMarkClass({ usr_1: "⚓" }, actor)).toBe("face-mark ringed");
    expect(faceMarkClass({ usr_1: "⚓" }, actor, "identity-mark")).toBe("identity-mark face-mark ringed");
  });

  it("paints the ring in CSS from the colour the helper hands over", () => {
    expect(css).toContain("background: var(--face);");
    const ringed = css.slice(css.indexOf(".face-mark.ringed {"));
    expect(ringed).toContain("background: var(--card);");
    expect(ringed).toContain("border-color: var(--face);");
  });

  it("is how every face in the app is drawn — no inline background on a face-mark", () => {
    const offenders: string[] = [];
    for (const file of files(src)) {
      const text = readFileSync(file, "utf8");
      if (/className="[^"]*face-mark[^"]*"\s+style=\{\{\s*background/.test(text)) offenders.push(path.relative(src, file));
      if (/className="face-mark"\s*style=/.test(text)) offenders.push(path.relative(src, file));
    }
    expect(offenders, "draw a face with faceMarkClass / faceMarkStyle from lib/face.ts").toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decisions, lessons, render } from "../scripts/decisions.mjs";

/**
 * `docs/decisions.md` is a VIEW of the `**Dn.**` lines in the designs and the
 * numbered rows of `docs/reviews/lessons.md`, like `docs/ROADMAP.md` is of
 * front matter.
 *
 * **TR-3, 27 Sep 2026.** The generator had a `--check`, and nothing ran it: the
 * page said 88 lessons while `lessons.md` carried 93, so the one index meant
 * to answer "did we already decide this?" was quietly answering for an older
 * repo. This runs the same render in process — the rule it guards, imported,
 * not a spawn of the script or a copy of its regexes — on every `npm test`.
 */
const page = readFileSync(fileURLToPath(new URL("../docs/decisions.md", import.meta.url)), "utf8");

describe("the decisions page is derived, and current", () => {
  it("finds decisions and lessons at all — a view of nothing is always current", () => {
    expect(decisions().length, "no **Dn.** lines found — the parser is wrong").toBeGreaterThan(50);
    expect(lessons().length, "no lessons found — the parser is wrong").toBeGreaterThan(90);
  });

  it("is what the generator would write — run `node scripts/decisions.mjs`", () => {
    expect(render(page).next === page, "docs/decisions.md is stale — run `node scripts/decisions.mjs`").toBe(
      true,
    );
  });

  it("states the lesson count lessons.md actually has", () => {
    // The finding, named: the number on the page is the number in the file.
    const stated = /and (\d+) lessons\.\*\*/.exec(page)?.[1];
    expect(Number(stated)).toBe(lessons().length);
  });
});

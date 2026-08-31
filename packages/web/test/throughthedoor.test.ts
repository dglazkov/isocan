import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **A daemon route is spelled in exactly one file, and that file knocks on
 * the door.**
 *
 * `request` is not a convenience wrapper. It is the only place that knows a
 * 401 is recoverable — go to the door, be handed a badge, re-claim the
 * persona this tab is wearing, replay the request — and the only place that
 * knows a `not-your-actor` means the CLAIM went missing rather than the
 * badge. A hand-written route knows none of that. It takes the refusal and
 * hands it to a caller written for an entirely different question.
 *
 * **The damage is that it does not look like damage.** A 401 on the oplog is
 * a lens where an agent did nothing. On `/backing` it is every file mark
 * quietly leaving the canvas. On `/personas` it is "you have no personas". On
 * the ＋ it is a button that does nothing, twice. Each is a wrong answer
 * wearing a true answer's face, on a surface that already knows how to say
 * "there is nothing here" for perfectly good reasons — which is why none of
 * them was ever reported as a bug, and why a guard is worth more here than
 * anywhere the failure would be loud.
 *
 * This is the repo-wide version of a rule that lived on the lens page alone.
 * It was written there because that is where the mistake was made that day,
 * and it could only ever catch it there: seven more routes were hand-written
 * in five other files while that guard sat green.
 */
const SRC = fileURLToPath(new URL("../src", import.meta.url));

/**
 * **The api lib is the allowlist, and it is one file long.**
 *
 * Not an exemption — it is the door. `request` lives there, and so do the two
 * calls that cannot use it because they do not speak json (`uploadBlob` sends
 * bytes, `readBoundFile` receives them); both spell the 401 recovery out by
 * hand, in that file, where the next reader meets all three together.
 */
const HOME = "lib/api.ts";

/**
 * The rule is about the SPELLING, not about `fetch`, and deliberately so.
 *
 * A dozen calls read blob bytes with a bare `fetch(blobUrl(...))`, and they
 * are not what this is for: the route is still spelled once, in the api lib,
 * and those calls want bytes rather than json. Asking about `fetch` instead
 * would have to allowlist all of them and would still miss a route built into
 * a variable, passed to a helper, or dropped into an `src=`. Every one of
 * those is a second place that knows the URL, which is the thing that goes
 * wrong.
 */
const ROUTE = /["'`]\/api\//;

/** Code, numbered from 1, with comments blanked out — prose ABOUT the rule is
 *  not a breach of it, and half these route names appear in comments
 *  explaining exactly why they live where they do. Blanking rather than
 *  dropping, so a line number still points where a reader can look. */
function codeLines(rel: string): Array<[number, string]> {
  return readFileSync(`${SRC}/${rel}`, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/\/\/.*$/gm, "")
    .split("\n")
    .map((line, i): [number, string] => [i + 1, line]);
}

const files = readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter(
  (rel) => (rel.endsWith(".ts") || rel.endsWith(".tsx")) && rel !== HOME,
);

describe("the app talks to its daemon through one door", () => {
  it("spells a daemon route nowhere but the api lib", () => {
    const offenders = files.flatMap((rel) =>
      codeLines(rel)
        .filter(([, line]) => ROUTE.test(line))
        .map(([n, line]) => `src/${rel}:${n} — ${line.trim()}`),
    );
    expect(
      offenders,
      "one route, one spelling, one place: put it in lib/api.ts and call it from here",
    ).toEqual([]);
  });

  it("scans the whole app, not one page of it", () => {
    /* The rule this replaced read a single file, which is how it stayed green
       through seven hand-written routes. A walk that stopped finding the app
       would pass by finding nothing, and pass forever. */
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain("pages/LensPage.tsx");
    expect(files).toContain("components/WbFiles.tsx");
    expect(files).toContain("stores/canvasStore.ts");
  });

  it("reads prose as prose, and the line after it as code", () => {
    /* The first version of this guard stripped comments by LINE PREFIX and
       failed on `LensPage`, where the sentence explaining this very rule
       wraps onto a line beginning with a word. Prose about a route is not a
       route. The other half matters just as much: a whole-file regex is the
       sort of thing that eats the line after the comment it was aiming at,
       and a guard that blanks the app passes forever. */
    const lens = codeLines("pages/LensPage.tsx");
    expect(lens.filter(([, line]) => ROUTE.test(line))).toEqual([]);
    expect(lens.some(([, line]) => line.includes("await listCanvases()"))).toBe(true);
  });
});

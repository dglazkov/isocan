import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATED } from "../scripts/mergegen.mjs";

/**
 * **The generated docs were the most conflicted files in the repository.**
 *
 * In the fortnight to 13 September, 512 commits reached `main` and 300 of them
 * touched a file nobody writes by hand: `docs/ROADMAP.md` 157 times,
 * `docs/projects/README.md` 77, `docs/changelog/README.md` 38,
 * `docs/reviews/README.md` 28. Every rebase across any of those stopped on a
 * conflict in a file whose contents are a pure function of other files, and
 * somebody resolved it by hand — usually by taking one side and regenerating,
 * which is the only correct answer and not one git knows how to reach.
 *
 * So `.gitattributes` sends them to a merge driver that regenerates.
 *
 * The arrangement has three separable halves and they can drift apart
 * silently: the attributes file naming a driver, the driver knowing how to
 * make each file, and `prepare.mjs` registering the driver at all. A file
 * listed in one and missing from another simply falls back to the ordinary
 * merge — no error, and nobody notices until the conflicts come back.
 */
const repo = fileURLToPath(new URL("..", import.meta.url));
const read = (rel: string): string => readFileSync(path.join(repo, rel), "utf8");
const attributes = read(".gitattributes");
const DRIVER = "isocan-generated";

describe("generated docs are regenerated at a conflict, not merged", () => {
  const routed = [...attributes.matchAll(new RegExp(`^(\\S+) merge=${DRIVER}$`, "gm"))].map((m) => m[1]!);

  it("routes files to the driver at all — an empty list always passes", () => {
    expect(routed, "no file is routed; the attributes file has stopped working").toContain("docs/ROADMAP.md");
    expect(routed.length).toBeGreaterThan(1);
  });

  it("knows how to make each file it claims", () => {
    const unknown = routed.filter((file) => !(file in GENERATED));
    expect(
      unknown,
      "routed to the driver with no generator: the driver keeps ours and the file goes stale",
    ).toEqual([]);
  });

  it("routes every file it knows how to make", () => {
    const unrouted = Object.keys(GENERATED).filter((file) => !routed.includes(file));
    expect(unrouted, "a generator with no attributes line still conflicts by hand").toEqual([]);
  });

  it("names generators that exist and files that exist", () => {
    for (const [file, generator] of Object.entries(GENERATED)) {
      expect(existsSync(path.join(repo, file)), `${file} is routed but absent`).toBe(true);
      for (const part of generator) {
        expect(existsSync(path.join(repo, part)), `${file}'s generator ${part} is absent`).toBe(true);
      }
    }
  });

  it("is registered by prepare, which every install runs", () => {
    // In `install-hooks.mjs` it would be opt-in, and this is not worth
    // remembering: a clone without the driver silently goes back to resolving
    // three hundred conflicts a fortnight by hand.
    const prepare = read("scripts/prepare.mjs");
    expect(prepare).toContain(`merge.${DRIVER}.driver`);
    expect(prepare).toContain(`merge.${DRIVER}.name`);
    expect(prepare, "before the early return, or a built checkout never gets it").toMatch(
      /registerMergeDriver\(\);\s*\n\s*\n?if \(existsSync\(built\)\)/,
    );
  });

  it("exits 0 even when it cannot regenerate — a stopped rebase is worse than a stale file", () => {
    const out = execFileSync(
      process.execPath,
      [path.join(repo, "scripts/mergegen.mjs"), "docs/not-a-generated-file.md", "/dev/null"],
      { cwd: repo, encoding: "utf8", timeout: 60_000 },
    );
    expect(out).toBe("");
  });
});

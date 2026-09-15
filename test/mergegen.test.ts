import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATED } from "../scripts/mergegen.mjs";
import { withoutComments } from "./source.ts";

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
    // Was `> 1` when three files were routed. Two of them turned out not to be
    // generated at all (the case below), and a count is the wrong shape for
    // this check anyway: what it guards is that the attributes file still
    // works, which one known entry proves. A number here would fail the day
    // somebody correctly removes a file, which is exactly what happened.
    expect(routed.length).toBeGreaterThanOrEqual(1);
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

  /**
   * **The fourth half, added after the driver let one through.**
   *
   * The driver is lenient by design — it never fails a merge. Its blind spot
   * is not leniency but timing: mid-rebase it runs the generator against a
   * working tree that does not yet hold the other paths of the commit being
   * replayed, so a commit that ADDS a doc gets its roadmap generated without
   * that doc, cleanly, silently, inside the commit. That is ddc62eb4 on
   * 14 Sep 2026, and `main` went red on `test/roadmap.test.ts`.
   *
   * `scripts/hooks/pre-push` runs the same check before the push instead of
   * after it. It is a shell script, so it carries its own copy of the list —
   * which is a fourth thing that can drift from the other three.
   */
  it("is checked again by the pre-push hook, over the same list", () => {
    const hook = read("scripts/hooks/pre-push");
    for (const [file, generator] of Object.entries(GENERATED)) {
      expect(hook, `pre-push does not check ${file}`).toContain(`${file}:${generator[0]}`);
    }
    // And it claims nothing the driver does not know how to make.
    const claimed = [...hook.matchAll(/"(\S+?):(\S+?)"/g)].map((m) => m[1]!);
    expect(claimed.filter((file) => !(file in GENERATED))).toEqual([]);
  });

  /**
   * **The half nobody checked: does the generator actually write the file?**
   *
   * The driver copies the regenerated file over git's merge result. For a file
   * that is derived WHOLE that is the right answer and the point of the
   * driver. For a file that is only partly derived — or not derived at all —
   * it is silent data loss: the incoming side of the merge is replaced by
   * whatever is on disk, which during a rebase is the side being replayed
   * ONTO, so the replayed change simply disappears. Exit 0, no conflict,
   * nothing in `git status`.
   *
   * `docs/projects/README.md` and `docs/reviews/README.md` were both listed as
   * generated and neither is written by the generator named beside it: the
   * projects index has been hand-written since the status column moved into
   * each project's front matter. Between them they ate the same index row
   * twice on 15 September 2026, and it was found by noticing a row missing
   * from a file `git status` called clean.
   *
   * The other three cases here check that the halves AGREE about which files
   * are generated. This one checks that the claim is true of the file.
   */
  it("names generators that actually write the file they claim", () => {
    /**
     * Read, not run. Two earlier versions of this case touched the real tree —
     * one wrote a marker into `docs/ROADMAP.md` and restored stale bytes, the
     * other regenerated it — and both made `roadmap.test.ts` go red beside
     * them, because a guard that exercises a generator races the guard that
     * checks that generator's output. A file's own source is enough: a script
     * that writes a path names that path.
     */
    for (const [file, generator] of Object.entries(GENERATED)) {
      for (const script of generator) {
        const source = withoutComments(readFileSync(path.join(repo, script), "utf8"));
        expect(
          source,
          `${file} is routed to the regenerating merge driver, but \`${script}\` never writes ` +
            "it — the path does not appear in its code. The driver copies the on-disk file over " +
            "git's merge result, so the incoming side of every merge is silently discarded; that " +
            "is lessons.md #85. Remove it from GENERATED and `.gitattributes`, or make the " +
            "generator write it whole.",
        ).toContain(file);
      }
    }
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

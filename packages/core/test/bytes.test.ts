import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { formatBytes } from "../src/bytes.ts";

/**
 * Step 3 of `docs/research/2026-09-06-architecture-review.md`.
 *
 * The note's argument for moving this is not "it is duplicated" — it is that
 * the duplication **had already drifted**, and the drift hands the move its
 * test: *"assert the terabyte, and the guard fails today."* So the terabyte
 * case is first, because it is the one that was wrong.
 */

describe("a size, said the way a person would", () => {
  it("knows about terabytes — the case the web's copy got wrong", () => {
    // THE REGRESSION. `web/components/TrashPanel.tsx` stopped its units at GB,
    // so a two-terabyte trash total printed `2048.0 GB` in the browser and
    // `2.0 TB` in the terminal. One question, two answers, sitting in the tree
    // until an architecture review counted the units.
    expect(formatBytes(2 * 1024 ** 4)).toBe("2.0 TB");
    expect(formatBytes(1024 ** 4)).toBe("1.0 TB");
    // And it does not run out again one unit later: past a thousand terabytes
    // the value keeps climbing in TB rather than silently becoming nonsense.
    expect(formatBytes(2048 * 1024 ** 4)).toBe("2048 TB");
  });

  it("says bytes whole, and never as a fraction of a kilobyte", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1)).toBe("1 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("crosses each unit at 1024, not 1000", () => {
    // Blob sizes on a disk, so binary. The labels stay the everyday ones
    // because that is what the rest of the interface says.
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 ** 2)).toBe("1.0 MB");
    expect(formatBytes(1024 ** 3)).toBe("1.0 GB");
  });

  it("drops the decimal at three digits, where it stops being information", () => {
    expect(formatBytes(Math.round(99.4 * 1024))).toBe("99.4 KB");
    expect(formatBytes(Math.round(101 * 1024))).toBe("101 KB");
    expect(formatBytes(Math.round(847.3 * 1024 ** 2))).toBe("847 MB");
  });

  it("is the only copy — nothing reimplements it", () => {
    // House rule 4, as a guard rather than a hope: this is the fold that
    // drifted once, and a second copy is how it drifts again. The two files
    // that used to hold one each are named, so a re-introduction is caught
    // where it happened rather than anywhere.
    for (const file of [
      "../../cli/src/output.ts",
      "../../web/src/components/TrashPanel.tsx",
    ]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source, `${file} defines formatBytes again`).not.toMatch(
        /function formatBytes\s*\(/,
      );
    }
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defaultSize, mimeFromName } from "../src/index.ts";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
const read = (rel: string) => readFileSync(`${repo}${rel}`, "utf8");

/**
 * Step 4 of `docs/research/2026-09-06-architecture-review.md`. The table, the
 * order it is consulted in, and `defaultSize` were written out twice — once
 * per surface — which is the shape a fact takes just before the two copies
 * stop agreeing. `formatBytes` (step 3) is what that looks like once it has
 * actually happened: the CLI's units reached terabytes and the web's stopped
 * at gigabytes, so a big enough number read "1024 GB".
 */
describe("what a file is", () => {
  it("answers from the extension, and says nothing rather than guessing", () => {
    expect(mimeFromName("notes.md")).toBe("text/markdown");
    expect(mimeFromName("SHOT.PNG"), "extensions are not case-sensitive").toBe("image/png");
    expect(mimeFromName("clip.mov")).toBe("video/quicktime");
    // Undefined, not a default: the CLI has nothing else to go on and the
    // browser still has file.type, so the last resort belongs to the caller.
    expect(mimeFromName("mystery.zzz")).toBeUndefined();
    expect(mimeFromName("Makefile")).toBeUndefined();
  });

  it("gives both surfaces the same size for the same file", () => {
    // The CLI's answer for a file it cannot measure, and the web's fallback
    // when the browser will not decode one. A photo added from the terminal
    // and the same photo dropped on the canvas land the same size.
    expect(defaultSize("image/png")).toEqual({ width: 480, height: 360 });
    expect(defaultSize("video/mp4")).toEqual({ width: 480, height: 270 });
    expect(defaultSize("text/markdown")).toEqual({ width: 420, height: 320 });
  });
});

describe("the two entry points stay two", () => {
  /**
   * The review proposed one canonical `mimeFor`, and that would be a
   * regression dressed as tidying: `mimeTypeOf` starts from `file.type` and
   * uses the table only as a patch, while `mimeFor` has nothing else at all.
   * What is shared is the TABLE, not the signature.
   */
  it("keeps the browser's own answer ahead of the table", () => {
    const web = read("/packages/web/src/lib/mime.ts");
    expect(web, "the browser is asked first").toMatch(/if \(file\.type[^)]*\) return file\.type;/);
  });

  it("holds no table or size of its own on either surface", () => {
    // The guard that names where the copies used to live, so a
    // re-introduction is caught in the file it happened in — the shape step 3
    // used for formatBytes.
    for (const rel of ["/packages/web/src/lib/mime.ts", "/packages/cli/src/mime.ts", "/packages/web/src/lib/upload.ts"]) {
      const src = read(rel);
      expect(src, `${rel} spells out a mime table again`).not.toMatch(/"text\/markdown"|"image\/png"/);
      expect(src, `${rel} spells out a default size again`).not.toMatch(/width: 480, height: 360|width: 420, height: 320/);
    }
  });

  it("asks a loaded module before the table, on both surfaces at once", () => {
    // The ORDER is the shared fact, not an implementation detail: two copies
    // of it is how one surface keeps calling a file a diagram after the other
    // has stopped. It lives in core, so there is one.
    const core = read("/packages/core/src/media.ts");
    const moduleFirst = core.indexOf("moduleKinds");
    const tableAfter = core.indexOf("BY_EXT[ext]");
    expect(moduleFirst).toBeGreaterThan(-1);
    expect(moduleFirst, "a module's extensions must be asked first").toBeLessThan(tableAfter);
    for (const rel of ["/packages/web/src/lib/mime.ts", "/packages/cli/src/mime.ts"]) {
      expect(read(rel), `${rel} consults moduleKinds itself`).not.toContain("moduleKinds");
    }
  });
});

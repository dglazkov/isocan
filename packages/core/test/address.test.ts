import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CANVAS_PATH_PREFIX, CANVAS_ROUTE, canvasPath, canvasUrl } from "../src/address.ts";

/**
 * **One spelling of a canvas's address.**
 *
 * The bug this guards against was measured, not imagined: the docs wrote
 * `isocan.io/c/7f3a…`, the app served `/p/:projectId`, and nothing anywhere
 * reconciled them — so a doc-shaped share link returned 200, served the app
 * shell, matched no route, and rendered a **blank page**. Dimitri settled the
 * address on 2026-08-23 (keep `/p/`, fix the docs) and left the underlying
 * canvas-versus-project rename deliberately open.
 *
 * The settlement is only worth as much as the thing that keeps it true. So:
 * the prefix has exactly one definition, and the second test is a lint that
 * fails the build if anybody builds a canvas URL by hand again — in either
 * client, in either spelling.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");

describe("a canvas's address", () => {
  it("is /p/, and the router pattern is built from the same prefix", () => {
    expect(CANVAS_PATH_PREFIX).toBe("/p");
    expect(CANVAS_ROUTE).toBe("/p/:projectId");
    expect(canvasPath("prj_acme")).toBe("/p/prj_acme");
  });

  it("joins an origin without doubling or dropping the slash", () => {
    expect(canvasUrl("https://isocan.io", "prj_acme")).toBe("https://isocan.io/p/prj_acme");
    // A home address read out of a config file very often has a trailing
    // slash, and `https://isocan.io//p/…` is a different URL to a router.
    expect(canvasUrl("https://isocan.io/", "prj_acme")).toBe("https://isocan.io/p/prj_acme");
    expect(canvasUrl("http://127.0.0.1:4441", "prj_acme")).toBe("http://127.0.0.1:4441/p/prj_acme");
  });

  it("is never hand-spelled anywhere else in the source", () => {
    // The forcing function. `/c/${id}` is the shape that shipped as a blank
    // page; `/p/${id}` is the shape that works and would drift the moment
    // somebody changed their mind in one file. Both are refused here — build
    // the address from `canvasPath`/`canvasUrl`, or change this file too.
    const offenders: string[] = [];
    for (const file of sourceFiles(repo)) {
      // Except the one definition, which has to write the shape down to be it
      // (and whose comment tells the story of why).
      if (file.endsWith(path.join("core", "src", "address.ts"))) continue;
      const text = readFileSync(file, "utf8");
      for (const [i, line] of text.split("\n").entries()) {
        if (/["'`]\/[pc]\/(\$\{|:|<)/.test(line)) {
          offenders.push(`${path.relative(repo, file)}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(
      offenders,
      `build canvas addresses with canvasPath()/canvasUrl() from @isocan/core:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

/** Every `.ts`/`.tsx` under the workspaces' `src` directories. */
function sourceFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "dist") continue;
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry)) found.push(full);
    }
  };
  for (const pkg of readdirSync(path.join(root, "packages"))) {
    const src = path.join(root, "packages", pkg, "src");
    try {
      if (statSync(src).isDirectory()) walk(src);
    } catch {
      // A workspace without a src directory: nothing to lint.
    }
  }
  return found;
}

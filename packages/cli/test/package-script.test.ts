import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { INSTALL_SPEC } from "@isocan/core";
import { runPackageScript } from "../src/package-script.ts";

/**
 * **A script a CLI verb spawns fails in words** (cleanup phase 4, DC-1, 27 Sep
 * 2026).
 *
 * `isocan canvas shot` and the deck's PDF export spawn a script of this copy's
 * own. On every install from 18 Sep that script could not start —
 * ERR_MODULE_NOT_FOUND — and what the person read was Node's stack trace and
 * then "the screenshot did not land (exit 1)", a sentence about a picture
 * when the fault was the install. These are synthetic scripts written into a
 * scratch directory, one per way a spawn goes wrong.
 */

const scratch = mkdtempSync(path.join(os.tmpdir(), "isocan-package-script-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

function script(name: string, source: string): string {
  const file = path.join(scratch, name);
  writeFileSync(file, source);
  return file;
}

describe("runPackageScript", () => {
  it("says the install is missing a module, and how to repair it, when the script cannot start", () => {
    const file = script("cannot-start.mjs", 'import "acme-not-installed";\n');
    expect(() => runPackageScript(file, [], { what: "the screenshot", quiet: true })).toThrow(
      /the screenshot could not start: acme-not-installed is missing from this copy of isocan/,
    );
    expect(() => runPackageScript(file, [], { what: "the screenshot", quiet: true })).toThrow(INSTALL_SPEC);
  });

  it("names the file it needs when the copy does not have it", () => {
    const file = path.join(scratch, "not-here.mjs");
    expect(() => runPackageScript(file, [], { what: "the export" })).toThrow(/the export needs .*not-here\.mjs/);
  });

  it("keeps what the script said when it ran and failed, rather than only its exit code", () => {
    const file = script("fails.mjs", 'console.error("Acme deck has no slides"); process.exit(3);\n');
    expect(() => runPackageScript(file, [], { what: "the export", quiet: true })).toThrow(
      /the export did not land \(exit 3\): Acme deck has no slides/,
    );
  });

  it("hands the script the daemon it was asked to use, so the CLI it spawns in turn uses it too", () => {
    // `canvas shot --into` spawns `isocan edit` from inside the script. With
    // `--port 4467` on the outer command and nothing handed down, that `edit`
    // knocked on the default port — another daemon, another home — and said
    // "canvas not found" (found by the install walk, 27 Sep 2026).
    const out = path.join(scratch, "port.txt");
    const file = script(
      "port.mjs",
      'import { writeFileSync } from "node:fs";\nwriteFileSync(process.argv[2], process.env.ISOCAN_PORT ?? "unset");\n',
    );
    runPackageScript(file, [out], { what: "the port", quiet: true, env: { ISOCAN_PORT: "4467" } });
    expect(readFileSync(out, "utf8")).toBe("4467");
  });

  it("passes its arguments and stdin through, and succeeds quietly", () => {
    const out = path.join(scratch, "echo.txt");
    const file = script(
      "echo.mjs",
      'import { readFileSync, writeFileSync } from "node:fs";\n' +
        "writeFileSync(process.argv[2], readFileSync(0, \"utf8\"));\n",
    );
    runPackageScript(file, [out], { what: "the echo", input: "Acme", quiet: true });
    expect(readFileSync(out, "utf8")).toBe("Acme");
  });
});

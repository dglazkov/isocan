import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInBrowser } from "../src/browser.ts";

/**
 * **A test run must not put windows on somebody's screen**, and the way to be
 * sure is not to remember: one opener, one switch, and a guard that no second
 * spelling appears. The operator verbs of 12–13 September are why this file
 * exists — they spawned `open` directly and a suite run started opening tabs.
 */
const cli = fileURLToPath(new URL("..", import.meta.url));

describe("the browser is opened in one place, and can be told not to", () => {
  it("does not spawn when ISOCAN_BROWSER is none — which is what the suite sets", () => {
    expect(process.env["ISOCAN_BROWSER"], "test/setup.ts should have set this").toBe("none");
    // If this spawned, the run would show it: `open` on a bad URL is still a
    // window. The assertion is that the call returns having done nothing.
    expect(() => openInBrowser("https://example.test/should-not-open")).not.toThrow();
  });

  it("is the only place that knows how to open one", async () => {
    const offenders: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else if (/\.ts$/.test(entry.name) && entry.name !== "browser.ts") {
          const body = await fs.readFile(full, "utf8");
          if (/["']xdg-open["']/.test(body)) offenders.push(path.relative(cli, full));
        }
      }
    };
    await walk(path.join(cli, "src"));
    expect(offenders, "call openInBrowser instead — it honours ISOCAN_BROWSER").toEqual([]);
  });
});

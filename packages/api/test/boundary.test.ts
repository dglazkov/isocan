import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **The seam, held as a fact rather than an intention** (iso-api phase 1).
 *
 * The design's central claim is that the API and the CLI's middle layer are
 * the same code, separable along one line: `@isocan/api` owns the Node client,
 * and the CLI is that client plus argv parsing. Two structural assertions keep
 * the line from silting back up — the same move as `address.test.ts`'s "never
 * hand-spelled anywhere else" and `packaging.test.ts`'s boundary sweeps,
 * because a rule that only holds where somebody remembered to look is not a
 * rule.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");

describe("the API/CLI seam", () => {
  it("no file in packages/cli constructs a request to the daemon", () => {
    // The lockstep argument (design.md): after the extraction there is exactly
    // one Node-side spelling of every route, and the CLI consumes it. A
    // `fetch` of an `/api/` path in the CLI would be a second client the day
    // it lands and a drifted one the week after — so no CLI source may quote
    // an `/api/` route, in a string or built into a template. The health
    // probes it still makes go through `healthPath` from core, which is the
    // one spelling of that route for every surface.
    const offenders: string[] = [];
    for (const file of sourceFiles(path.join(repo, "packages", "cli", "src"))) {
      const text = readFileSync(file, "utf8");
      for (const [i, line] of text.split("\n").entries()) {
        const lead = line.trimStart();
        // Doc comments talk ABOUT routes (`GET /api/homes`) and should keep
        // doing so; the rule is about code that would dial one.
        if (lead.startsWith("//") || lead.startsWith("*") || lead.startsWith("/*")) continue;
        if (/(["'`]|\})\/api\//.test(line)) {
          offenders.push(`${path.relative(repo, file)}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(
      offenders,
      `the daemon is spoken to through @isocan/api's DaemonClient, never by hand:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("the typed route surface does not import the Node-only half", () => {
    // The separability both unsolved twists depend on (design.md's lockstep
    // section): a browser build of the transport kernel is only possible while
    // `routes.ts` — and everything it reaches inside this package — stays free
    // of daemon lifecycle. Three tells, each of which is the whole violation:
    // `node:child_process` (spawning is the daemon half's job), a call that
    // spawns, and `homes.json` (the machine record only the daemon reads).
    const src = path.join(repo, "packages", "api", "src");
    const surface = closureOf(path.join(src, "routes.ts"), src);
    expect(surface.map((file) => path.basename(file))).not.toContain("client.ts");
    const offenders: string[] = [];
    for (const file of surface) {
      const text = readFileSync(file, "utf8");
      for (const [i, line] of text.split("\n").entries()) {
        const lead = line.trimStart();
        // The surface's own doc comment names the things it must not do; the
        // rule is about doing them.
        if (lead.startsWith("//") || lead.startsWith("*") || lead.startsWith("/*")) continue;
        if (/node:child_process|\bspawn\s*\(|homes\.json/.test(line)) {
          offenders.push(`${path.relative(repo, file)}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(
      offenders,
      `the route surface must stay separable from daemon lifecycle (client.ts is where that lives):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

/** `entry` plus every api-internal module it transitively imports — relative
 * imports only, because the boundary being tested is within this package. */
function closureOf(entry: string, root: string): string[] {
  const seen = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/from\s+"(\.[^"]+)"/g)) {
      const target = path.resolve(path.dirname(file), match[1]!);
      if (target.startsWith(root)) walk(target);
    }
  };
  walk(entry);
  return [...seen];
}

/** Every `.ts` under a directory, the sweep the house pattern uses. */
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
  walk(root);
  return found;
}

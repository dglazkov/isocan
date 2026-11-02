import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **A relay is waited on until it is current, never for one second.**
 *
 * Four server tests waited for a relay's replica with
 * `expect.poll(() => relay.store.canvasExists(id)).toBe(true)`: vitest's
 * default deadline of ONE second, on the middle of adoption rather than its
 * end. On a loaded `test:deep` run that failed — "Matcher did not succeed in
 * time" — in whichever of them the machine happened to be slowest for
 * (lessons.md #92). `packages/server/test/replica.ts` is the one way to wait
 * now: the home's `lastSeq`, on the replication deadline the home-link tests
 * already used. This reads the test sources so a fifth copy of the old line
 * fails here instead of on somebody's unrelated push.
 */
const root = fileURLToPath(new URL("..", import.meta.url));

function testFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "fixtures") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...testFiles(full));
    else if (/\.test\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("waiting on a relay", () => {
  const files = [path.join(root, "test"), ...readdirSync(path.join(root, "packages")).map((p) => path.join(root, "packages", p, "test"))]
    .filter((dir) => { try { return readdirSync(dir).length >= 0; } catch { return false; } })
    .flatMap(testFiles);

  it("finds test files at all — a search over nothing always passes", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("never polls a relay's store on vitest's default deadline", () => {
    const offenders = files.filter((f) => f !== fileURLToPath(import.meta.url) && /expect\.poll\(\s*\(\)\s*=>\s*relay!?\.store\./.test(readFileSync(f, "utf8")));
    expect(
      offenders.map((f) => path.relative(root, f)),
      "use untilReplicaCurrent from packages/server/test/replica.ts — expect.poll gives up after one second",
    ).toEqual([]);
  });
});

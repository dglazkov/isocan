import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const night = readFileSync(fileURLToPath(new URL("../scripts/night.mjs", import.meta.url)), "utf8");
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")) as { scripts: Record<string, string> };

/**
 * **The morning comment is one comment, three lines, from the night's own
 * actor.** The night-shift note's step 2 — and the budget it names: a
 * morning of forty items is worse than no night shift. These pin the shape
 * so a later "improvement" cannot quietly make the night chatty, or make it
 * speak as the person who launched it.
 */
describe("the night's morning comment", () => {
  it("is its own actor, claimed once, never the person who launched it", () => {
    expect(night).toContain('harness: "night"');
    expect(night).toContain("connect({ identity: NIGHT_IDENTITY })");
    expect(night).toContain("isocan identity --name Night --session");
    // The lane's CLI calls act as Night too.
    expect(night).toContain("ISOCAN_HARNESS: NIGHT_IDENTITY.harness, ISOCAN_SESSION_ID: NIGHT_IDENTITY.session");
  });

  it("runs the lane first, then posts exactly one comment per canvas, and none on a dry run", () => {
    expect(night).toContain('"scripts/converge-night.mjs"');
    expect(night.match(/canvas\.notify\(/g)).toHaveLength(1);
    expect(night).toContain("if (!dry) await canvas.notify(text);");
  });

  it("is three lines with handles, not a report", () => {
    expect(night).toContain("return [first, second, third].join(\"\\n\");");
    expect(night).toContain("#${picked[1]}");
    expect(night).toContain("bringing the previous version back");
  });

  it("is reachable as npm run night", () => {
    expect(pkg.scripts.night).toBe("node scripts/night.mjs");
  });
});

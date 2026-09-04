import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const harness = readFileSync(fileURLToPath(new URL("../scripts/calibrate.mjs", import.meta.url)), "utf8");

/**
 * **A judge is calibrated or not shipped** (evals plan, stage 4). These pin
 * the harness's discipline in its source: the human label comes from the
 * log, the order is shuffled so position teaches nothing, the judge argues
 * against each before it picks and must cite, agreement is reported with κ
 * against the coin the shuffle makes chance into, a dozen comparisons is
 * called a first reading, and nothing is ever written to a canvas.
 */
describe("the calibration harness", () => {
  it("takes its labels from the choices people already made", () => {
    expect(harness).toContain('isoJson(["evals", "pairs", "--canvas", canvasId])');
    expect(harness).toContain("for (const otherId of pair.against)");
  });

  it("shuffles A and B, and measures κ against the coin that shuffle makes chance", () => {
    expect(harness).toContain("const humanIsA = flip();");
    expect(harness).toContain("const kappa = acc === null ? null : 2 * acc - 1;");
  });

  it("asks the judge to refute each before picking, and to cite", () => {
    expect(harness).toContain("first state the strongest case AGAINST each version, citing a specific line, element, colour or word");
    expect(harness).toContain('"because":["<a cited reason>", ...]');
  });

  it("gives the judge Read and nothing else, and writes to no canvas", () => {
    expect(harness).toContain('"--allowedTools", "Read"]');
    expect(harness).not.toMatch(/iso\(\["(edit|add|comment|prop|version|rm|move)"/);
    expect(harness).toContain("NOTHING IS WRITTEN TO ANY CANVAS");
  });

  it("calls fewer than thirty comparisons a first reading, not a calibration", () => {
    expect(harness).toContain("answered.length < 30");
    expect(harness).toContain("**A first reading, not a calibration.**");
  });

  it("reads only a person's choices by default, and never a choice between the same bytes", () => {
    expect(harness).toContain('(pair.chosenByKind === "agent" && !includeAgents) || excluded.has(pair.chosenBy) || excluded.has(pair.chosenById)');
    expect(harness).toContain("if (chosen.blobHash === other.blobHash)");
  });

  it("writes a page either way, dry or not, so a run is a record", () => {
    expect(harness).toContain('Dry run — the comparisons are listed and the judge was not asked.');
    expect(harness).toContain("writeFileSync(page, lines.join");
  });
});

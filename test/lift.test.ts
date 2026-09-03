import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const lift = readFileSync(fileURLToPath(new URL("../scripts/lift.mjs", import.meta.url)), "utf8");

/**
 * **A lift measurement is only a measurement if the two conditions differ in
 * one thing.** Stage 5 of the eval plan: same task, same fixture, same
 * model, same tools and turn budget; the skill present or absent. These pin
 * the discipline in the harness's source, because the number it prints is
 * believed and a harness that quietly gives one side a better prompt would
 * print a confident, wrong lift.
 */
describe("the lift harness holds the conditions equal", () => {
  it("runs both conditions, without first, from the same prompt and the same agent call", () => {
    expect(lift).toContain('for (const cond of ["without", "with"])');
    // One prompt string per skill, built before the condition is consulted;
    // the condition decides only the system-prompt file.
    expect(lift).toContain('cond === "with" ? skillFile : null');
    expect(lift).toContain('cond === "with" ? withFile : null');
    expect(lift).toContain("function runAgent(cwd, prompt, systemFile)");
  });

  it("gives the agent a narrow room: bypassed permissions only inside a temp dir, Bash limited to isocan", () => {
    expect(lift).toContain('"--allowedTools", "Read", "Write", "Edit", "Glob", "Grep", "Bash(isocan:*)"');
    expect(lift).toContain('"--permission-mode", "bypassPermissions"');
    expect(lift).toContain('mkdtempSync(path.join(tmpdir(), "lift-"))');
  });

  it("reports three numbers, never one score, and records the model the run reported", () => {
    expect(lift).toContain("**fires**");
    expect(lift).toContain("**helps**");
    expect(lift).toContain("**costs**");
    expect(lift).toContain("model: Object.keys(report.modelUsage ?? {})");
    expect(lift).not.toMatch(/weighted|score:/i);
  });

  it("grades the canvas version, not only the file, and calls landing on the canvas 'fires'", () => {
    expect(lift).toContain("fires: versions > 1");
    expect(lift).toContain("canvas: grade(id, versions > 1 ? fromCanvas : null)");
  });

  it("can run blind — a prompt that does not say where the work is — and repeat every cell", () => {
    expect(lift).toContain('const blind = argv.includes("--blind");');
    expect(lift).toContain("Something on the canvas it belongs to needs you");
    // Blind changes the prompt and nothing else: the ask still lands as a comment on the item.
    expect(lift).toContain('iso(["comment", "add", "--canvas", canvasId, "--item", itemId, task.ask]);');
    expect(lift).toContain('const runs = Math.max(1, Number(arg("--runs") ?? 1));');
  });

  it("cleans up its scratch canvases and never touches the skills it measures", () => {
    expect(lift).toContain('iso(["canvas", "delete", canvasId, "--force"])');
    expect(lift).not.toMatch(/writeFileSync\([^)]*\.agents/);
  });
});

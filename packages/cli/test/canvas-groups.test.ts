import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { registerCanvasGroups } from "../src/canvas-groups.ts";
import type { Ctx } from "../src/ctx.ts";
import { groupFixture } from "../../api/test/group-fixture.ts";

afterEach(() => { vi.restoreAllMocks(); process.exitCode = 0; });

function cli(f = groupFixture()) {
  const output: string[] = [];
  vi.spyOn(console, "log").mockImplementation((value) => { output.push(String(value)); });
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const program = new Command().option("--json");
  const canvas = program.command("canvas");
  registerCanvasGroups(canvas, async (cmd) => ({ client: f.client, canvasRef: f.state.project.id, actor: f.actor, json: !!cmd.optsWithGlobals().json }) as unknown as Ctx);
  return { f, program, errors, output, async run(...args: string[]) { output.length = 0; await program.parseAsync(["node", "isocan", ...args]); return output.join("\n"); } };
}

describe("the canonical canvas group CLI", () => {
  it("registers and documents every actual family leaf without touching people-group or session-selection verbs", () => {
    const { program } = cli();
    const group = program.commands[0]!.commands[0]!;
    expect(group.commands.map((cmd) => cmd.name())).toEqual(["new", "wrap", "ls", "show", "add", "remove", "ungroup"]);
    const guide = readFileSync(new URL("../src/agent-guide.md", import.meta.url), "utf8");
    for (const cmd of group.commands) expect(guide).toMatch(new RegExp("`canvas group " + cmd.name() + "(?:[ `])"));
    expect(group.helpInformation()).toContain("remove");
    const source = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
    expect(source).toContain('.command("group")');
    expect(source).toContain('.command("select');
    expect(source).toContain('registerCanvasGroups(canvas, ctxOf)');
  });

  it("runs wrap/show/remove/add/ungroup through production parsing, API and the one reducer", async () => {
    const c = cli(); c.f.card("a", "Acme card"); c.f.card("overlap", "Acme overlap");
    const before = JSON.stringify(c.f.state);
    const preview = JSON.parse(await c.run("--json", "canvas", "group", "wrap", "a", "--title", "Acme ideas", "--dry-run"));
    expect(preview.dryRun).toBe(true); expect(c.f.writes).toHaveLength(0); expect(c.f.blobs.size).toBe(0); expect(JSON.stringify(c.f.state)).toBe(before);
    // A new parser models a new CLI process and prevents Commander retaining flags.
    vi.restoreAllMocks(); const madeCli = cli(c.f);
    const made = JSON.parse(await madeCli.run("--json", "canvas", "group", "wrap", "a", "--title", "Acme ideas"));
    expect(c.f.writes).toHaveLength(1); expect(c.f.state.canvas.items.overlap?.containerId).toBeUndefined();
    const shown = JSON.parse(await madeCli.run("--json", "canvas", "group", "show", made.itemId, "--recursive"));
    expect(shown.directMemberIds).toEqual(["a"]);
    await madeCli.run("canvas", "group", "remove", "a"); expect(c.f.state.canvas.items.a?.containerId).toBeUndefined();
    await madeCli.run("canvas", "group", "add", made.itemId, "a"); expect(c.f.state.canvas.items.a?.containerId).toBe(made.itemId);
    await madeCli.run("canvas", "group", "ungroup", made.itemId); expect(c.f.state.canvas.items[made.itemId]).toBeUndefined();
    expect(c.f.state.canvas.items.a).toMatchObject({ x: 100, y: 200 });
  });

  it("creates empty groups with sizes and notes, and refuses ambiguous refs and disabled canvases", async () => {
    const c = cli();
    const made = JSON.parse(await c.run("--json", "canvas", "group", "new", "Acme target", "--at", "200,300", "--size", "800x900", "--note", "Review these"));
    expect(c.f.state.canvas.items[made.itemId]).toMatchObject({ x: 200, y: 300, width: 800, height: 900, description: "Review these" });
    expect(JSON.parse(await c.run("--json", "canvas", "group", "ls"))).toHaveLength(1);
    c.f.card("a", "Acme first"); c.f.card("b", "Acme second");
    await c.run("canvas", "group", "add", made.itemId, "Acme"); expect(c.errors).toHaveBeenCalledWith(expect.stringContaining("ambiguous"));
    vi.restoreAllMocks(); const legacy = cli(groupFixture(false));
    await legacy.run("canvas", "group", "new", "Acme"); expect(legacy.errors).toHaveBeenCalledWith(expect.stringContaining("not enabled"));
    expect(legacy.f.writes).toHaveLength(0); expect(legacy.f.blobs.size).toBe(0);
  });
});

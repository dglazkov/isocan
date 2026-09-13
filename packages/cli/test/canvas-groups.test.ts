import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { registerAreaAliases, registerCanvasGroups } from "../src/canvas-groups.ts";
import type { Ctx } from "../src/ctx.ts";
import { groupFixture } from "../../api/test/group-fixture.ts";

afterEach(() => { vi.restoreAllMocks(); process.exitCode = 0; });

function cli(f = groupFixture()) {
  const output: string[] = [];
  vi.spyOn(console, "log").mockImplementation((value) => { output.push(String(value)); });
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const program = new Command().option("--json");
  const canvas = program.command("canvas");
  const context = async (cmd: Command) => ({ client: f.client, canvasRef: f.state.project.id, actor: f.actor, json: !!cmd.optsWithGlobals().json }) as unknown as Ctx;
  registerCanvasGroups(canvas, context);
  registerAreaAliases(program, context);
  return { f, program, errors, output, async run(...args: string[]) { output.length = 0; await program.parseAsync(["node", "isocan", ...args]); return output.join("\n"); } };
}

describe("the canonical canvas group CLI", () => {
  it("previews and applies migration through production parsing and reports an explicit stale revision", async () => {
    const c = cli(groupFixture(false)); c.f.card("area", "Acme legacy sheet", 0, 0); c.f.card("a", "Acme member", 100, 200);
    c.f.apply({ type: "item.update", itemId: "area", patch: { properties: { kind: "area" } } });
    c.f.apply({ type: "item.resize", itemId: "area", width: 1000, height: 1000 });
    const preview = JSON.parse(await c.run("--json", "canvas", "group", "migrate", "--dry-run"));
    expect(preview).toMatchObject({ status: "ready", dryRun: true, revision: 0 });
    expect(preview.live.find((row: any) => row.itemId === "a").parentAfter).toBe("area");
    expect(c.f.writes).toHaveLength(0);
    vi.restoreAllMocks(); const stale = cli(c.f);
    await stale.run("canvas", "group", "migrate", "--revision", "12");
    expect(stale.errors).toHaveBeenCalledWith(expect.stringContaining("migration preview changed"));
    expect(c.f.writes).toHaveLength(0);
    vi.restoreAllMocks(); const apply = cli(c.f);
    const result = JSON.parse(await apply.run("--json", "canvas", "group", "migrate", "--revision", String(preview.revision)));
    expect(result).toMatchObject({ seq: 1, dryRun: false });
    expect(c.f.state.canvas.items.a?.containerId).toBe("area");
    expect(c.f.state.project.groupMode).toBe("groups");
    vi.restoreAllMocks(); const again = cli(c.f);
    expect(JSON.parse(await again.run("--json", "canvas", "group", "migrate"))).toMatchObject({ status: "already-groups" });
    expect(c.f.writes).toHaveLength(1);
  });
  it("runs area aliases as group intents, clears typed grids, and refuses legacy writes with a migration path", async () => {
    const c = cli();
    const made = JSON.parse(await c.run("--json", "area", "new", "Acme alias", "--tint", "pink", "--note", "Acme brief"));
    const group = c.f.state.canvas.items[made.itemId]!;
    expect(group.properties).toMatchObject({ kind: "group", tint: "pink" });
    expect(group.groupLayout?.briefHeight).toBe(120);
    expect(c.f.writes).toHaveLength(1);
    expect(c.f.writes[0]!.envelope.op.type).toBe("group.change");
    expect(JSON.parse(await c.run("--json", "area", "ls"))[0]).toMatchObject({ id: made.itemId, directCount: 0 });
    await c.run("area", "grid", made.itemId, "2x3", "--rows", "One,Two");
    expect(c.f.state.canvas.items[made.itemId]!.groupLayout).toMatchObject({ rowCount: 2, columnCount: 3, rows: ["One", "Two"] });
    vi.restoreAllMocks(); const clear = cli(c.f);
    await clear.run("area", "grid", made.itemId, "--clear");
    expect(c.f.state.canvas.items[made.itemId]!.groupLayout).toEqual({ briefHeight: 120 });
    expect(c.f.writes).toHaveLength(3);
    vi.restoreAllMocks(); const legacy = cli(groupFixture(false));
    await legacy.run("area", "new", "Acme old");
    expect(legacy.errors).toHaveBeenCalledWith(expect.stringContaining("migrate --dry-run"));
    expect(legacy.f.writes).toHaveLength(0); expect(legacy.f.blobs.size).toBe(0);
    legacy.f.card("area");
    legacy.f.apply({ type: "item.update", itemId: "area", patch: { properties: { kind: "area" } } });
    expect(JSON.parse(await legacy.run("--json", "area", "ls"))[0]).toMatchObject({ id: "area", mode: "legacy" });
    await legacy.run("area", "grid", "area", "2x2");
    expect(legacy.errors).toHaveBeenCalledWith(expect.stringContaining("migrate --dry-run"));
    expect(legacy.f.writes).toHaveLength(0);
  });
  it("parses resize anchors and frame fitting with exact geometry and no dry-run writes", async () => {
    const c = cli(); c.f.card("a");
    const group = (await c.f.api.wrap(["a"], "Acme Frame")).itemId!;
    const count = c.f.writes.length;
    const preview = JSON.parse(await c.run("--json", "canvas", "group", "resize", group, "336x396", "--anchor", "se", "--dry-run"));
    expect(preview.changes.find((row: any) => row.itemId === "a").boxAfter).toEqual({ x: 212, y: 332, width: 288, height: 268 });
    expect(c.f.writes).toHaveLength(count);
    vi.restoreAllMocks(); const commit = cli(c.f);
    await commit.run("canvas", "group", "resize", group, "336x396", "--anchor", "se");
    expect(c.f.state.canvas.items.a).toMatchObject({ x: 212, y: 332, width: 288, height: 268 });
    expect(c.f.writes).toHaveLength(count + 1);
    await commit.run("canvas", "group", "frame", group, "--size", "600x700");
    expect(c.f.state.canvas.items.a).toMatchObject({ x: 212, y: 332, width: 288, height: 268 });
    // A fresh invocation does not retain the previous command's --size flag.
    vi.restoreAllMocks(); const fit = cli(c.f);
    await fit.run("canvas", "group", "frame", group, "--fit");
    expect(c.f.state.canvas.items[group]).toMatchObject({ width: 336, height: 396 });
  });

  it("parses named grids and cell placement through the writer, refusing invalid cells atomically", async () => {
    const c = cli(); c.f.card("a");
    const group = (await c.f.api.new("Acme grid", { at: { x: 0, y: 0 }, size: { width: 1200, height: 1000 } })).itemId!;
    await c.run("canvas", "group", "grid", group, "2x2", "--rows", "One,Two", "--cols", "A,B");
    expect(c.f.state.canvas.items[group]?.groupLayout).toMatchObject({ rowCount: 2, columnCount: 2, rows: ["One", "Two"], columns: ["A", "B"] });
    await c.run("canvas", "group", "add", group, "a", "--cell", "2,2");
    expect(c.f.state.canvas.items.a).toMatchObject({ containerId: group, x: 620, y: 548 });
    const count = c.f.writes.length;
    await c.run("canvas", "group", "add", group, "a", "--cell", "0,2");
    expect(c.errors).toHaveBeenCalledWith(expect.stringContaining("positive row,column"));
    expect(c.f.writes).toHaveLength(count);
  });
  it("registers and documents every actual family leaf without touching people-group or session-selection verbs", () => {
    const { program } = cli();
    const group = program.commands[0]!.commands[0]!;
    expect(group.commands.map((cmd) => cmd.name())).toEqual(["migrate", "new", "wrap", "ls", "show", "add", "remove", "ungroup", "resize", "frame", "layout", "grid"]);
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

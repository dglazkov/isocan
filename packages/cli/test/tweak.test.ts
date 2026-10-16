import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { UI_TWEAKS_PROP } from "@isocan/core/ui-tweaks";
import { groupFixture } from "../../api/test/group-fixture.ts";
import type { Ctx } from "../src/ctx.ts";
import { registerTweak } from "../src/tweak.ts";

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe("isocan tweak", () => {
  function setup() {
    const f = groupFixture();
    const ctx = {
      client: f.client,
      actor: f.actor,
      canvasRef: f.state.project.id,
      json: true,
    } as unknown as Ctx;
    const outputs: string[] = [];
    const errors: string[] = [];
    vi.spyOn(console, "log").mockImplementation((val) => {
      outputs.push(String(val));
    });
    vi.spyOn(console, "error").mockImplementation((val) => {
      errors.push(String(val));
    });

    async function run(...args: string[]) {
      outputs.length = 0;
      errors.length = 0;
      const program = new Command().option("--json");
      registerTweak(program, async () => ctx);
      await program.parseAsync(["node", "isocan", ...args]);
      return {
        out: outputs.join("\n"),
        err: errors.join("\n"),
        json: outputs.length ? JSON.parse(outputs.join("\n")) : null,
      };
    }

    return { f, run };
  }

  it("lists all 9 UI pieces and per-piece knobs with defaults", async () => {
    const { run } = setup();
    const all = await run("--json", "tweak");
    expect(all.json.pieces).toHaveLength(9);
    expect(all.json.pieces.map((p: { piece: string }) => p.piece)).toEqual([
      "glass",
      "toolbar",
      "rail",
      "zoom",
      "minimap",
      "dock",
      "items",
      "layers",
      "colors",
    ]);

    const glass = await run("--json", "tweak", "ls", "glass");
    expect(glass.json.piece.id).toBe("glass");
    expect(glass.json.knobs.some((k: { key: string }) => k.key === "glass.opacity")).toBe(true);
  });

  it("sets knobs on canvas.properties['ui.tweaks'], compiles CSS, and undoes in one step", async () => {
    const { f, run } = setup();
    const setRes = await run(
      "--json",
      "tweak",
      "set",
      "glass.opacity=0.82",
      "toolbar.height=52",
      "colors.accent=#ff5500",
    );
    expect(setRes.json.tweaks).toEqual({
      "glass.opacity": 0.82,
      "toolbar.height": 52,
      "colors.accent": "#ff5500",
    });
    expect(f.state.project.properties?.[UI_TWEAKS_PROP]).toContain('"glass.opacity":0.82');

    const cssRes = await run("--json", "tweak", "css");
    expect(cssRes.json.css).toContain("--glass: linear-gradient(180deg, rgba(255, 255, 255, 0.86)");
    expect(cssRes.json.css).toContain("--pill-h: 52px;");
    expect(cssRes.json.css).toContain("--accent: #ff5500;");

    // One undo reverses the project.update op cleanly.
    f.undo();
    expect(f.state.project.properties?.[UI_TWEAKS_PROP]).toBeUndefined();
  });

  it("resets a single piece or --all, removing the property when empty", async () => {
    const { f, run } = setup();
    await run("--json", "tweak", "set", "glass.opacity=0.8", "rail.btnSize=40");
    expect(Object.keys(JSON.parse(f.state.project.properties?.[UI_TWEAKS_PROP] ?? "{}"))).toEqual([
      "glass.opacity",
      "rail.btnSize",
    ]);

    const pieceReset = await run("--json", "tweak", "reset", "glass");
    expect(pieceReset.json.tweaks).toEqual({ "rail.btnSize": 40 });

    const allReset = await run("--json", "tweak", "reset", "--all");
    expect(allReset.json.tweaks).toEqual({});
    expect(f.state.project.properties?.[UI_TWEAKS_PROP]).toBeUndefined();
  });

  it("refuses unknown pieces and malformed assignments through run()", async () => {
    const { run } = setup();
    const badPiece = await run("--json", "tweak", "ls", "unknown-piece");
    expect(badPiece.err).toContain('error: unknown UI piece "unknown-piece"');
    expect(process.exitCode).toBe(1);

    process.exitCode = undefined;
    const badSet = await run("--json", "tweak", "set", "glass.opacity");
    expect(badSet.err).toContain('error: invalid assignment "glass.opacity"');
    expect(process.exitCode).toBe(1);
  });
});

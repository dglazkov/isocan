import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import vm from "node:vm";
import { MOTION_PROPS, motionEngine, type MotionEngine, type MotionSpec } from "@isocan/core/motion";
import { cliEnv, runCli, type Run } from "./cli.ts";

/**
 * **`isocan motion new`** (motion phase 0; `docs/projects/motion/design.md`
 * §2, §3, §6), walked against a real daemon on a scratch home with the
 * release-format CLI the suite builds.
 *
 * Held: the three SVGs of Scene 1's logo, named in any order, become one
 * `text/html` motion item beside them, layered as the canvas stacks them,
 * wearing `motion`, `motionSources` (with the versions taken), `motionSeconds`
 * and `motionLoop`, whose document inlines an engine that answers every
 * frame exactly as core's does (the bundle's text of the same function); a
 * hostile source is stripped and the CLI says what it took; a looped
 * `assemble` prints its seam as a warning; a recipe that is not one, and an
 * item that is not an SVG, are refused in words.
 *
 * Fixtures are synthetic: an "Acme Bakery" logo.
 */

const fixtures = fileURLToPath(new URL("../../core/test/fixtures/motion/", import.meta.url));
const acme = { id: "usr_acme_motion", name: "Maya" };

let home: string;
let daemon: Daemon;
let port: string;
const ids: Record<string, string> = {};

function isocan(...args: string[]): Promise<Run> {
  return runCli(args, { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port }) });
}

async function added(file: string, title: string, at: string, size: string): Promise<string> {
  const run = await isocan("add", file, "--title", title, "--at", at, "--size", size);
  expect(run.code, run.stderr).toBe(0);
  const listed = JSON.parse((await isocan("ls", "--json")).stdout) as { items?: Array<{ id: string; title: string }> } | Array<{ id: string; title: string }>;
  const items = Array.isArray(listed) ? listed : listed.items ?? [];
  return items.find((i) => i.title === title)!.id;
}

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-motion-cli-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...acme, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home, auth: null, contentPort: "off", birthHome: null });
  const address = daemon.app.server.address();
  port = String(typeof address === "object" && address ? address.port : 0);
  const made = await isocan("canvas", "create", "Acme Motion");
  expect(made.code, made.stderr).toBe(0);
  ids.circle = await added(path.join(fixtures, "circle.svg"), "Circle", "0,0", "200x200");
  ids.wheat = await added(path.join(fixtures, "wheat.svg"), "Wheat", "58,30", "84x140");
  ids.wordmark = await added(path.join(fixtures, "wordmark.svg"), "Wordmark", "-60,210", "320x60");
}, 120_000);

afterAll(async () => {
  await daemon?.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("isocan motion new", () => {
  it("makes the logo one motion item beside it, layered as the canvas stacks it", async () => {
    const run = await isocan("motion", "new", ids.wordmark!, ids.wheat!, ids.circle!, "--recipe", "assemble", "--json");
    expect(run.code, run.stderr).toBe(0);
    const answer = JSON.parse(run.stdout) as { itemId: string; seconds: number; loop: boolean; layers: Array<{ id: string; item: string; parts: string[] }>; stripped: unknown[]; warnings: unknown[] };
    expect(answer).toMatchObject({ seconds: 2.4, loop: false, stripped: [], warnings: [] });
    expect(answer.layers).toEqual([
      { id: "circle", item: ids.circle, parts: [] },
      { id: "wheat", item: ids.wheat, parts: ["stalk"] },
      { id: "wordmark", item: ids.wordmark, parts: [] },
    ]);

    const shown = JSON.parse((await isocan("show", answer.itemId, "--json")).stdout) as {
      x: number; y: number; width: number; height: number; properties: Record<string, string>;
      versions: Array<{ mimeType: string }>;
    };
    expect(shown.versions[0]!.mimeType).toBe("text/html");
    expect(shown.properties[MOTION_PROPS.motion]).toBe("true");
    expect(shown.properties[MOTION_PROPS.seconds]).toBe("2.4");
    expect(shown.properties[MOTION_PROPS.loop]).toBe("false");
    const sources = JSON.parse(shown.properties[MOTION_PROPS.sources]!) as Array<{ item: string; version: string }>;
    expect(sources.map((s) => s.item)).toEqual([ids.circle, ids.wheat, ids.wordmark]);
    for (const s of sources) expect(s.version).toMatch(/^ver_/);
    expect({ width: shown.width, height: shown.height }).toEqual({ width: 320, height: 270 });
    expect(shown.x).toBeGreaterThanOrEqual(260);

    const doc = await isocan("get", answer.itemId);
    expect(doc.code, doc.stderr).toBe(0);
    // The released CLI's esbuild made its own text of the engine; it must
    // still be the engine core runs here — every frame, the same answer.
    const engineText = /\nvar engine = (.*);\n\nvar spec = JSON\.parse/s.exec(doc.stdout)?.[1];
    expect(engineText, "the document inlines the engine").toBeTruthy();
    const specText = /<script type="application\/json" id="motion-spec">(.*?)<\/script>/s.exec(doc.stdout)![1]!;
    const spec = JSON.parse(specText) as MotionSpec;
    const inlined = vm.runInNewContext(engineText!, {}) as MotionEngine;
    for (let n = 0; n <= 144; n++) {
      expect(JSON.stringify(inlined.evaluate(spec, n / 60))).toBe(JSON.stringify(motionEngine.evaluate(spec, n / 60)));
    }
    expect(doc.stdout).toContain('data-motion="wheat/stalk"');
    expect(doc.stdout).toContain("window.render = function (t)");
  }, 60_000);

  it("strips a hostile source and says what it took", async () => {
    const file = path.join(home, "badge.svg");
    await fs.writeFile(file, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><image href="https://acme.test/x.png"/><rect width="10" height="10"/></svg>');
    const badge = await added(file, "Badge", "600,0", "100x100");
    const run = await isocan("motion", "new", badge, "--recipe", "idle");
    expect(run.code, run.stderr).toBe(0);
    expect(run.stderr).toContain("stripped from Badge: onload attribute, <script>, external href");
    expect(run.stdout).toMatch(/— 4 s, loops/);
  }, 60_000);

  it("prints a broken principle as a warning", async () => {
    const run = await isocan("motion", "new", ids.circle!, ids.wheat!, "--recipe", "assemble", "--loop", "--seconds", "3");
    expect(run.code, run.stderr).toBe(0);
    expect(run.stderr).toMatch(/^warning: circle: draw ends at 1 and starts at 0, so it jumps where it loops$/m);
    expect(run.stdout).toMatch(/— 3 s, loops/);
  }, 60_000);

  it("refuses a recipe it does not know and an item that is not an SVG", async () => {
    const recipe = await isocan("motion", "new", ids.circle!, "--recipe", "orbit");
    expect(recipe.code).not.toBe(0);
    expect(recipe.stderr).toContain('--recipe is assemble or idle, not "orbit"');
    const note = path.join(home, "note.md");
    await fs.writeFile(note, "# Acme\n");
    const noteId = await added(note, "Note", "900,0", "200x100");
    const notSvg = await isocan("motion", "new", noteId);
    expect(notSvg.code).not.toBe(0);
    expect(notSvg.stderr).toContain("Note is not an SVG");
  }, 60_000);
});

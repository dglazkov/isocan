import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import vm from "node:vm";
import { MOTION_CONTROLS_HEIGHT, MOTION_PROPS, MOTION_RECIPES, motionEngine, type MotionEngine, type MotionSpec } from "@isocan/core/motion";
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
    // The stage, and the player's controls below it — never over the drawing.
    expect({ width: shown.width, height: shown.height }).toEqual({ width: 320, height: 270 + MOTION_CONTROLS_HEIGHT });
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
    const recipe = await isocan("motion", "new", ids.circle!, "--recipe", "acme-wobble");
    expect(recipe.code).not.toBe(0);
    expect(recipe.stderr).toContain(`--recipe is one of ${MOTION_RECIPES.join(", ")}, not "acme-wobble"`);
    expect(recipe.stderr).toContain("assemble, reveal, idle, orbit, emphasis");
    const note = path.join(home, "note.md");
    await fs.writeFile(note, "# Acme\n");
    const noteId = await added(note, "Note", "900,0", "200x100");
    const notSvg = await isocan("motion", "new", noteId);
    expect(notSvg.code).not.toBe(0);
    expect(notSvg.stderr).toContain("Note is not an SVG");
  }, 60_000);
});

/**
 * **What an agent does with a motion** (motion phase 2): writes a spec rather
 * than code (`motion new --spec`), reads it back (`motion spec`), changes it
 * into a new version from the same sources (`motion edit`), refreshes it from
 * a source's newer version (`motion refresh`), and points at a moment in it
 * (`comment add --at <seconds>`).
 */
describe("an agent's motion", () => {
  type Channel = { keys?: Array<{ t: number; v: number; ease?: string }>; wave?: { period: number; amp: number; from?: number } };
  const SPEC: { seconds: number; loop: boolean; moves: Array<{ target: string; pivot?: string; follows?: string; channels: Record<string, Channel> }> } = {
    seconds: 3,
    loop: false,
    moves: [
      { target: "circle", channels: { draw: { keys: [{ t: 0, v: 0 }, { t: 0.9, v: 1 }] } } },
      { target: "wheat/stalk", pivot: "base", follows: "circle", channels: { rotate: { keys: [{ t: 0.5, v: -10 }, { t: 1.5, v: 0, ease: "outBack" }], wave: { period: 3, amp: 4, from: 1.5 } } } },
      { target: "wordmark", follows: "wheat/stalk", channels: { opacity: { keys: [{ t: 1.7, v: 0 }, { t: 2, v: 1 }] } } },
    ],
  };
  let motion = "";

  it("makes a motion from a spec, keeping the words, and refuses a spec that names nothing there", async () => {
    const file = path.join(home, "scene-1.json");
    await fs.writeFile(file, JSON.stringify(SPEC));
    const run = await isocan("motion", "new", ids.circle!, ids.wheat!, ids.wordmark!, "--spec", file, "--say", "assemble, then a slow idle sway", "--json");
    expect(run.code, run.stderr).toBe(0);
    const answer = JSON.parse(run.stdout) as { itemId: string; seconds: number; recipe: string | null; warnings: unknown[] };
    expect(answer).toMatchObject({ seconds: 3, recipe: null, warnings: [] });
    motion = answer.itemId;
    const shown = JSON.parse((await isocan("show", motion, "--json")).stdout) as { title: string; description: string };
    expect(shown).toMatchObject({ title: "Circle + Wheat + Wordmark — motion", description: "assemble, then a slow idle sway" });

    const bad = path.join(home, "bad.json");
    await fs.writeFile(bad, JSON.stringify({ seconds: 1, moves: [{ target: "wheat/stem", channels: {} }] }));
    const refused = await isocan("motion", "new", ids.wheat!, "--spec", bad);
    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('which is not here — the targets are wheat, wheat/stalk');
    const say = await isocan("motion", "new", ids.wheat!, "--say", "make it dance");
    expect(say.code).not.toBe(0);
    expect(say.stderr).toContain("this CLI runs no model");
  }, 60_000);

  it("prints the spec as it was written, with the targets", async () => {
    const run = await isocan("motion", "spec", motion);
    expect(run.code, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual(SPEC);
    expect(run.stderr).toContain("targets: circle, wheat, wheat/stalk, wordmark");
  }, 60_000);

  it("edits it into a new version from the same sources — slower wheat, less sway", async () => {
    const slower = structuredClone(SPEC);
    slower.moves[1]!.channels.rotate!.keys![1]!.t = 2;
    slower.moves[1]!.channels.rotate!.wave!.amp = 2;
    const file = path.join(home, "slower.json");
    await fs.writeFile(file, JSON.stringify(slower));
    const run = await isocan("motion", "edit", motion, "--spec", file);
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/a new version \(ver_/);
    const shown = JSON.parse((await isocan("show", motion, "--json")).stdout) as { versions: unknown[]; properties: Record<string, string> };
    expect(shown.versions).toHaveLength(2);
    const sources = JSON.parse(shown.properties[MOTION_PROPS.sources]!) as Array<{ item: string }>;
    expect(sources.map((s) => s.item)).toEqual([ids.circle, ids.wheat, ids.wordmark]);
    expect((JSON.parse((await isocan("motion", "spec", motion)).stdout) as typeof SPEC).moves[1]!.channels.rotate!.wave!.amp).toBe(2);
  }, 60_000);

  it("refreshes from a source's newer version, and says when there is none", async () => {
    const none = await isocan("motion", "refresh", motion);
    expect(none.code, none.stderr).toBe(0);
    expect(none.stdout).toContain("nothing to refresh");
    const wheat = await fs.readFile(path.join(fixtures, "wheat.svg"), "utf8");
    const newer = path.join(home, "wheat-2.svg");
    await fs.writeFile(newer, wheat.replace('fill="#d9a441"', 'fill="#c98f2a"'));
    expect((await isocan("edit", ids.wheat!, newer)).code).toBe(0);
    const told = await isocan("motion", "spec", motion);
    expect(told.stderr).toContain(`Wheat has a newer version — isocan motion refresh ${motion}`);
    const run = await isocan("motion", "refresh", motion, "--json");
    expect(run.code, run.stderr).toBe(0);
    expect((JSON.parse(run.stdout) as { refreshed: string[] }).refreshed).toEqual([ids.wheat]);
    expect((await isocan("motion", "spec", motion)).stderr).not.toContain("newer version");
  }, 60_000);

  it("pins a comment at a moment, and refuses a moment on what has no clock", async () => {
    const run = await isocan("comment", "add", "wordmark overshoots here", "--item", motion, "--at", "1.2", "--json");
    expect(run.code, run.stderr).toBe(0);
    const { threadId } = JSON.parse(run.stdout) as { threadId: string };
    const threads = JSON.parse((await isocan("comment", "ls", "--item", motion, "--json")).stdout) as Array<{ id: string; anchorItemId: string; comments: Array<{ at?: number }> }>;
    const thread = threads.find((t) => t.id === threadId)!;
    expect(thread.anchorItemId).toBe(motion);
    expect(thread.comments[0]!.at).toBe(1.2);
    expect((await isocan("comment", "ls", "--item", motion)).stdout).toContain("· at 1.2 s");
    const past = await isocan("comment", "add", "after the end", "--item", motion, "--at", "9");
    expect(past.code).not.toBe(0);
    expect(past.stderr).toContain("past the end");
    const still = await isocan("comment", "add", "no clock", "--item", ids.circle!, "--at", "1.2");
    expect(still.code).not.toBe(0);
    expect(still.stderr).toContain("Circle is not one");
  }, 60_000);
});

/**
 * **`isocan motion render`'s refusals** (motion phase 1). The movie itself is
 * proved in a real browser by `scripts/motion-proof.mjs` — a suite case
 * cannot hold Chrome and ffmpeg — so what is held here is what must happen
 * BEFORE a browser starts: past a cap, or on an item that is not a motion,
 * the verb refuses in words and adds nothing.
 */
describe("isocan motion render", () => {
  it("refuses past its caps and on a non-motion, before any browser starts", async () => {
    const made = await isocan("motion", "new", ids.circle!, "--recipe", "idle", "--title", "Acme circle — idle", "--json");
    expect(made.code, made.stderr).toBe(0);
    const motion = (JSON.parse(made.stdout) as { itemId: string }).itemId;
    const count = async () => {
      const listed = JSON.parse((await isocan("ls", "--json")).stdout) as { items?: unknown[] } | unknown[];
      return (Array.isArray(listed) ? listed : listed.items ?? []).length;
    };
    const before = await count();
    for (const [flags, words] of [
      [["--fps", "120"], "a movie is at most 60 fps, not 120"],
      [["--seconds", "90"], "a movie is at most 60 seconds, not 90"],
      [["--size", "2160"], "a movie is at most 1080p"],
      [["--background", "white"], "--background is a colour as #rrggbb"],
    ] as const) {
      const run = await isocan("motion", "render", motion, ...flags);
      expect(run.code, `${flags.join(" ")} was not refused`).not.toBe(0);
      expect(run.stderr).toContain(words);
    }
    const notMotion = await isocan("motion", "render", ids.circle!);
    expect(notMotion.code).not.toBe(0);
    expect(notMotion.stderr).toContain("Circle is not a motion");
    expect(await count()).toBe(before);
  }, 60_000);
});

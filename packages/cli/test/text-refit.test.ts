import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { textBox, textFontFrom, textLookProperties, type TextFace, type TextStyle } from "@isocan/core";
import { cliEnv, runCli, type Run } from "./cli.ts";

/**
 * **A text node changed after birth holds its words at the new look.**
 *
 * Reported 23 Sep 2026: an agent's note at a large size, second line cut in
 * half. `isocan text` sized it right — at body. `isocan set --prop
 * textStyle=heading` then drew 32px type in the 16px box, because a property
 * write never asked what the box should be. The same hole was in `edit`
 * (new words, old box) and on the web's step bar. Every case here ran red
 * before `textNodeRefit` and asserts against core's own estimate, which is
 * what `isocan text` itself would have given a node born at that look.
 */

const acme = { id: "usr_acme", name: "Acme" };
const SENTENCE = "Acme step 2 · the review side — and status notes too: step 1 waits on step 2 before it can close";

let home: string;
let daemon: Daemon;
let port: string;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-text-refit-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...acme, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = String(typeof address === "object" && address ? address.port : 0);
});

afterAll(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function isocan(...args: string[]): Promise<Run> {
  return runCli(args, { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port }) });
}

async function ok(...args: string[]): Promise<string> {
  const run = await isocan(...args);
  expect(run.code, run.stderr).toBe(0);
  return run.stdout;
}

async function box(canvas: string, itemId: string): Promise<{ width: number; height: number }> {
  const items = JSON.parse(await ok("--canvas", canvas, "--json", "ls")) as { id: string; width: number; height: number }[];
  const item = items.find((i) => i.id === itemId)!;
  return { width: item.width, height: item.height };
}

async function canvas(title: string, ...flags: string[]): Promise<string> {
  return JSON.parse(await ok("--json", "canvas", "create", title, ...flags)).canvasId;
}

async function text(canvasId: string, at: string, ...args: string[]): Promise<string> {
  return JSON.parse(await ok("--canvas", canvasId, "--json", "text", "--at", at, ...args)).itemId;
}

/** At least the box core would give words born at this look — both axes. */
function holds(got: { width: number; height: number }, body: string, style: TextStyle, face: TextFace = "sans") {
  const need = textBox(body, style, face);
  expect(got.width, `${style}/${face} width`).toBeGreaterThanOrEqual(need.width);
  expect(got.height, `${style}/${face} height`).toBeGreaterThanOrEqual(need.height);
}

describe("restyling a caption by property", () => {
  // One case per look, not one loop: each is four CLI spawns, and twenty-one
  // in a single case ran past 30 s on a loaded CI shard (24 Sep 2026) —
  // a test that was slow, not a product that was wrong.
  const looks: [TextStyle, TextFace][] = [
    ["heading", "sans"],
    ["title", "sans"],
    ["display", "sans"],
    ["heading", "serif"],
    ["title", "hand"],
  ];
  let restyle: Promise<string> | undefined;
  it.each(looks)("grows the box to %s/%s, on a group canvas", async (style, face) => {
    const id = await (restyle ??= canvas("Acme restyle"));
    const node = await text(id, `0,${looks.findIndex(([s, f]) => s === style && f === face) * 800}`, SENTENCE);
    const born = await box(id, node);
    holds(born, SENTENCE, "body");
    await ok("--canvas", id, "set", node, "--prop", `textStyle=${style}`, ...(face === "sans" ? [] : ["--prop", `textFace=${face}`]));
    holds(await box(id, node), SENTENCE, style, face);
  });

  it("grows on a legacy canvas too, and never shrinks when the step comes back down", async () => {
    const id = await canvas("Acme legacy restyle", "--legacy");
    const node = await text(id, "0,0", SENTENCE);
    await ok("--canvas", id, "set", node, "--prop", "textStyle=title");
    const big = await box(id, node);
    holds(big, SENTENCE, "title");
    // Down a step: the words still fit, so nothing rearranges under them.
    await ok("--canvas", id, "set", node, "--rm-prop", "textStyle");
    expect(await box(id, node)).toEqual(big);
  });

  it("lets --size win outright", async () => {
    const id = await canvas("Acme sized");
    const node = await text(id, "0,0", SENTENCE);
    await ok("--canvas", id, "set", node, "--prop", "textStyle=title", "--size", "300x90");
    expect(await box(id, node)).toEqual({ width: 300, height: 90 });
  });
});

describe("re-wording a caption", () => {
  it("grows a short label into the box its new, wrapping words need", async () => {
    const id = await canvas("Acme reword");
    const node = await text(id, "0,0", "--style", "heading", "Acme");
    const words = `## ${SENTENCE}\n\n${SENTENCE}\n\n- one\n- ${SENTENCE}`;
    const file = path.join(home, "reword.md");
    await fs.writeFile(file, words);
    await ok("--canvas", id, "edit", node, file);
    holds(await box(id, node), words, "heading");
  });
});

/**
 * **Colour and a named font, from the terminal** (30 Sep 2026). The same
 * words the bar offers, read through core's doors, landing the properties the
 * web's composer sends (`textLookProperties` — `web/test/textlook.test.ts`
 * holds the web to it) — and a font change refits the box like a step change,
 * because a wider family in the old box is lesson #94 again.
 */
describe("colour and font", () => {
  async function props(canvasId: string, itemId: string): Promise<Record<string, string>> {
    const items = JSON.parse(await ok("--canvas", canvasId, "--json", "ls")) as { id: string; properties: Record<string, string> }[];
    return items.find((i) => i.id === itemId)!.properties;
  }

  it("births a node with core's properties for the look, in a box that holds the family", async () => {
    const id = await canvas("Acme ink");
    const node = await text(id, "0,0", "--style", "display", "--color", "Blue", "--font", "space grotesk", "Wayfinding");
    const font = textFontFrom("Space Grotesk")!;
    expect(await props(id, node)).toEqual(textLookProperties({ style: "display", face: "sans", paper: null, colour: "blue", font }));
    const got = await box(id, node);
    const need = textBox("Wayfinding", "display", "sans", font);
    expect(got.width).toBeGreaterThanOrEqual(need.width);
    expect(need.width, "the family's width is in the estimate").toBeGreaterThan(textBox("Wayfinding", "display", "sans").width);
  });

  it("sets a font by property, writes its face beside it, and grows the box", async () => {
    const id = await canvas("Acme font set");
    const node = await text(id, "0,0", "--style", "display", "Wayfinding");
    const born = await box(id, node);
    await ok("--canvas", id, "set", node, "--prop", "textFont=space grotesk");
    expect(await props(id, node)).toMatchObject({ textFont: "Space Grotesk" });
    const grown = await box(id, node);
    expect(grown.width).toBeGreaterThan(born.width);
    expect(grown.width).toBeGreaterThanOrEqual(textBox("Wayfinding", "display", "sans", textFontFrom("Space Grotesk")).width);
    // A serif family brings its face, so an older client still draws a serif.
    await ok("--canvas", id, "set", node, "--prop", "textFont=Lora");
    expect(await props(id, node)).toMatchObject({ textFont: "Lora", textFace: "serif" });
    // A face on its own lets go of the family, the way the bar's face does.
    await ok("--canvas", id, "set", node, "--prop", "textFace=mono");
    const plain = await props(id, node);
    expect(plain.textFace).toBe("mono");
    expect(plain.textFont).toBeUndefined();
  });

  it("normalises a colour, warns about a hex that will not read, and takes auto as the theme's ink", async () => {
    const id = await canvas("Acme colour set");
    const node = await text(id, "0,0", "Acme label");
    await ok("--canvas", id, "set", node, "--prop", "textColor=Purple");
    expect((await props(id, node)).textColor).toBe("purple");
    const pale = await isocan("--canvas", id, "set", node, "--prop", "textColor=#EEE");
    expect(pale.code, pale.stderr).toBe(0);
    expect(pale.stderr).toMatch(/#eeeeee measures [\d.]+:1 on the ground in the light theme/);
    expect((await props(id, node)).textColor).toBe("#eeeeee");
    await ok("--canvas", id, "set", node, "--prop", "textColor=auto");
    expect((await props(id, node)).textColor).toBeUndefined();
  });

  it("refuses a colour or font it cannot draw, with the list", async () => {
    const id = await canvas("Acme refusals");
    const black = await isocan("--canvas", id, "text", "--color", "black", "Acme");
    expect(black.code).not.toBe(0);
    expect(black.stderr).toMatch(/red, orange, yellow, green, blue, purple, pink, brown, grey, a #rrggbb, or auto/);
    const papyrus = await isocan("--canvas", id, "text", "--font", "Papyrus", "Acme");
    expect(papyrus.code).not.toBe(0);
    expect(papyrus.stderr).toMatch(/Fraunces/);
  });
});

describe("fit on a caption", () => {
  it("is the box its words need at its look — not a screen's 1280×800", async () => {
    const id = await canvas("Acme fit", "--legacy");
    const node = await text(id, "0,0", "--style", "title", SENTENCE);
    await ok("--canvas", id, "set", node, "--size", "120x40");
    await ok("--canvas", id, "fit", node);
    expect(await box(id, node)).toEqual(textBox(SENTENCE, "title", "sans"));
  });
});

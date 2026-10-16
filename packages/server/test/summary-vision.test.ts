import { afterEach, describe, expect, it } from "vitest";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import sharp from "sharp";
import { CANVAS_GROUPS_FEATURE } from "@isocan/core";
import {
  summariesRoute, summaryKey, summaryMembers, summaryStatsRoute, SUMMARY_NO_PICTURES, SUMMARY_NO_SOURCE, SUMMARY_VISION_OVER_BUDGET, textSummaryKey,
  type SummaryEntry, type SummaryRead, type SummaryStats,
} from "@isocan/core/semantic-zoom";
import { TEXT_PICTURES_ROUTE, type TextPictures } from "@isocan/core/text";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import type { SummaryOptions } from "../src/summaries.ts";
import { pictureToSend } from "../src/summary-pictures.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Semantic Zoom looks at pictures** (phase 3b; `docs/projects/semantic-zoom/design.md` §11).
 *
 * What is held, on a stub provider that records every request it is sent:
 * with vision off no picture is ever sent; with it on a screen's render is,
 * at most eight a group, the largest on the canvas first, a PNG over 1024 px
 * scaled down to it; a text node's key and summary are the same with vision
 * on or off; a reader with vision off never reads a vision summary, exact or
 * stale; a model that takes no pictures refuses before anything is read or
 * asked; calls with pictures have their own hourly budget inside the
 * canvas's, counted in the cost record; and a screen alone is framed as one.
 * With `sharp` a JPEG, a WebP and a GIF (its first frame) over 1024 px are
 * scaled down and sent too; with its import failing, only a PNG is, as before.
 * A real daemon on a temp home; never a real model. Fixtures are synthetic (Acme),
 * generated here — no picture is committed.
 */

const KEY = "sk-ant-fake_VISION_DO_NOT_PRINT_";
const priya = { id: "usr_priya", name: "Priya" };
const CANVAS = "prj_acme_vision";
const LONG = `# Acme launch notes\n\n${"The Acme launch slips two weeks while Ravi rewrites the pricing page and the team settles the open question on data residency. ".repeat(3)}`;
const SUMMARY = "Acme onboarding: sign-up asks for a work email, then a project picker.";

interface Rig { daemon: Daemon; base: string; home: string; owner: TestBadge; calls: Array<Record<string, unknown>>; clock: { now: number } }
const rigs: Rig[] = [];

afterEach(async () => {
  for (const r of rigs.splice(0).reverse()) {
    await r.daemon.close();
    await fsp.rm(r.home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

async function rig(opts: { provider?: "anthropic" | "openai"; summaries?: SummaryOptions } = {}): Promise<Rig> {
  const home = await fsp.mkdtemp(path.join(os.tmpdir(), "isocan-vision-"));
  const calls: Array<Record<string, unknown>> = [];
  const clock = { now: Date.now() };
  const fake = (async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    const content = [{ type: "text", text: JSON.stringify({ summary: SUMMARY }) }];
    return new Response(JSON.stringify({ id: "msg_acme", type: "message", role: "assistant", model: "stub", stop_reason: "end_turn", content, usage: { input_tokens: 900, output_tokens: 20 } }), { status: 200 });
  }) as unknown as typeof fetch;
  const daemon = await startDaemon({
    port: 0, home, auth: null, contentPort: "off", birthHome: null,
    text: { key: () => KEY, fetch: fake, now: () => clock.now, ...(opts.provider ? { provider: () => opts.provider } : {}) },
    summaries: { now: () => clock.now, ...opts.summaries },
  });
  const address = daemon.app.server.address();
  const base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  const owner = await mintTestBadge(base);
  await owner.speakAs(priya);
  expect((await op(base, owner, { type: "project.create", canvasId: CANVAS, title: "Acme Vision" }, null)).ok).toBe(true);
  const r = { daemon, base, home, owner, calls, clock };
  rigs.push(r);
  return r;
}

function op(base: string, badge: TestBadge, body: unknown, canvasId: string | null = CANVAS) {
  return fetch(`${base}/api/ops`, { method: "POST", headers: { "Content-Type": "application/json", ...badge.headers }, body: JSON.stringify({ canvasId, actor: priya, op: body, clientFeatures: CANVAS_GROUPS_FEATURE }) });
}

/** A flat-colour PNG, `w` × `h`, RGB — what a screen's render is. */
function png(w: number, h: number, shade = 200): Buffer {
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w * 3; x++) raw[y * (w * 3 + 1) + 1 + x] = (shade + y) & 0xff;
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** The width and height a PNG says it is. */
const sizeOfPng = (bytes: Buffer) => ({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });

async function add(r: Rig, itemId: string, title: string, version: Record<string, unknown>, size = { width: 400, height: 300 }, properties: Record<string, string> = {}) {
  const res = await op(r.base, r.owner, { type: "item.add", itemId, title, ...size, placement: { x: 0, y: 0, chosen: true }, properties, version: { id: `ver_${itemId}`, filename: "f", ...version } });
  expect(res.ok, await res.clone().text()).toBe(true);
}

/** A picture item: a PNG blob of `px`, drawn on the canvas at `size`. */
async function picture(r: Rig, itemId: string, title: string, px: { w: number; h: number }, size = { width: 400, height: 300 }) {
  const bytes = png(px.w, px.h);
  const blob = await r.daemon.store.putBlob(CANVAS, bytes, { mimeType: "image/png", filename: "shot.png" });
  await add(r, itemId, title, { blobHash: blob.blobHash, mimeType: "image/png", size: bytes.length }, size);
}

/** A screen: HTML, with a PNG render as its visual face when `render` is given. */
async function screen(r: Rig, itemId: string, title: string, render?: { w: number; h: number }, size = { width: 400, height: 300 }) {
  const html = Buffer.from(`<h1>${title}</h1>`);
  const blob = await r.daemon.store.putBlob(CANVAS, html, { mimeType: "text/html", filename: "screen.html" });
  let visual: Record<string, unknown> | undefined;
  if (render) {
    const bytes = png(render.w, render.h);
    const face = await r.daemon.store.putBlob(CANVAS, bytes, { mimeType: "image/png", filename: "render.png" });
    visual = { blobHash: face.blobHash, mimeType: "image/png", size: bytes.length };
  }
  await add(r, itemId, title, { blobHash: blob.blobHash, mimeType: "text/html", size: html.length, ...(visual ? { visual } : {}) }, size);
}

async function note(r: Rig, itemId: string, words: string) {
  const blob = await r.daemon.store.putBlob(CANVAS, Buffer.from(words), { mimeType: "text/markdown", filename: "note.md" });
  await add(r, itemId, words.split("\n")[0]!.replace(/^#\s*/, ""), { blobHash: blob.blobHash, mimeType: "text/markdown", size: Buffer.byteLength(words) }, { width: 320, height: 200 }, { kind: "text" });
}

async function group(r: Rig, id: string, title: string, itemIds: string[]) {
  const brief = await r.daemon.store.putBlob(CANVAS, Buffer.from(`# ${title}\n`), { mimeType: "text/markdown", filename: "brief.md" });
  const res = await op(r.base, r.owner, { type: "group.change", action: { kind: "create", group: { id, title, version: { id: `ver_${id}`, blobHash: brief.blobHash, mimeType: "text/markdown", filename: "brief.md", size: 4 } }, itemIds } });
  expect(res.ok, await res.clone().text()).toBe(true);
  r.clock.now = Date.now() + 31_000;
}

const make = (r: Rig, sourceId: string, kind: string, vision?: boolean) =>
  fetch(`${r.base}${summariesRoute(CANVAS)}`, { method: "POST", headers: { "Content-Type": "application/json", ...r.owner.headers }, body: JSON.stringify({ kind, sourceId, ...(vision === undefined ? {} : { vision }) }) });

const read = async (r: Rig, keys: string[], sources: string[], vision: boolean) => {
  const res = await fetch(`${r.base}${summariesRoute(CANVAS)}?keys=${keys.join(",")}&for=${sources.join(",")}${vision ? "&vision=1" : ""}`, { headers: r.owner.headers });
  expect(res.status).toBe(200);
  return ((await res.json()) as SummaryRead).summaries;
};

async function groupKey(r: Rig, id: string, vision: boolean): Promise<string> {
  const held = summaryMembers((await r.daemon.engine.getSnapshot(CANVAS)).canvas, "group", id);
  if (!held || held === "excluded") throw new Error(`no group ${id}`);
  return summaryKey("group", [held.container, ...held.members], vision);
}

type Block = { type: string; text?: string; source?: { type: string; media_type: string; data: string } };
/** What one call sent as its user turn: its picture blocks, and its words. */
function sent(call: Record<string, unknown>): { images: Block[]; text: string } {
  const content = (call.messages as Array<{ content: string | Block[] }>)[0]!.content;
  if (typeof content === "string") return { images: [], text: content };
  return { images: content.filter((b) => b.type === "image"), text: content.filter((b) => b.type === "text").map((b) => b.text).join("") };
}

describe("looking at pictures (phase 3b)", () => {
  it("with vision off no picture is sent; with it on a screen's render is, at most eight a group, the largest first, scaled to 1024 px", async () => {
    const r = await rig();
    await note(r, "itm_brief", "# Brief\n\nAcme onboarding, first pass.");
    // Ten pictures, each a different size on the canvas; one a 2048 × 1536 render that must be scaled down.
    const ids: string[] = [];
    for (let n = 0; n < 9; n++) {
      ids.push(`itm_pic_${n}`);
      await picture(r, `itm_pic_${n}`, `Acme step ${n}`, { w: 40, h: 30 }, { width: 100 + n * 10, height: 100 });
    }
    await screen(r, "itm_signup", "Sign up", { w: 2048, h: 1536 }, { width: 900, height: 700 });
    await group(r, "itm_onboarding", "Onboarding", ["itm_brief", ...ids, "itm_signup"]);

    expect((await make(r, "itm_onboarding", "group")).status).toBe(200);
    expect(r.calls).toHaveLength(1);
    const plain = sent(r.calls[0]!);
    expect(plain.images).toHaveLength(0);
    expect(typeof (r.calls[0]!.messages as Array<{ content: unknown }>)[0]!.content).toBe("string");
    expect(plain.text).not.toMatch(/picture \d|attached/);

    const res = await make(r, "itm_onboarding", "group", true);
    expect(res.status, await res.clone().text()).toBe(200);
    const entry = (await res.json()) as SummaryEntry;
    expect(entry).toMatchObject({ vision: true, pictures: 8, key: await groupKey(r, "itm_onboarding", true) });
    expect(entry.key).not.toBe(await groupKey(r, "itm_onboarding", false));
    expect(r.calls).toHaveLength(2);
    const looked = sent(r.calls[1]!);
    expect(looked.images).toHaveLength(8);
    expect(looked.images.every((b) => b.source?.type === "base64" && b.source.media_type === "image/png")).toBe(true);
    // The largest on the canvas first: the screen, then the pictures from the widest down; the two smallest go by title.
    expect(looked.text).toContain('Screen "Sign up" (picture 1)');
    expect(looked.text).toContain('Picture "Acme step 8" (picture 2)');
    expect(looked.text).toContain('Picture "Acme step 2" (picture 8)');
    expect(looked.text).toMatch(/- Picture "Acme step 1"\n/);
    expect(looked.text).toContain("No picture was sent of 2 screens and pictures");
    expect(looked.text).toContain("The pictures attached are numbered");
    const first = Buffer.from(looked.images[0]!.source!.data, "base64");
    expect(sizeOfPng(first)).toEqual({ width: 1024, height: 768 });
    expect(Math.max(...looked.images.map((b) => Math.max(...Object.values(sizeOfPng(Buffer.from(b.source!.data, "base64"))))))).toBeLessThanOrEqual(1024);
  });

  it("a text node's key is the same with and without vision, and a make asked with vision is the text-only one", async () => {
    const r = await rig();
    await note(r, "itm_long", LONG);
    r.clock.now = Date.now() + 31_000;
    const item = (await r.daemon.engine.getSnapshot(CANVAS)).canvas.items.itm_long!;
    const key = await textSummaryKey(item);
    expect(await summaryKey("text", [item], true)).toBe(key);
    const res = await make(r, "itm_long", "text", true);
    expect(res.status).toBe(200);
    const entry = (await res.json()) as SummaryEntry;
    expect(entry.key).toBe(key);
    expect(entry.vision).toBeUndefined();
    expect(sent(r.calls[0]!).images).toHaveLength(0);
    // And a group of notes alone: one key either way, so no second entry.
    await group(r, "itm_notes", "Notes", ["itm_long"]);
    expect(await groupKey(r, "itm_notes", true)).toBe(await groupKey(r, "itm_notes", false));
  });

  it("a reader with vision off never reads a vision summary, exact or stale; with it on, the vision one and the text-only one both", async () => {
    const r = await rig();
    await screen(r, "itm_signup", "Sign up", { w: 64, h: 48 });
    await group(r, "itm_onboarding", "Onboarding", ["itm_signup"]);
    const visionKey = await groupKey(r, "itm_onboarding", true);
    const textKey = await groupKey(r, "itm_onboarding", false);
    expect((await make(r, "itm_onboarding", "group", true)).status).toBe(200);

    // Exact, and as the stale stand-in for its own source: never without vision=1.
    expect(await read(r, [visionKey], ["itm_onboarding"], false)).toEqual({});
    expect(await read(r, [textKey], ["itm_onboarding"], false)).toEqual({});
    expect((await read(r, [visionKey], ["itm_onboarding"], true))[visionKey]).toMatchObject({ vision: true, summary: SUMMARY });

    // Once a text-only one exists, a vision-off reader gets that and only that; a vision reader can read both.
    expect((await make(r, "itm_onboarding", "group")).status).toBe(200);
    const off = await read(r, [textKey, visionKey], ["itm_onboarding", "itm_onboarding"], false);
    expect(off[textKey]).toMatchObject({ key: textKey, summary: SUMMARY });
    // Asked about the vision key, the stand-in it is handed is the text-only one, never the vision one.
    expect(off[visionKey]).toMatchObject({ key: textKey, stale: true });
    expect(Object.values(off).some((entry) => entry.vision)).toBe(false);
    const on = await read(r, [visionKey, textKey], ["itm_onboarding", ""], true);
    expect(on[visionKey]).toMatchObject({ vision: true });
    expect(on[textKey]!.vision).toBeUndefined();
  });

  it("a home whose model takes no pictures says so, and refuses a vision make before anything is asked", async () => {
    const r = await rig({ provider: "openai" });
    const said = (await (await fetch(`${r.base}${TEXT_PICTURES_ROUTE}`, { headers: r.owner.headers })).json()) as TextPictures;
    expect(said.pictures).toBe(false);
    expect(said.why).toMatch(/takes no pictures/);
    await screen(r, "itm_signup", "Sign up", { w: 64, h: 48 });
    await group(r, "itm_onboarding", "Onboarding", ["itm_signup"]);
    const refused = await make(r, "itm_onboarding", "group", true);
    expect(refused.status).toBe(422);
    expect(await refused.json()).toMatchObject({ code: SUMMARY_NO_PICTURES });
    expect(r.calls).toHaveLength(0);

    const claude = await rig();
    expect(((await (await fetch(`${claude.base}${TEXT_PICTURES_ROUTE}`, { headers: claude.owner.headers })).json()) as TextPictures).pictures).toBe(true);
  });

  it("calls with pictures have their own hourly budget inside the canvas's, counted in the cost record", async () => {
    const r = await rig({ summaries: { visionPerHour: 2 } });
    for (const n of [1, 2, 3]) {
      await screen(r, `itm_s${n}`, `Acme screen ${n}`, { w: 64, h: 48 });
      await group(r, `itm_g${n}`, `Acme flow ${n}`, [`itm_s${n}`]);
    }
    expect((await make(r, "itm_g1", "group", true)).status).toBe(200);
    expect((await make(r, "itm_g2", "group", true)).status).toBe(200);
    const over = await make(r, "itm_g3", "group", true);
    expect(over.status).toBe(429);
    const why = (await over.json()) as { code: string; retryAfterMs: number };
    expect(why.code).toBe(SUMMARY_VISION_OVER_BUDGET);
    expect(why.retryAfterMs).toBeGreaterThan(0);
    expect(r.calls).toHaveLength(2);
    // The text-only summary of the same group is still made: the canvas's own hour has room.
    expect((await make(r, "itm_g3", "group")).status).toBe(200);
    expect(r.calls).toHaveLength(3);

    const stats = (await (await fetch(`${r.base}${summaryStatsRoute(CANVAS)}`, { headers: r.owner.headers })).json()) as SummaryStats;
    expect(stats.budget).toMatchObject({ usedThisHour: 3, visionPerHour: 2, visionUsedThisHour: 2 });
    expect(stats.days[0]).toMatchObject({ calls: 3, vision: 2, overBudget: 1 });
    expect(stats.total.vision).toBe(2);

    r.clock.now += 3_600_000;
    expect((await make(r, "itm_g3", "group", true)).status).toBe(200);
    expect(sent(r.calls[3]!).images).toHaveLength(1);
  });

  it("a screen alone is summarised only by looking at it, under the bench's screen framing; without a picture it is nothing to summarise", async () => {
    const r = await rig();
    await screen(r, "itm_pricing", "Pricing", { w: 64, h: 48 });
    await screen(r, "itm_bare", "Bare");
    r.clock.now = Date.now() + 31_000;
    const blind = await make(r, "itm_pricing", "screen");
    expect(blind.status).toBe(400);
    expect(await blind.json()).toMatchObject({ code: SUMMARY_NO_SOURCE });
    const res = await make(r, "itm_pricing", "screen", true);
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toMatchObject({ kind: "screen", vision: true, pictures: 1, sourceIds: ["itm_pricing"] });
    const { images, text } = sent(r.calls[0]!);
    expect(images).toHaveLength(1);
    expect(text).toContain('This is a screen (a picture of an app\'s interface) on a canvas, titled "Pricing".');
    // A screen with no render has no picture: there is no screen summary to make of it.
    expect((await make(r, "itm_bare", "screen", true)).status).toBe(404);
    expect(r.calls).toHaveLength(1);
  });
});

/** A synthetic photo-like picture, `w` × `h`: a diagonal gradient with a little noise, so JPEG has something to compress. */
function photo(w: number, h: number, format: "jpeg" | "webp" | "gif"): Promise<Buffer> {
  const raw = Buffer.alloc(w * h * 3);
  let seed = 7;
  for (let i = 0; i < w * h; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const x = i % w, y = Math.floor(i / w), n = seed % 24;
    raw.set([((x * 255) / w + n) & 0xff, ((y * 255) / h + n) & 0xff, 128 + (n >> 1)], i * 3);
  }
  const image = sharp(raw, { raw: { width: w, height: h, channels: 3 } });
  return (format === "jpeg" ? image.jpeg() : format === "webp" ? image.webp() : image.gif()).toBuffer();
}

/** Two flat frames, red then blue, as one animated GIF of `w` × `h`. */
async function animatedGif(w: number, h: number): Promise<Buffer> {
  const frame = (r: number, b: number) => sharp({ create: { width: w, height: h, channels: 3, background: { r, g: 0, b } } }).png().toBuffer();
  return sharp([await frame(255, 0), await frame(0, 255)], { join: { animated: true } }).gif().toBuffer();
}

/** A picture item of any format, drawn on the canvas at `size`. */
async function pictureOf(r: Rig, itemId: string, title: string, bytes: Buffer, mimeType: string, size = { width: 400, height: 300 }) {
  const blob = await r.daemon.store.putBlob(CANVAS, bytes, { mimeType, filename: `shot.${mimeType.split("/")[1]}` });
  await add(r, itemId, title, { blobHash: blob.blobHash, mimeType, size: bytes.length }, size);
}

/** What a sent picture decodes as: its format and size, read by sharp. */
async function decoded(data: string) {
  const { format, width, height, pages } = await sharp(Buffer.from(data, "base64")).metadata();
  return { format, width, height, pages };
}

/** The import as it fails where `sharp` (or its native half) is not installed. */
const noSharp = () => Promise.reject(Object.assign(new Error("Cannot find package 'sharp'"), { code: "ERR_MODULE_NOT_FOUND" }));

describe("looking at JPEG, WebP and GIF pictures (sharp)", () => {
  it("scales each over 1024 px down to it and sends it as an image block", async () => {
    const r = await rig();
    await pictureOf(r, "itm_jpeg", "Acme hero photo", await photo(2400, 1600, "jpeg"), "image/jpeg", { width: 600, height: 400 });
    await pictureOf(r, "itm_webp", "Acme team photo", await photo(1200, 1800, "webp"), "image/webp", { width: 500, height: 400 });
    await pictureOf(r, "itm_gif", "Acme spinner", await animatedGif(1600, 1200), "image/gif", { width: 400, height: 300 });
    await group(r, "itm_gallery", "Gallery", ["itm_jpeg", "itm_webp", "itm_gif"]);

    const res = await make(r, "itm_gallery", "group", true);
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toMatchObject({ vision: true, pictures: 3 });
    const { images, text } = sent(r.calls[0]!);
    expect(images).toHaveLength(3);
    expect(text).not.toContain("No picture was sent");
    // Largest on the canvas first: the JPEG, the WebP, the GIF — each re-encoded as a PNG or a JPEG, whichever was smaller.
    const sizes = await Promise.all(images.map((b) => decoded(b.source!.data)));
    expect(images.map((b) => b.source!.media_type).every((t) => t === "image/png" || t === "image/jpeg")).toBe(true);
    expect(sizes.map(({ width, height }) => ({ width, height }))).toEqual([
      { width: 1024, height: 683 },
      { width: 683, height: 1024 },
      { width: 1024, height: 768 },
    ]);
    // The photo-like JPEG comes out smaller as a JPEG; the flat GIF frame as a PNG.
    expect(images[0]!.source!.media_type).toBe("image/jpeg");
    expect(images[2]!.source!.media_type).toBe("image/png");
  });
});

describe("a picture made ready to send", () => {
  it("is sent whole within 1024 px, and scaled down by sharp over it — a GIF by its first frame", async () => {
    const small = await pictureToSend(png(300, 200), "image/png");
    expect(small).toMatchObject({ mediaType: "image/png", width: 300, height: 200 });
    const smallJpeg = await photo(800, 600, "jpeg");
    expect(await pictureToSend(smallJpeg, "image/jpeg")).toMatchObject({ mediaType: "image/jpeg", width: 800, height: 600, data: smallJpeg.toString("base64") });
    const tall = (await pictureToSend(png(500, 3000), "image/png"))!;
    expect({ width: tall.width, height: tall.height }).toEqual({ width: 171, height: 1024 });
    expect(await decoded(tall.data)).toMatchObject({ width: 171, height: 1024 });
    const gif = (await pictureToSend(await animatedGif(2048, 1024), "image/gif"))!;
    expect(await decoded(gif.data)).toMatchObject({ format: "png", width: 1024, height: 512 });
    const { data, info } = await sharp(Buffer.from(gif.data, "base64")).raw().toBuffer({ resolveWithObject: true });
    expect([...data.subarray(0, 3)], `first frame is red, not blue (${info.channels} channels)`).toEqual([255, 0, 0]);
    // A JPEG header saying 4000 × 3000 with nothing after it cannot be decoded: it goes by its title.
    const header = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x0b, 0xb8, 0x0f, 0xa0, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]);
    expect(await pictureToSend(header, "image/jpeg")).toBeNull();
    expect(await pictureToSend(Buffer.from("not a picture"), "image/png")).toBeNull();
  });

  it("without sharp keeps the PNG-only behaviour: a PNG scaled with node:zlib, anything else over 1024 px by its title", async () => {
    const tall = (await pictureToSend(png(500, 3000), "image/png", noSharp))!;
    expect({ mediaType: tall.mediaType, width: tall.width, height: tall.height }).toEqual({ mediaType: "image/png", width: 171, height: 1024 });
    expect(sizeOfPng(Buffer.from(tall.data, "base64"))).toEqual({ width: 171, height: 1024 });
    const smallJpeg = await photo(800, 600, "jpeg");
    expect(await pictureToSend(smallJpeg, "image/jpeg", noSharp)).toMatchObject({ mediaType: "image/jpeg", width: 800, height: 600 });
    expect(await pictureToSend(await photo(2400, 1600, "jpeg"), "image/jpeg", noSharp)).toBeNull();
    expect(await pictureToSend(await photo(1200, 1800, "webp"), "image/webp", noSharp)).toBeNull();
    expect(await pictureToSend(await animatedGif(1600, 1200), "image/gif", noSharp)).toBeNull();
    expect(await pictureToSend(Buffer.from("not a picture"), "image/png", noSharp)).toBeNull();
  });
});

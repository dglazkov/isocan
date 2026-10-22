#!/usr/bin/env node
/**
 * **Motion phase 0's browser proof** (`docs/projects/motion/phases.md`).
 *
 *     node scripts/motion-proof.mjs [--out <dir>]
 *
 * On a scratch home of its own — a temp `ISOCAN_HOME`, a free port, and an
 * unbound temp directory as the working directory, never the repo (whose
 * `.isocan/project.json` binds commands to a real canvas) — it adds the
 * three SVGs of Scene 1's Acme Bakery logo, runs `isocan motion new … --recipe
 * assemble` (and `--recipe idle`), and then, in headless Chrome:
 *
 * 1. opens the assemble motion's own document paused (`#still`) and calls
 *    `render(1.2)`, `render(1.2)` again, `render(0.3)`, then `render(1.2)`,
 *    screenshotting after each. The three 1.2 s frames must be identical
 *    pixel for pixel; the 0.3 s frame must differ from them (or the
 *    comparison proves nothing) and the 1.2 s frame must not be blank.
 * 2. opens the canvas in the app and screenshots it twice, a second apart,
 *    with the motions on it; the looping idle motion must have moved
 *    between the two — it is playing, live, on the canvas.
 *
 * Exit 0 when every comparison holds; the screenshots stay in `--out`
 * (default: a temp directory, printed). Needs a built `packages/web/dist`.
 */
import "../index.mjs";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";
import { browser, throughTheDoor, until } from "./lib/browser.mjs";

const { harnessVars } = await import("@isocan/api");

const repo = fileURLToPath(new URL("..", import.meta.url));
const cli = path.join(repo, "packages/cli/bin/isocan.js");
const fixtures = path.join(repo, "packages/core/test/fixtures/motion");
const argv = process.argv.slice(2);
const outArg = argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : undefined;
const out = outArg ? path.resolve(outArg) : mkdtempSync(path.join(tmpdir(), "isocan-motion-proof-"));
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const scratch = mkdtempSync(path.join(tmpdir(), "isocan-motion-home-"));
const home = path.join(scratch, "home");
const port = await new Promise((resolve) => {
  const server = createServer().listen(0, "127.0.0.1", () => {
    const { port: p } = server.address();
    server.close(() => resolve(p));
  });
});
const env = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port) };
for (const name of harnessVars) delete env[name];

function isocan(...args) {
  const r = spawnSync(process.execPath, [cli, "--port", String(port), ...args], { cwd: scratch, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`isocan ${args.join(" ")} exited ${r.status}: ${r.stderr}`);
  return r;
}

/** The pixels of a PNG Chrome wrote: 8-bit RGB or RGBA, not interlaced. */
function pixels(png) {
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  const depth = png[24], type = png[25], interlace = png[28];
  if (depth !== 8 || (type !== 2 && type !== 6) || interlace !== 0) throw new Error(`unexpected PNG: depth ${depth}, type ${type}, interlace ${interlace}`);
  const chunks = [];
  for (let o = 8; o < png.length;) {
    const len = png.readUInt32BE(o), kind = png.toString("ascii", o + 4, o + 8);
    if (kind === "IDAT") chunks.push(png.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const bpp = type === 6 ? 4 : 3, stride = width * bpp;
  const rgba = Buffer.alloc(width * height * 4);
  const prev = Buffer.alloc(stride), line = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const pred = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      line[x] = (v + pred) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      rgba[(y * width + x) * 4] = line[x * bpp];
      rgba[(y * width + x) * 4 + 1] = line[x * bpp + 1];
      rgba[(y * width + x) * 4 + 2] = line[x * bpp + 2];
      rgba[(y * width + x) * 4 + 3] = bpp === 4 ? line[x * bpp + 3] : 255;
    }
    line.copy(prev);
  }
  return { width, height, rgba };
}

/** How many pixels differ between two screenshots of one size. */
function differing(a, b) {
  if (a.width !== b.width || a.height !== b.height) throw new Error("screenshots of different sizes");
  let n = 0;
  for (let i = 0; i < a.rgba.length; i += 4) {
    if (a.rgba[i] !== b.rgba[i] || a.rgba[i + 1] !== b.rgba[i + 1] || a.rgba[i + 2] !== b.rgba[i + 2] || a.rgba[i + 3] !== b.rgba[i + 3]) n++;
  }
  return n;
}

/** The box around every pixel that differs — where on the screen the change was. */
function changedBox(a, b) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let i = 0; i < a.rgba.length; i += 4) {
    if (a.rgba[i] === b.rgba[i] && a.rgba[i + 1] === b.rgba[i + 1] && a.rgba[i + 2] === b.rgba[i + 2]) continue;
    const x = (i / 4) % a.width, y = Math.floor(i / 4 / a.width);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Pixels that are not the page's white — the drawing that is there. */
const inked = (p) => {
  let n = 0;
  for (let i = 0; i < p.rgba.length; i += 4) if (p.rgba[i] < 250 || p.rgba[i + 1] < 250 || p.rgba[i + 2] < 250) n++;
  return n;
};

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${what}`);
  if (!ok) failures.push(what);
};

let b;
try {
  mkdirSync(home, { recursive: true });
  writeFileSync(path.join(home, "identity.json"), JSON.stringify({ id: "usr_maya_motion", name: "Maya", createdAt: new Date().toISOString() }));
  const created = JSON.parse(isocan("canvas", "create", "Acme Bakery motion", "--json").stdout);
  const canvasId = created.canvasId;
  if (!canvasId) throw new Error(`no canvas id in ${JSON.stringify(created).slice(0, 200)}`);
  const on = ["--canvas", canvasId];
  const idOf = (title) => {
    const listed = JSON.parse(isocan("ls", ...on, "--json").stdout);
    return (Array.isArray(listed) ? listed : listed.items).find((i) => i.title === title).id;
  };
  isocan("add", path.join(fixtures, "circle.svg"), ...on, "--title", "Circle", "--at", "0,0", "--size", "200x200");
  isocan("add", path.join(fixtures, "wheat.svg"), ...on, "--title", "Wheat", "--at", "58,30", "--size", "84x140");
  isocan("add", path.join(fixtures, "wordmark.svg"), ...on, "--title", "Wordmark", "--at", "-60,210", "--size", "320x60");
  const logo = ["Circle", "Wheat", "Wordmark"].map(idOf);
  const assemble = isocan("motion", "new", ...logo, ...on, "--recipe", "assemble");
  process.stdout.write(assemble.stdout + assemble.stderr);
  const motionId = assemble.stdout.split(/\s+/)[0];
  const idle = isocan("motion", "new", ...logo, ...on, "--recipe", "idle", "--title", "Acme logo — idle");
  process.stdout.write(idle.stdout + idle.stderr);
  const doc = path.join(scratch, "assemble.html");
  isocan("get", motionId, doc, ...on);
  const spec = JSON.parse(/<script type="application\/json" id="motion-spec">(.*?)<\/script>/s.exec(readFileSync(doc, "utf8"))[1]);

  b = await browser();
  // --- 1. the document, frame by frame ----------------------------------
  await b.send("Emulation.setDeviceMetricsOverride", { width: spec.stage.width, height: spec.stage.height, deviceScaleFactor: 2, mobile: false });
  const loaded = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: `${pathToFileURL(doc).href}#still` });
  await loaded;
  await until(b, `typeof window.render === "function" && !!window.motion`, "the motion player");
  const frame = async (t, name) => {
    await b.ev(`window.render(${t})`);
    // Two animation frames: the attribute writes are painted before the shot.
    await b.ev(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`);
    const shot = Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64");
    writeFileSync(path.join(out, name), shot);
    return pixels(shot);
  };
  const a1 = await frame(1.2, "doc-1.2-first.png");
  const a2 = await frame(1.2, "doc-1.2-again.png");
  const mid = await frame(0.3, "doc-0.3.png");
  const a3 = await frame(1.2, "doc-1.2-after-0.3.png");
  const done = await frame(spec.seconds, "doc-end.png");
  check(differing(a1, a2) === 0, `render(1.2) twice: identical (${differing(a1, a2)} of ${a1.width * a1.height} pixels differ)`);
  check(differing(a1, a3) === 0, `render(1.2) after render(0.3): identical to the first (${differing(a1, a3)} differ)`);
  check(differing(a1, mid) > 0, `render(0.3) is a different frame (${differing(a1, mid)} pixels differ from 1.2 s)`);
  check(inked(a1) > 1000, `the 1.2 s frame has the logo in it (${inked(a1)} inked pixels)`);
  check(inked(done) > inked(mid), `the last frame carries more of the logo than 0.3 s (${inked(done)} vs ${inked(mid)})`);
  const errors = b.takeErrors();
  check(errors.length === 0, `the document threw nothing${errors.length ? `: ${errors.join("; ")}` : ""}`);

  // --- 2. on the canvas, playing ----------------------------------------
  await b.send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  const origin = `http://127.0.0.1:${port}`;
  const atOrigin = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: origin });
  await Promise.race([atOrigin, sleep(15_000)]);
  await throughTheDoor(b, origin, "Camera", "motion-proof");
  const opened = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: `${origin}/p/${canvasId}` });
  await Promise.race([opened, sleep(15_000)]);
  await until(b, `document.querySelector(".canvas-viewport") !== null`, "the canvas to render", 20_000);
  await sleep(1500);
  for (const type of ["keyDown", "keyUp"]) {
    await b.send("Input.dispatchKeyEvent", { type, key: "!", code: "Digit1", modifiers: 8, windowsVirtualKeyCode: 49 });
  }
  await sleep(4000);
  const frames = await b.ev(`document.querySelectorAll("iframe").length`);
  const shot = async (name) => {
    const png = Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64");
    writeFileSync(path.join(out, name), png);
    return pixels(png);
  };
  const c1 = await shot("canvas-1.png");
  await sleep(1000);
  const c2 = await shot("canvas-2.png");
  check(frames >= 2, `the canvas carries the motion items as live frames (${frames} iframes)`);
  // Where the idle motion's frame is on screen, so the change is placed
  // inside it and not anywhere else on the page.
  const idleRect = await b.ev(`(() => {
    const f = [...document.querySelectorAll("iframe")].map((el) => el.getBoundingClientRect())
      .sort((p, q) => q.left - p.left)[0];
    return f ? { x0: f.left, y0: f.top, x1: f.right, y1: f.bottom } : null;
  })()`);
  const moved = changedBox(c1, c2);
  const inside = moved && idleRect && moved.x0 >= idleRect.x0 - 1 && moved.y0 >= idleRect.y0 - 1 && moved.x1 <= idleRect.x1 + 1 && moved.y1 <= idleRect.y1 + 1;
  check(differing(c1, c2) > 0 && inside, `the idle motion moved on the canvas between two shots a second apart (${differing(c1, c2)} pixels, all inside its frame: ${JSON.stringify(moved)} within ${JSON.stringify(idleRect)})`);
} finally {
  await b?.close();
  spawnSync(process.execPath, [cli, "--port", String(port), "stop"], { cwd: scratch, env, encoding: "utf8" });
  rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

console.log(`screenshots in ${out}`);
if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed`);
  process.exitCode = 1;
}

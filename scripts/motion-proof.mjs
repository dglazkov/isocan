#!/usr/bin/env node
/**
 * **Motion's browser proof, phases 0, 1 and 3** (`docs/projects/motion/phases.md`).
 *
 *     node scripts/motion-proof.mjs [--out <dir>] [--no-movie] [--no-mp4]
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
 * Phase 1, the movie (skipped with `--no-movie`):
 *
 * 3. `isocan motion render <assemble> --fps 60 --seconds 6 --size 1080 --out`
 *    — the CLI, through its headless browser. `ffprobe` must count 360
 *    frames of h264 at 1080x1080, and the canvas must carry the video item
 *    with `renderedFrom`.
 * 4. The same render page opened the way phase 2's *Render movie…* will open
 *    it: a hidden frame on the canvas page, in this second, separate headless
 *    session, asked to keep its pre-encode pictures of frames 0, 72 and 359.
 * 5. `ffmpeg` (this proof's only — product code never runs it) decodes frames
 *    0, 72 and 359 of both movies. Each decoded CLI frame must match the
 *    page's pre-encode picture of the same frame (mean absolute difference
 *    per channel under MAD_LIMIT) and sit nearer it than any other kept
 *    picture, the hidden frame's movie must decode to
 *    the CLI's (the same bound), and — so the comparison is not of things
 *    with themselves — frame 72 against the picture of 359 must be far
 *    outside it.
 * 6. The video item on the canvas: loaded at 1080 × 1080 and 6 s long, its
 *    clock moves once it is played, screenshotted.
 *
 * Phase 3, the other formats (skipped with `--no-movie`; `--no-mp4` skips 3–6
 * and keeps these), for a WebM and then a GIF in turn:
 *
 * 7. `isocan motion render <assemble> --webm` (and `--gif`), at the motion's
 *    own 2.4 s and the format's own rate — 60 fps, and a GIF's 30. `ffprobe`
 *    must read vp9 (gif) at 1080x1080 with fps × 2.4 frames — 144 and 72 —
 *    and the canvas must carry a `video/webm` (`image/gif`) item whose
 *    `renderedFrom` says the format.
 * 8. The same page in a hidden frame, keeping its pictures of the first, the
 *    middle (1.2 s) and the last frame. Each decoded CLI frame must sit
 *    within the format's bound of the picture that was encoded, and nearer it
 *    than any other kept picture; the hidden frame's file must decode to the
 *    CLI's within the same bound. A GIF has its own, looser bound (below).
 * 9. On the canvas: the WebM loads at 1080 × 1080 and its clock moves once
 *    played; the GIF loads as a picture at 1080 × 1080; and for each, two
 *    screenshots 0.6 s apart differ INSIDE the item's own rectangle — it is
 *    moving there, not elsewhere on the page.
 *
 * Exit 0 when every comparison holds; the screenshots and movies stay in
 * `--out` (default: a temp directory, printed). Needs a built
 * `packages/web/dist`, Chrome, and for phase 1 `ffmpeg`/`ffprobe` on PATH.
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
const { motionRenderUrl } = await import("@isocan/core");

const repo = fileURLToPath(new URL("..", import.meta.url));
const cli = path.join(repo, "packages/cli/bin/isocan.js");
const fixtures = path.join(repo, "packages/core/test/fixtures/motion");
const argv = process.argv.slice(2);
const outArg = argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : undefined;
const out = outArg ? path.resolve(outArg) : mkdtempSync(path.join(tmpdir(), "isocan-motion-proof-"));
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const movie = !argv.includes("--no-movie");
const mp4 = movie && !argv.includes("--no-mp4");

/**
 * **How far a decoded frame may sit from the picture that was encoded**: a
 * mean of 3 levels in 255 per channel. H.264 is lossy (4:2:0 chroma,
 * quantised blocks at every edge), and Chrome's encoder lands this page's
 * white at Y 234–236, which decodes to 253–254 rather than 255 — so on
 * 22 Oct 2026 the three frames measured 2.00, 2.10 and 2.15, most of it that
 * flat offset. Two DIFFERENT frames of this logo measured 7.2 and 9.2 (the
 * proof prints its control), and each decoded frame must also sit closer to
 * its own picture than to any other kept one, so the bound tells a frame
 * from its neighbour rather than merely "a frame of this logo".
 */
const MAD_LIMIT = 3;

/**
 * **The other formats' bounds** (motion phase 3). A WebM is VP9 — lossy the
 * same way H.264 is, so the same bound. A GIF loses differently: no chroma
 * subsampling and no blocks, but a palette of at most 256 colours a frame,
 * so wherever a frame has more (the logo's anti-aliased edges, a fade) a
 * colour lands on its nearest entry. Those losses are small and few: on
 * 22 Oct 2026 the logo's GIF frames measured 0.000, 0.005 and 0.005 (the
 * first frame, all white, kept exactly; the others' worst pixel 7 off), so
 * the bound is 1 — tighter than the movies', yet looser than what was
 * measured, for a drawing with more colours than this one. The same
 * nearest-its-own-picture check holds the GIF to telling frames apart.
 */
const FORMAT_LIMIT = { webm: MAD_LIMIT, gif: 1 };

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

/** How many pixels differ between two screenshots inside one rectangle of the screen. */
function differingIn(a, b, r) {
  let n = 0;
  for (let y = Math.max(0, Math.ceil(r.y0)); y < Math.min(a.height, Math.floor(r.y1)); y++) {
    for (let x = Math.max(0, Math.ceil(r.x0)); x < Math.min(a.width, Math.floor(r.x1)); x++) {
      const i = (y * a.width + x) * 4;
      if (a.rgba[i] !== b.rgba[i] || a.rgba[i + 1] !== b.rgba[i + 1] || a.rgba[i + 2] !== b.rgba[i + 2]) n++;
    }
  }
  return n;
}

/** Pixels that are not the page's white — the drawing that is there. */
const inked = (p) => {
  let n = 0;
  for (let i = 0; i < p.rgba.length; i += 4) if (p.rgba[i] < 250 || p.rgba[i + 1] < 250 || p.rgba[i + 2] < 250) n++;
  return n;
};

/** What ffprobe says about a movie's one video stream, frames counted by decoding. */
function ffprobe(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=codec_name,width,height,nb_read_frames,duration", "-of", "json", file], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffprobe ${file}: ${r.stderr || r.error}`);
  const s = JSON.parse(r.stdout).streams[0];
  return { codec: s.codec_name, width: s.width, height: s.height, frames: Number(s.nb_read_frames), duration: s.duration };
}

/** Frame `n` of a movie, decoded by ffmpeg to packed RGB. */
function decodeFrame(file, n, width, height) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `select=eq(n\\,${n})`, "-fps_mode", "passthrough", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(`ffmpeg frame ${n} of ${file}: ${r.stderr}`);
  if (r.stdout.length !== width * height * 3) throw new Error(`ffmpeg gave ${r.stdout.length} bytes for frame ${n}, not ${width * height * 3}`);
  return r.stdout;
}

/** A PNG's pixels as packed RGB, to compare with a decoded frame. */
function rgbOf(p) {
  const rgb = Buffer.alloc(p.width * p.height * 3);
  for (let i = 0, j = 0; i < p.rgba.length; i += 4, j += 3) { rgb[j] = p.rgba[i]; rgb[j + 1] = p.rgba[i + 1]; rgb[j + 2] = p.rgba[i + 2]; }
  return rgb;
}

/** Mean absolute difference per channel, 0–255. */
function mad(a, b) {
  if (a.length !== b.length) throw new Error(`frames of different sizes: ${a.length} and ${b.length}`);
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

const maxDiff = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };

/** A decoded frame kept for a person to look at, in the simplest format there is. */
const writePpm = (file, rgb, width, height) => writeFileSync(file, Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`), rgb]));

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

  if (mp4) {
    // --- 3. the movie, from the CLI ---------------------------------------
    const cliMovie = path.join(out, "movie-cli.mp4");
    const started = Date.now();
    const rendered = isocan("motion", "render", motionId, ...on, "--fps", "60", "--seconds", "6", "--size", "1080", "--out", cliMovie);
    process.stdout.write(rendered.stdout + rendered.stderr);
    console.log(`(the CLI render took ${((Date.now() - started) / 1000).toFixed(1)} s)`);
    const probe = ffprobe(cliMovie);
    check(probe.frames === 360 && probe.codec === "h264" && probe.width === 1080 && probe.height === 1080,
      `ffprobe: ${probe.frames} frames, ${probe.codec}, ${probe.width}x${probe.height}, ${probe.duration} s (want 360, h264, 1080x1080)`);
    const videoId = /^(itm_\S+)\s/m.exec(rendered.stdout)?.[1];
    const shown = videoId ? JSON.parse(isocan("show", videoId, ...on, "--json").stdout) : null;
    const versionOf = shown?.versions?.find((v) => v.id === shown.currentVersionId);
    check(versionOf?.mimeType === "video/mp4", `the CLI added a video/mp4 item (${videoId}: ${versionOf?.mimeType})`);
    const from = shown?.properties?.renderedFrom ? JSON.parse(shown.properties.renderedFrom) : null;
    check(!!from && from.item === motionId && from.fps === 60 && from.size === "1080x1080" && from.seconds === 6 && from.background === "#ffffff" && typeof from.version === "string",
      `the video item beside the motion wears renderedFrom ${JSON.stringify(from)}`);

    // --- 4. the same page in a hidden frame, keeping its pictures ----------
    const keep = [0, 72, 359];
    const hiddenUrl = motionRenderUrl(origin, canvasId, motionId, { fps: 60, seconds: 6, size: 1080, keep: keep.join(",") });
    await b.ev(`(() => {
      const f = document.createElement("iframe");
      f.id = "motion-render-frame";
      f.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;border:0";
      f.src = ${JSON.stringify(hiddenUrl)};
      document.body.appendChild(f);
      return true;
    })()`);
    const inFrame = `document.getElementById("motion-render-frame").contentWindow`;
    await until(b, `!!${inFrame}.isocanMotionRender && ["done", "error"].includes(${inFrame}.isocanMotionRender.status.state)`, "the hidden frame's render", 600_000);
    const hidden = await b.ev(`${inFrame}.isocanMotionRender.status`);
    check(hidden.state === "done", `the hidden frame rendered: ${hidden.state}${hidden.error ? ` — ${hidden.error}` : ""} (${hidden.frames} frames, ${hidden.codec})`);
    const size = await b.ev(`${inFrame}.isocanMotionRender.size`);
    const parts = [];
    for (let o = 0; o < size; o += 4 << 20) parts.push(Buffer.from(await b.ev(`${inFrame}.isocanMotionRender.chunk(${o}, ${4 << 20})`), "base64"));
    const frameMovie = path.join(out, "movie-hidden-frame.mp4");
    writeFileSync(frameMovie, Buffer.concat(parts));
    const keptUrls = await b.ev(`${inFrame}.isocanMotionRender.kept`);
    const kept = {};
    for (const n of keep) {
      const png = Buffer.from(keptUrls[n].replace(/^data:image\/png;base64,/, ""), "base64");
      writeFileSync(path.join(out, `pre-encode-${n}.png`), png);
      kept[n] = rgbOf(pixels(png));
    }
    const hiddenProbe = ffprobe(frameMovie);
    check(hiddenProbe.frames === 360 && hiddenProbe.codec === "h264", `the hidden frame's movie: ${hiddenProbe.frames} frames of ${hiddenProbe.codec}`);

    // --- 5. decoded frames, against the pictures that were encoded ---------
    for (const n of keep) {
      const fromCli = decodeFrame(cliMovie, n, 1080, 1080);
      const fromFrame = decodeFrame(frameMovie, n, 1080, 1080);
      writePpm(path.join(out, `decoded-cli-${n}.ppm`), fromCli, 1080, 1080);
      const vsPicture = mad(fromCli, kept[n]);
      const vsFrame = mad(fromCli, fromFrame);
      check(vsPicture < MAD_LIMIT, `frame ${n}: the CLI's decoded frame against the page's pre-encode picture — mean abs diff ${vsPicture.toFixed(3)} (max ${maxDiff(fromCli, kept[n])}) < ${MAD_LIMIT}`);
      check(vsFrame < MAD_LIMIT, `frame ${n}: the hidden frame's decoded frame against the CLI's — mean abs diff ${vsFrame.toFixed(3)} < ${MAD_LIMIT}`);
    }
    for (const n of keep) {
      const decoded = decodeFrame(cliMovie, n, 1080, 1080);
      const distances = keep.map((k) => [k, mad(decoded, kept[k])]);
      const nearest = distances.reduce((a, c) => (c[1] < a[1] ? c : a));
      check(nearest[0] === n, `decoded frame ${n} is nearest its own pre-encode picture (${distances.map(([k, d]) => `${k}: ${d.toFixed(2)}`).join(", ")})`);
    }
    const control = mad(decodeFrame(cliMovie, 72, 1080, 1080), kept[359]);
    const control0 = mad(kept[0], kept[72]);
    check(control > MAD_LIMIT * 2 && control0 > MAD_LIMIT * 2, `control: decoded frame 72 against the picture of 359 differs by ${control.toFixed(3)}, picture 0 against 72 by ${control0.toFixed(3)} — the bound tells frames apart`);

    // --- 6. the video item, playing on the canvas --------------------------
    await b.ev(`document.getElementById("motion-render-frame").remove()`);
    for (const type of ["keyDown", "keyUp"]) {
      await b.send("Input.dispatchKeyEvent", { type, key: "!", code: "Digit1", modifiers: 8, windowsVirtualKeyCode: 49 });
    }
    await until(b, `[...document.querySelectorAll("video.video-view")].some((v) => v.readyState >= 2)`, "the video item to load on the canvas", 30_000);
    const facts = await b.ev(`(async () => {
      const v = [...document.querySelectorAll("video.video-view")].find((el) => el.readyState >= 2);
      const before = v.currentTime;
      await v.play();
      await new Promise((r) => setTimeout(r, 1500));
      return { width: v.videoWidth, height: v.videoHeight, duration: v.duration, before, after: v.currentTime, paused: v.paused };
    })()`);
    await shot("canvas-video.png");
    check(facts.width === 1080 && facts.height === 1080 && Math.abs(facts.duration - 6) < 0.05 && facts.after > facts.before && !facts.paused,
      `the video item plays on the canvas: ${facts.width}x${facts.height}, ${facts.duration.toFixed(3)} s, clock ${facts.before.toFixed(2)} → ${facts.after.toFixed(2)}`);
  }

  if (movie) {
    // --- 7–9. the same motion as a WebM, then a GIF -----------------------
    const fitCanvas = async () => {
      for (const type of ["keyDown", "keyUp"]) {
        await b.send("Input.dispatchKeyEvent", { type, key: "!", code: "Digit1", modifiers: 8, windowsVirtualKeyCode: 49 });
      }
      await sleep(2000);
    };
    for (const [format, codec, mime, fps] of [["webm", "vp9", "video/webm", 60], ["gif", "gif", "image/gif", 30]]) {
      const limit = FORMAT_LIMIT[format];
      const frames = Math.round(fps * spec.seconds);
      const file = path.join(out, `movie-cli.${format}`);
      const started = Date.now();
      const rendered = isocan("motion", "render", motionId, ...on, `--${format}`, "--size", "1080", "--out", file);
      process.stdout.write(rendered.stdout + rendered.stderr);
      const took = (Date.now() - started) / 1000;
      const probe = ffprobe(file);
      const bytes = readFileSync(file).length;
      check(probe.codec === codec && probe.width === 1080 && probe.height === 1080 && probe.frames === frames,
        `${format}: ffprobe reads ${probe.frames} frames of ${probe.codec} at ${probe.width}x${probe.height}, ${(bytes / 1e6).toFixed(2)} MB, rendered in ${took.toFixed(1)} s (want ${frames} = ${fps} fps × ${spec.seconds} s of ${codec})`);
      const itemId = /^(itm_\S+)\s/m.exec(rendered.stdout)?.[1];
      const shown = itemId ? JSON.parse(isocan("show", itemId, ...on, "--json").stdout) : null;
      const version = shown?.versions?.find((v) => v.id === shown.currentVersionId);
      const from = shown?.properties?.renderedFrom ? JSON.parse(shown.properties.renderedFrom) : null;
      check(version?.mimeType === mime && from?.format === format && from.item === motionId && from.fps === fps && from.size === "1080x1080" && from.seconds === spec.seconds,
        `${format}: the CLI added a ${version?.mimeType} item (${itemId}) wearing renderedFrom ${JSON.stringify(from)}`);

      // The same page in a hidden frame, keeping the first, middle and last pictures.
      const keep = [0, frames / 2, frames - 1];
      const hiddenUrl = motionRenderUrl(origin, canvasId, motionId, { format, size: 1080, keep: keep.join(",") });
      await b.ev(`(() => {
        document.getElementById("motion-render-frame")?.remove();
        const f = document.createElement("iframe");
        f.id = "motion-render-frame";
        f.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;border:0";
        f.src = ${JSON.stringify(hiddenUrl)};
        document.body.appendChild(f);
        return true;
      })()`);
      const inFrame = `document.getElementById("motion-render-frame").contentWindow`;
      await until(b, `!!${inFrame}.isocanMotionRender && ["done", "error"].includes(${inFrame}.isocanMotionRender.status.state)`, `the hidden frame's ${format}`, 600_000);
      const hidden = await b.ev(`${inFrame}.isocanMotionRender.status`);
      check(hidden.state === "done" && (format === "gif" ? hidden.codec === "gif" : hidden.codec.startsWith("vp09.")) && hidden.frames === frames,
        `${format}: the hidden frame rendered: ${hidden.state}${hidden.error ? ` — ${hidden.error}` : ""} (${hidden.frames} frames, ${hidden.codec})`);
      const size = await b.ev(`${inFrame}.isocanMotionRender.size`);
      const parts = [];
      for (let o = 0; o < size; o += 4 << 20) parts.push(Buffer.from(await b.ev(`${inFrame}.isocanMotionRender.chunk(${o}, ${4 << 20})`), "base64"));
      const frameFile = path.join(out, `movie-hidden-frame.${format}`);
      const frameBytes = Buffer.concat(parts);
      writeFileSync(frameFile, frameBytes);
      const keptUrls = await b.ev(`${inFrame}.isocanMotionRender.kept`);
      await b.ev(`document.getElementById("motion-render-frame").remove()`);
      const kept = {};
      for (const n of keep) {
        const png = Buffer.from(keptUrls[n].replace(/^data:image\/png;base64,/, ""), "base64");
        writeFileSync(path.join(out, `pre-encode-${format}-${n}.png`), png);
        kept[n] = rgbOf(pixels(png));
      }
      const hiddenProbe = ffprobe(frameFile);
      check(hiddenProbe.frames === frames && hiddenProbe.codec === codec, `${format}: the hidden frame's file: ${hiddenProbe.frames} frames of ${hiddenProbe.codec}${format === "gif" ? ` — ${frameBytes.equals(readFileSync(file)) ? "byte for byte the CLI's" : "not byte-identical to the CLI's"}` : ""}`);

      // Decoded frames against the pictures that were encoded.
      const decoded = {};
      for (const n of keep) {
        decoded[n] = decodeFrame(file, n, 1080, 1080);
        writePpm(path.join(out, `decoded-cli-${format}-${n}.ppm`), decoded[n], 1080, 1080);
        const vsPicture = mad(decoded[n], kept[n]);
        const vsFrame = mad(decoded[n], decodeFrame(frameFile, n, 1080, 1080));
        check(vsPicture < limit, `${format} frame ${n}: decoded against the page's pre-encode picture — mean abs diff ${vsPicture.toFixed(3)} (max ${maxDiff(decoded[n], kept[n])}) < ${limit}`);
        check(vsFrame < limit, `${format} frame ${n}: the hidden frame's decoded frame against the CLI's — mean abs diff ${vsFrame.toFixed(3)} < ${limit}`);
      }
      for (const n of keep) {
        const distances = keep.map((k) => [k, mad(decoded[n], kept[k])]);
        const nearest = distances.reduce((a, c) => (c[1] < a[1] ? c : a));
        check(nearest[0] === n && distances.every(([k, d]) => k === n || d > limit), `${format}: decoded frame ${n} is nearest its own picture, and outside the bound of the others (${distances.map(([k, d]) => `${k}: ${d.toFixed(2)}`).join(", ")})`);
      }

      // On the canvas: loaded, and moving inside its own rectangle.
      await fitCanvas();
      const selector = format === "gif" ? `.item[data-item-id="${itemId}"] img.img-view` : `.item[data-item-id="${itemId}"] video.video-view`;
      await until(b, format === "gif" ? `document.querySelector('${selector}')?.complete && document.querySelector('${selector}').naturalWidth > 0` : `document.querySelector('${selector}')?.readyState >= 2`, `the ${format} item to load on the canvas`, 30_000);
      const facts = await b.ev(`(async () => {
        const el = document.querySelector('${selector}');
        const r = el.getBoundingClientRect();
        const rect = { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
        if (el.tagName === "IMG") return { width: el.naturalWidth, height: el.naturalHeight, rect };
        const before = el.currentTime;
        await el.play();
        await new Promise((res) => setTimeout(res, 300));
        return { width: el.videoWidth, height: el.videoHeight, duration: el.duration, before, after: el.currentTime, paused: el.paused, rect };
      })()`);
      const s1 = await shot(`canvas-${format}-1.png`);
      await sleep(600);
      const s2 = await shot(`canvas-${format}-2.png`);
      const inside = differingIn(s1, s2, facts.rect);
      const loadedOk = facts.width === 1080 && facts.height === 1080 && (format === "gif" || (Math.abs(facts.duration - spec.seconds) < 0.05 && facts.after > facts.before && !facts.paused));
      check(loadedOk, `${format}: on the canvas at ${facts.width}x${facts.height}${format === "gif" ? "" : `, ${facts.duration?.toFixed(3)} s, clock ${facts.before?.toFixed(2)} → ${facts.after?.toFixed(2)}`}`);
      const area = Math.round((facts.rect.x1 - facts.rect.x0) * (facts.rect.y1 - facts.rect.y0));
      check(inside > 0, `${format}: two screenshots 0.6 s apart differ inside the item (${inside} of ${area} pixels in ${JSON.stringify(Object.fromEntries(Object.entries(facts.rect).map(([k, v]) => [k, Math.round(v)])))})`);
    }
  }
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

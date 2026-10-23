#!/usr/bin/env node
/**
 * **Motion's browser proof, phases 0 and 1** (`docs/projects/motion/phases.md`).
 *
 *     node scripts/motion-proof.mjs [--out <dir>] [--no-movie]
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

  if (movie) {
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

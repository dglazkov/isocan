#!/usr/bin/env node
/**
 * **The frame budget, measured on a real canvas** — the persona's "real
 * subject", which until now had no instrument (26 Sep 2026).
 *
 *   npm run build
 *   node scripts/frames.mjs                    # 250 notes, CPU throttled 4x
 *   node scripts/frames.mjs --items 60 --throttle 1
 *   node scripts/frames.mjs --profile out.json # also a sampling profile per gesture,
 *                                              #   grouped by source file when
 *                                              #   dist/ was built with sourcemaps
 *   node scripts/frames.mjs --grounds          # each living ground instead: see below
 *   node scripts/frames.mjs --grounds --record scripts/ground-frames.json
 *
 * `docs/research/2026-08-29-performance.md` measured the frame budget with a
 * harness that lived and died in one session, so nothing measured it again —
 * and when two regressions arrived (every item re-rendering on every step of a
 * zoom, and on every operation anybody made), nothing noticed. This is that
 * harness, kept: a daemon of its own on a throwaway home, a canvas seeded
 * through `@isocan/api`, headless Chrome through `scripts/lib/browser.mjs`, and
 * five gestures —
 *
 * - **pan**: ninety wheel events across the canvas;
 * - **zoom**: sixty ctrl-wheel events, out and back;
 * - **remote**: another client moving one item sixty times while this browser
 *   only watches — the cost of somebody ELSE working, which no local gesture
 *   shows;
 * - **cursor**: another client's cursor crossing the canvas sixty times, and
 *   nothing else — the cost of somebody merely being here (27 Sep 2026,
 *   cleanup RP-1: every roster used to re-render every item);
 * - **drag**: this browser's own pointer dragging one item sixty steps — the
 *   gesture everything drawn from items (map edges, arrows, pins) has to ride
 *   frame by frame (30 Sep 2026, when the lines stopped lagging the drag);
 * - **remote-drag**: a SECOND browser dragging one item sixty steps while this
 *   one only watches — somebody else's drag, which since groups-by-hand phase
 *   3 (1 Oct 2026) travels on presence and is drawn here as a ghost. On 26 Sep
 *   exactly this load froze every viewer at two frames a second, so it is
 *   measured rather than argued. `ghostPositions` says how many distinct
 *   offsets the ghost was drawn at (0 on a build without live drag).
 *
 * Each reports the long-frame TAIL — p90, p99, worst, and how many frames went
 * over 16.7 and 32 ms — never an average (an average of 9 ms with one frame in
 * seven at 33 reads as smooth and feels like stutter). The CPU is throttled 4x
 * by default, because the machine this runs on is not the one the app is felt on.
 *
 * **`--grounds` measures the living grounds instead** (living grounds phase 5,
 * 10 Oct 2026): a handful of notes, and for every name in core's `LIVING` the
 * canvas wears the ground and a pointer walks a figure across it, three times.
 * Each ground reports the frame gaps of those walks (p50, p95, worst), the
 * frames a 60 Hz screen would have dropped, the main thread's time per frame
 * (every task: script, style, layout, paint — in throttled milliseconds),
 * and how many frames the ground itself drew. The same walk on the plain
 * ground is printed first, because a number with nothing beside it cannot say
 * what the ground added. And it reports **the asleep state**: frames drawn
 * while nothing moved, before and after each walk, which must be zero — a
 * ground that cannot sleep is the regression this exists to show.
 *
 * What it does NOT report is GPU time. The bench
 * (`docs/projects/living-grounds/prototype/`) takes that with a timer query
 * inside its own draw; from outside the page there is no honest way to bracket
 * another program's draw calls, and CDP's throttle slows the CPU only. A GPU
 * that cannot keep up still shows here, as long frame gaps. The first line it
 * prints is the machine, the GL renderer and the viewport, because the budget
 * in design.md names an M1 at 1440p and a reading means nothing without them.
 * `--record <file>` writes the reading as JSON; `measure.mjs ground-frame-ms`
 * reads `scripts/ground-frames.json`, so the performance persona's number is
 * the last reading somebody took, and says when and on what.
 *
 * **It refuses rather than reports** — the lesson of the August run, where the
 * guard fired three times on pages that were not the app. A gesture whose
 * camera did not move is a wheel that reached nothing, and reading its frames
 * would report a flawless 16.7 ms from a page doing no work.
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os, { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The long-frame tail of a list of inter-frame gaps, in ms. */
export function frameStats(gaps) {
  const s = [...gaps].sort((a, b) => a - b);
  if (s.length === 0) return { frames: 0, p50: 0, p90: 0, p99: 0, worst: 0, over16: 0, over32: 0 };
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { frames: s.length, p50: q(0.5), p90: q(0.9), p99: q(0.99), worst: s[s.length - 1], over16: s.filter((x) => x > 16.7).length, over32: s.filter((x) => x > 32).length };
}

/**
 * **What a walk across a living ground cost**, from its inter-frame gaps: the
 * middle, the tail a person feels (p95), the worst, and how many frames a
 * screen refreshing at `hz` would have shown twice — a gap of two refreshes is
 * one dropped frame, three is two. Counted against the refresh rather than a
 * fixed 16.7 ms threshold, so one gap of 50 ms reads as two dropped frames and
 * not as one long one.
 */
export function groundCost(gaps, hz = 60) {
  const s = [...gaps].sort((a, b) => a - b);
  if (s.length === 0) return { frames: 0, p50: 0, p95: 0, worst: 0, dropped: 0 };
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const refresh = 1000 / hz;
  return { frames: s.length, p50: q(0.5), p95: q(0.95), worst: s[s.length - 1], dropped: s.reduce((n, g) => n + Math.max(0, Math.round(g / refresh) - 1), 0) };
}

/**
 * The `--grounds` census: the plain ground, then every living one, on a page
 * that is already open on the canvas with the CPU throttled. Returns the
 * reading; refuses (throws) when a ground did not draw, fell back to its
 * still, or the page is not refreshing at 60 Hz.
 */
async function groundsCensus({ b, run, until, sleep, canvasId, living, runs, steps }) {
  const round = (n) => Math.round(n * 10) / 10;
  const view = await b.ev(`(() => { const r = document.querySelector(".canvas-viewport").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
  const gl = await b.ev(`(() => { const g = document.createElement("canvas").getContext("webgl2"); if (!g) return null; const e = g.getExtension("WEBGL_debug_renderer_info"); return String(e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER)); })()`);
  if (!gl) throw new Error("REFUSED: this browser has no WebGL2 — every living ground would be its still, and a still costs nothing to measure");
  await b.send("Performance.enable");
  const main = async () => { const m = Object.fromEntries((await b.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value])); return { task: m.TaskDuration * 1000, script: m.ScriptDuration * 1000 }; };
  // Scoped to the ground's own layer: for a moment after a change of ground
  // the page holds the old one's canvas too, and its frame count is not this one's.
  const ground = (name) => b.ev(`(() => { const c = document.querySelector(".canvas-theme-${name} canvas.ground-canvas"); return c && c.groundProbe ? { state: c.dataset.groundState ?? null, frames: c.groundProbe.frames(), size: c.width + "x" + c.height } : null; })()`);
  const asleep = (name, what, ms) => until(b, `document.querySelectorAll("canvas.ground-canvas").length === 1 && document.querySelector(".canvas-theme-${name} canvas.ground-canvas")?.dataset.groundState === "asleep"`, what, ms);
  const probe = `(() => { window.__gaps = []; let last = performance.now(); const f = (t) => { window.__gaps.push(t - last); last = t; if (window.__on) requestAnimationFrame(f); }; window.__on = true; requestAnimationFrame(f); return true; })()`;
  const collect = `(() => { window.__on = false; return window.__gaps.slice(1); })()`;
  // A figure that crosses bare ground and the notes alike, the way a hand
  // wanders while reading: two loops across, three down, inside the viewport.
  const walk = async () => {
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 2 * Math.PI;
      await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: Math.round(view.x + view.w * (0.5 + 0.36 * Math.sin(2 * t))), y: Math.round(view.y + view.h * (0.5 + 0.32 * Math.sin(3 * t + 1))), button: "none", buttons: 0 });
      await sleep(16);
    }
  };
  const measure = async (name) => {
    const livingOne = name !== "plain";
    if (livingOne) {
      // The page reuses one <canvas> from ground to ground, and until the new
      // ground's chunk has loaded it still carries the LAST one's probe and its
      // "asleep" — which read as snow drawing minus 3,877 frames in its sleep.
      // So the old probe is remembered, and the new ground is the one that is not it.
      await b.ev(`(() => { window.__lastProbe = document.querySelector("canvas.ground-canvas")?.groundProbe ?? null; return true; })()`);
      run("--canvas", canvasId, "canvas", "background", name);
      await until(b, `(() => { const p = document.querySelector(".canvas-theme-${name} canvas.ground-canvas")?.groundProbe; return (!!p && p !== window.__lastProbe) || !!document.querySelector(".canvas-theme-painted.canvas-theme-${name}"); })()`, `the ${name} ground to arrive`, 30_000);
      if (!(await ground(name))) throw new Error(`REFUSED: ${name} arrived as its still picture with WebGL2 available — there is no living ground here to measure`);
      await sleep(500); // its mount paint is under way: "asleep" from here on is its own
      await asleep(name, `${name} to fall asleep untouched`, 25_000);
    } else await walk(); // the first walk on a fresh page pays for code no later one does, so it is not timed

    const gaps = []; let drawn = 0, asleepFrames = 0, task = 0, script = 0, sleptAfter = 0, size = null;
    for (let r = 0; r < runs; r++) {
      const rest = livingOne ? await ground(name) : null;
      if (rest) { await sleep(1500); asleepFrames += (await ground(name)).frames - rest.frames; }
      const before = livingOne ? await ground(name) : null;
      const m0 = await main();
      await b.ev(probe);
      await walk();
      const got = await b.ev(collect);
      const m1 = await main();
      const stopped = Date.now();
      if (got.length < steps / 4) throw new Error(`REFUSED: the ${name} walk saw only ${got.length} frames — the page is not drawing`);
      gaps.push(...got); task += m1.task - m0.task; script += m1.script - m0.script;
      if (livingOne) {
        const after = await ground(name);
        if (after.frames - before.frames < got.length / 4) throw new Error(`REFUSED: ${name} drew ${after.frames - before.frames} frames while the pointer walked ${got.length} — the pointer is not reaching the ground`);
        drawn += after.frames - before.frames; size = after.size;
        // The galaxy keeps a resting pointer's eddy for about 15 s; the rest are asleep inside 3.5.
        await asleep(name, `${name} to fall asleep after walk ${r + 1}`, 25_000);
        sleptAfter = Math.max(sleptAfter, Date.now() - stopped);
        const settled = await ground(name);
        await sleep(1500);
        asleepFrames += (await ground(name)).frames - settled.frames;
      } else await sleep(500);
    }
    const c = groundCost(gaps);
    return { frames: c.frames, p50: round(c.p50), p95: round(c.p95), worst: round(c.worst), dropped: c.dropped, mainMsPerFrame: Math.round((100 * task) / c.frames) / 100, scriptMsPerFrame: Math.round((100 * script) / c.frames) / 100, ...(livingOne ? { groundFrames: drawn, asleepFrames, sleptAfterMs: sleptAfter, canvas: size } : {}) };
  };
  const plain = await measure("plain");
  if (Math.abs(plain.p50 - 1000 / 60) > 1.5) throw new Error(`REFUSED: the plain ground's median frame is ${plain.p50} ms — this page is not refreshing at 60 Hz, and every dropped-frame count below would be wrong`);
  const grounds = {};
  for (const name of living) grounds[name] = await measure(name);
  return { gl, viewport: `${Math.round(view.w)}x${Math.round(view.h)}`, plain, grounds };
}

/**
 * **What the long frames were made of** (27 Sep 2026), from Chrome's Long
 * Animation Frames entries: how much of each was script and how much the
 * browser's own style, layout and paint, and which handler ran the script.
 * The sampled profile says where time went over a gesture; this says what the
 * frames a person FEELS were — and on 27 Sep it overturned the reading that
 * zoom's worst frames were markdown remounting: they were a wheel handler
 * rendering every item at once.
 */
export function longFrames(entries) {
  const script = (e) => e.scripts.reduce((sum, x) => sum + x.duration, 0);
  const sorted = [...entries].sort((a, b) => b.duration - a.duration);
  const top = (e) => [...e.scripts].sort((a, b) => b.duration - a.duration)[0];
  return {
    count: entries.length,
    scriptMs: entries.reduce((sum, e) => sum + script(e), 0),
    renderMs: entries.reduce((sum, e) => sum + e.render, 0),
    worst: sorted.slice(0, 3).map((e) => ({ ms: e.duration, scriptMs: script(e), renderMs: e.render, by: top(e) ? `${top(e).invoker} ${Math.round(top(e).duration)} ms` : "no script" })),
  };
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function vlq(segment) {
  const out = []; let shift = 0; let value = 0;
  for (const ch of segment) {
    const digit = B64.indexOf(ch); const cont = digit & 32; value += (digit & 31) << shift;
    if (cont) shift += 5; else { out.push(value & 1 ? -(value >> 1) : value >> 1); value = 0; shift = 0; }
  }
  return out;
}

/**
 * Self time per SOURCE FILE — the grouping the August research found is the
 * only one that shows a parser's work, which spreads over a dozen tiny
 * functions and reads as noise in a top-N function list. The source index is a
 * segment's SECOND field (lesson 100: `bundle-what` read the fourth for 18 days).
 */
export function selfTimeBySource(profile, assets) {
  const maps = new Map();
  const lookup = (url, line, col) => {
    const file = url.split("/assets/")[1];
    if (!file) return null;
    if (!maps.has(file)) {
      const mapPath = path.join(assets, `${file}.map`);
      if (!existsSync(mapPath)) { maps.set(file, null); return null; }
      const map = JSON.parse(readFileSync(mapPath, "utf8")); let src = 0; const lines = [];
      for (const l of map.mappings.split(";")) {
        let c = 0; const segs = [];
        for (const s of l.split(",")) { if (!s) continue; const f = vlq(s); c += f[0]; if (f.length >= 4) src += f[1]; segs.push([c, f.length >= 4 ? src : -1]); }
        lines.push(segs);
      }
      maps.set(file, { sources: map.sources, lines });
    }
    const map = maps.get(file); if (!map) return null;
    let best = -1; for (const [c, s] of map.lines[line] ?? []) { if (c <= col) best = s; else break; }
    return best >= 0 ? map.sources[best].replace(/^(\.\.\/)+/, "").replace(/^.*node_modules\//, "node_modules/") : null;
  };
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map(); let total = 0;
  profile.samples.forEach((id, i) => { const dt = profile.timeDeltas[i] ?? 0; self.set(id, (self.get(id) ?? 0) + dt); total += dt; });
  const byFile = new Map();
  for (const [id, t] of self) {
    const cf = byId.get(id).callFrame;
    const src = cf.url ? (lookup(cf.url, cf.lineNumber, cf.columnNumber) ?? cf.url.split("/").pop()) : `(${cf.functionName || "program"})`;
    byFile.set(src, (byFile.get(src) ?? 0) + t);
  }
  return { totalMs: total / 1000, files: [...byFile].sort((a, b) => b[1] - a[1]).map(([file, us]) => ({ file, ms: us / 1000, share: us / total })) };
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (name, fallback) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : fallback; };
  const root = path.resolve(arg("--root", fileURLToPath(new URL("..", import.meta.url))));
  const grounds = argv.includes("--grounds");
  const items = Number(arg("--items", grounds ? "6" : "250"));
  // The grounds are measured at the size the budget names (1440p); the
  // gestures keep the 1440x900 their wheel and drag coordinates assume.
  const [width, height] = (grounds ? arg("--viewport", "2560x1440") : "1440x900").split("x").map(Number);
  const runs = Number(arg("--runs", "3"));
  const recordOut = arg("--record", null);
  const throttle = Number(arg("--throttle", "4"));
  const profileOut = arg("--profile", null);
  const assets = path.join(root, "packages/web/dist/assets");
  if (!existsSync(assets)) throw new Error(`REFUSED: ${assets} does not exist — \`npm run build\` first; this measures the production app, never the dev server`);
  const cli = path.join(root, "packages/cli/bin/isocan.js");
  const { browser, throughTheDoor, until } = await import(path.join(root, "scripts/lib/browser.mjs"));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const home = mkdtempSync(path.join(tmpdir(), "isocan-frames-"));
  const port = 21_000 + Math.floor(Math.random() * 8_000);
  const env = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port), ISOCAN_CONTENT_PORT: String(port + 1), ISOCAN_SESSION_ID: `acme-frames-${port}`, ISOCAN_HARNESS: "test" };
  const daemon = spawn(process.execPath, [cli, "serve"], { env, stdio: ["ignore", "pipe", "pipe"] });
  const origin = await new Promise((resolve, reject) => {
    let out = "";
    const t = setTimeout(() => reject(new Error(`daemon did not start:\n${out}`)), 60_000);
    const look = (c) => { out += c; if (out.includes(`http://127.0.0.1:${port}`) && /started|running/i.test(out)) { clearTimeout(t); resolve(`http://127.0.0.1:${port}`); } };
    daemon.stdout.on("data", look); daemon.stderr.on("data", look);
    daemon.once("exit", (code) => reject(new Error(`daemon exited ${code}:\n${out}`)));
  });
  const run = (...args) => execFileSync(process.execPath, [cli, "--json", ...args], { cwd: home, env, encoding: "utf8", timeout: 60_000 });
  try {
    run("identity", "--name", `Acme Frames ${port}`, "--session");
    const created = JSON.parse(run("canvas", "new", "Acme frames"));
    const canvasId = created.id ?? created.canvasId ?? created.project?.id;
    Object.assign(process.env, env);
    await import(path.join(root, "index.mjs"));
    const { connect } = await import("@isocan/api");
    const canvas = await (await connect({ port })).canvas(canvasId);
    // Notes, because markdown was the August profile's headline and every
    // note subscribes to what a canvas knows; synthetic, per the house rule.
    const note = (i) => `# Acme note ${i}\n\nThe **quarterly** plan for team ${i % 12}, with a [link](https://example.com/${i}) and \`code\`.\n\n- first point about item ${i}\n- second point, *emphasised*\n- third point with more words to wrap across the card\n\n> A quote that sits under the list.\n`;
    const ids = [];
    for (let i = 0; i < items; i++) ids.push((await canvas.add({ content: note(i), mime: "text/markdown", title: `Acme ${i}`, at: { x: (i % 20) * 360, y: Math.floor(i / 20) * 300 }, size: { width: 320, height: 260 } })).id);
    for (let t = 0; t < Math.min(40, items); t++) await canvas.comment(ids[(t * 3) % ids.length], `Acme comment ${t}`);

    const b = await browser();
    let mover = null;
    try {
      await b.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
      await b.send("Page.navigate", { url: origin });
      await throughTheDoor(b, origin, "Acme Viewer");
      await b.send("Page.navigate", { url: `${origin}/p/${canvasId}` });
      const need = Math.min(20, items);
      await until(b, `document.querySelectorAll("[data-item-id]").length >= ${need}`, "items to render", 60_000);
      await sleep(2500);
      const rendered = await b.ev(`document.querySelectorAll("[data-item-id]").length`);
      if (rendered < need) throw new Error(`REFUSED: only ${rendered} items rendered`);
      await b.send("Emulation.setCPUThrottlingRate", { rate: throttle });
      if (grounds) {
        const { LIVING } = await import("@isocan/core");
        const got = await groundsCensus({ b, run, until, sleep, canvasId, living: LIVING, runs, steps: 180 });
        const chrome = await b.send("Browser.getVersion").then((v) => v.product, () => "Chrome (version not read)");
        const cpu = os.cpus()[0]?.model ?? "unknown CPU";
        const machine = `${cpu}, ${Math.round(os.totalmem() / 2 ** 30)} GB, ${os.platform()} ${os.arch()}`;
        console.log(`machine  ${machine}; headless ${chrome}; GL ${got.gl}`);
        console.log(`         page ${width}x${height} at 1x (canvas ${got.viewport}), CPU throttled ${throttle}x — the GPU is not throttled; ${items} notes; ${runs} walks of 180 pointer moves each`);
        if (!/\bM1\b/.test(cpu)) console.log(`         NOT the M1 the budget names (design.md, "Frame cost"): read these as this machine's, not as the budget met`);
        if (/swiftshader|llvmpipe|software/i.test(got.gl)) console.log(`         SOFTWARE GL: the shaders ran on the CPU, so these are not a GPU's numbers at all`);
        const line = (name, r) => `${name.padEnd(8)} frames=${r.frames} p50=${r.p50.toFixed(1)} p95=${r.p95.toFixed(1)} worst=${r.worst.toFixed(1)} dropped=${r.dropped} main=${r.mainMsPerFrame.toFixed(2)}ms/frame (script ${r.scriptMsPerFrame.toFixed(2)})` + (r.groundFrames === undefined ? "" : ` ground-frames=${r.groundFrames} asleep-frames=${r.asleepFrames} slept-after=${(r.sleptAfterMs / 1000).toFixed(1)}s`);
        console.log(line("plain", got.plain));
        for (const [name, r] of Object.entries(got.grounds)) console.log(line(name, r));
        const awake = Object.entries(got.grounds).filter(([, r]) => r.asleepFrames !== 0);
        console.log(awake.length ? `NOT ASLEEP: ${awake.map(([n, r]) => `${n} drew ${r.asleepFrames} frames with nothing moving`).join("; ")}` : `asleep   every ground drew 0 frames with nothing moving, before and after each walk`);
        const commit = (() => { try { return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); } catch { return "unknown"; } })();
        if (recordOut) writeFileSync(recordOut, `${JSON.stringify({ at: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()), commit, machine, chrome, gl: got.gl, page: `${width}x${height}`, throttle, items, runs, plain: got.plain, grounds: got.grounds }, null, 2)}\n`);
        const errors = b.takeErrors();
        if (errors.length) console.log(`page errors: ${JSON.stringify(errors).slice(0, 300)}`);
        if (awake.length) process.exitCode = 1;
        return;
      }
      const probe = `(() => { window.__gaps = []; window.__cams = new Set(); window.__cursors = new Set(); window.__ghosts = new Set(); let last = performance.now(); const f = (t) => { window.__gaps.push(t - last); last = t; window.__cams.add(document.querySelector('.world')?.style.transform ?? ''); window.__cursors.add([...document.querySelectorAll('.remote-cursor')].map((c) => c.style.left).join()); window.__ghosts.add(document.querySelector('.item.ghosted')?.style.translate ?? ''); if (window.__on) requestAnimationFrame(f); }; window.__on = true; requestAnimationFrame(f); window.__loaf = []; if (!window.__loafOn) { window.__loafOn = true; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__loaf.push({ duration: e.duration, render: e.renderStart ? e.startTime + e.duration - e.renderStart : 0, scripts: e.scripts.map((x) => ({ duration: x.duration, invoker: x.invoker })) }); }).observe({ type: 'long-animation-frame' }); } catch {} } return true; })()`;
      const collect = `(() => { window.__on = false; return { gaps: window.__gaps.slice(1), cams: window.__cams.size, cursors: window.__cursors.size, ghosts: window.__ghosts.size - 1, loaf: window.__loaf }; })()`;
      const wheel = (dx, dy, modifiers = 0) => b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 720, y: 450, deltaX: dx, deltaY: dy, modifiers });
      if (profileOut) { await b.send("Profiler.enable"); await b.send("Profiler.setSamplingInterval", { interval: 250 }); }
      // A face of its own for the cursor gesture, made before any gesture is
      // timed so its arrival on the roster is not one of the frames read.
      const { client, actor } = canvas.ctx;
      const { sessionId } = await client.createSession(canvasId, actor, "Acme cursor");
      const results = {};
      // The second person, for remote-drag: a browser of its own (its own
      // cookie, so its own actor), unthrottled — only the viewer is measured.
      const pointer = (page) => async (type, x, y) => page.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1 });
      // An item fully on screen whose grab point is its own — not covered by one
      // an earlier gesture dropped on it.
      const grabbable = `(() => { const grip = (el) => { const r = el.getBoundingClientRect(); const bar = el.querySelector(".item-titlebar"); const b2 = bar && bar.offsetParent ? bar.getBoundingClientRect() : null; return { x: b2 ? b2.x + 8 : r.x + 8, y: b2 ? b2.y + b2.height / 2 : r.y + 8, left: r.x }; }; const ok = (e) => { const q = e.getBoundingClientRect(); if (!(q.width > 0 && q.x > 400 && q.y > 120 && q.x + q.width < 1100 && q.y + q.height < 700)) return false; const g = grip(e); return document.elementFromPoint(g.x, g.y)?.closest(".item") === e; }; const el = [...document.querySelectorAll(".item[data-item-id]")].find(ok); return el ? { id: el.dataset.itemId, ...grip(el) } : null; })()`;
      for (const [name, gesture, prepare] of [
        ["pan", async () => { for (let i = 0; i < 90; i++) { await wheel(i < 45 ? 35 : -35, i % 2 ? 25 : -25); await sleep(16); } }],
        ["zoom", async () => { for (let i = 0; i < 60; i++) { await wheel(0, i < 30 ? 40 : -40, 2); await sleep(16); } }],
        ["remote", async () => { for (let i = 0; i < 60; i++) await canvas.move(ids[ids.length - 1], 7200 + (i % 10) * 12, 4000 + i * 3); }],
        ["cursor", async () => { for (let i = 0; i < 60; i++) { await client.updateSession(canvasId, sessionId, { actor, cursor: { x: 800 + i * 40, y: 1200 + (i % 2) * 30 } }); await sleep(16); } }],
        ["drag", async () => {
          // A real pointer on the item under the middle of the screen: pressed,
          // moved sixty times, released — the local gesture, which on a groups
          // canvas previews through boxes that items, lines and pins all ride.
          const at = await b.ev(`(() => { const inView = (e) => { const q = e.getBoundingClientRect(); return q.width > 0 && q.x > 400 && q.y > 120 && q.x + q.width < 1100 && q.y + q.height < 700; }; const el = [...document.querySelectorAll(".item[data-item-id]")].find(inView); if (!el) return null; const r = el.getBoundingClientRect(); window.__dragged = el.dataset.itemId; const bar = el.querySelector(".item-titlebar"); const b2 = bar && bar.offsetParent ? bar.getBoundingClientRect() : null; const x = b2 ? b2.x + 8 : r.x + 8, y = b2 ? b2.y + b2.height / 2 : r.y + 8; return { x, y, left: r.x, hit: String(document.elementFromPoint(x, y)?.className) }; })()`);
          if (!at) throw new Error(`REFUSED: no item fully on screen to drag: ${await b.ev(`JSON.stringify([...document.querySelectorAll(".item[data-item-id]")].slice(0, 6).map((e) => { const q = e.getBoundingClientRect(); return [q.x, q.y, q.width, q.height].map(Math.round); }))`)}`);
          const mouse = (type, x, y) => b.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1 });
          await mouse("mousePressed", at.x, at.y);
          for (let i = 1; i <= 60; i++) { await mouse("mouseMoved", at.x + i * 4, at.y + i * 2); await sleep(16); }
          const mid = await b.ev(`document.querySelector('[data-item-id="' + window.__dragged + '"]').getBoundingClientRect().x`);
          await mouse("mouseReleased", at.x + 240, at.y + 120);
          if (Math.abs(mid - at.left) < 100) throw new Error(`REFUSED: the drag gesture moved its item ${Math.round(mid - at.left)}px — the pointer is not reaching an item (it pressed on "${at.hit}" at ${JSON.stringify(at)})`);
        }, async () => {
          // The zoom gesture leaves the camera where its clamp did; a fresh load
          // puts it back where a person starts, before the probe, so it is not timed.
          await b.send("Page.navigate", { url: `${origin}/p/${canvasId}` });
          await until(b, `document.querySelectorAll("[data-item-id]").length >= ${need}`, "items to render again", 60_000);
          await sleep(2500);
        }],
        ["remote-drag", async () => {
          const at = await mover.ev(grabbable);
          if (!at) throw new Error("REFUSED: the mover has no item fully on screen to drag");
          const mouse = pointer(mover);
          await mouse("mousePressed", at.x, at.y);
          for (let i = 1; i <= 60; i++) { await mouse("mouseMoved", at.x + i * 4, at.y + i * 2); await sleep(16); }
          await mouse("mouseReleased", at.x + 240, at.y + 120);
          await sleep(700);
          const moved = await b.ev(`document.querySelector('[data-item-id="${at.id}"]').getBoundingClientRect().x`);
          if (Math.abs(moved - at.left) < 100) throw new Error(`REFUSED: the mover's drag moved its item only ${Math.round(moved - at.left)}px on the viewer — the drag is not landing`);
        }, async () => {
          mover = await browser();
          await mover.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
          await mover.send("Page.navigate", { url: origin });
          await throughTheDoor(mover, origin, "Acme Mover");
          await mover.send("Page.navigate", { url: `${origin}/p/${canvasId}` });
          await until(mover, `document.querySelectorAll("[data-item-id]").length >= ${need}`, "items to render for the mover", 60_000);
          await sleep(2500);
        }],
      ]) {
        if (prepare) await prepare();
        await b.ev(probe);
        if (profileOut) await b.send("Profiler.start");
        await gesture();
        await sleep(300);
        const profile = profileOut ? (await b.send("Profiler.stop")).profile : null;
        const got = await b.ev(collect);
        if (name === "cursor" && got.cursors < 10) throw new Error(`REFUSED: the cursor gesture drew the remote cursor at only ${got.cursors} positions — its beats are not reaching this browser`);
        if (name === "remote-drag" && got.cursors < 10) throw new Error(`REFUSED: the mover's cursor reached this browser at only ${got.cursors} positions — its beats are not arriving`);
        if ((name === "pan" || name === "zoom") && got.cams < 10) throw new Error(`REFUSED: the ${name} gesture moved the camera through only ${got.cams} positions — the wheel is not reaching the canvas`);
        results[name] = { ...frameStats(got.gaps), cameraPositions: got.cams, ...(name === "remote-drag" ? { ghostPositions: got.ghosts } : {}), longFrames: longFrames(got.loaf), ...(profile ? { bySource: selfTimeBySource(profile, assets) } : {}) };
      }
      if (profileOut) writeFileSync(profileOut, JSON.stringify({ items, throttle, results }, null, 2));
      for (const [name, r] of Object.entries(results)) {
        console.log(`${name.padEnd(6)} items=${items}${r.ghostPositions !== undefined ? ` ghosts=${r.ghostPositions}` : ""} throttle=${throttle}x frames=${r.frames} p50=${r.p50.toFixed(1)} p90=${r.p90.toFixed(1)} p99=${r.p99.toFixed(1)} worst=${r.worst.toFixed(1)} >16.7ms=${r.over16} >32ms=${r.over32}`);
        const lf = r.longFrames;
        if (lf.count) console.log(`         long frames ${lf.count}: script ${lf.scriptMs.toFixed(0)} ms, style/layout/paint ${lf.renderMs.toFixed(0)} ms; worst ${lf.worst.map((w) => `${w.ms.toFixed(0)} (${w.scriptMs.toFixed(0)} script, ${w.renderMs.toFixed(0)} render, ${w.by})`).join(", ")}`);
        if (r.bySource) for (const f of r.bySource.files.slice(0, 8)) console.log(`         ${f.ms.toFixed(0).padStart(6)} ms ${(100 * f.share).toFixed(1).padStart(5)}%  ${f.file}`);
      }
      const errors = b.takeErrors();
      if (errors.length) console.log(`page errors: ${JSON.stringify(errors).slice(0, 300)}`);
    } finally {
      await mover?.close();
      await b.close();
    }
  } finally {
    daemon.kill();
    rmSync(home, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(String(err?.message ?? err)); process.exit(2); });
}

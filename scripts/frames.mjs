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
 *
 * `docs/research/2026-08-29-performance.md` measured the frame budget with a
 * harness that lived and died in one session, so nothing measured it again —
 * and when two regressions arrived (every item re-rendering on every step of a
 * zoom, and on every operation anybody made), nothing noticed. This is that
 * harness, kept: a daemon of its own on a throwaway home, a canvas seeded
 * through `@isocan/api`, headless Chrome through `scripts/lib/browser.mjs`, and
 * three gestures —
 *
 * - **pan**: ninety wheel events across the canvas;
 * - **zoom**: sixty ctrl-wheel events, out and back;
 * - **remote**: another client moving one item sixty times while this browser
 *   only watches — the cost of somebody ELSE working, which no local gesture
 *   shows.
 *
 * Each reports the long-frame TAIL — p90, p99, worst, and how many frames went
 * over 16.7 and 32 ms — never an average (an average of 9 ms with one frame in
 * seven at 33 reads as smooth and feels like stutter). The CPU is throttled 4x
 * by default, because the machine this runs on is not the one the app is felt on.
 *
 * **It refuses rather than reports** — the lesson of the August run, where the
 * guard fired three times on pages that were not the app. A gesture whose
 * camera did not move is a wheel that reached nothing, and reading its frames
 * would report a flawless 16.7 ms from a page doing no work.
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The long-frame tail of a list of inter-frame gaps, in ms. */
export function frameStats(gaps) {
  const s = [...gaps].sort((a, b) => a - b);
  if (s.length === 0) return { frames: 0, p50: 0, p90: 0, p99: 0, worst: 0, over16: 0, over32: 0 };
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { frames: s.length, p50: q(0.5), p90: q(0.9), p99: q(0.99), worst: s[s.length - 1], over16: s.filter((x) => x > 16.7).length, over32: s.filter((x) => x > 32).length };
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
  const items = Number(arg("--items", "250"));
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
    try {
      await b.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await b.send("Page.navigate", { url: origin });
      await throughTheDoor(b, origin, "Acme Viewer");
      await b.send("Page.navigate", { url: `${origin}/p/${canvasId}` });
      const need = Math.min(20, items);
      await until(b, `document.querySelectorAll("[data-item-id]").length >= ${need}`, "items to render", 60_000);
      await sleep(2500);
      const rendered = await b.ev(`document.querySelectorAll("[data-item-id]").length`);
      if (rendered < need) throw new Error(`REFUSED: only ${rendered} items rendered`);
      await b.send("Emulation.setCPUThrottlingRate", { rate: throttle });
      const probe = `(() => { window.__gaps = []; window.__cams = new Set(); let last = performance.now(); const f = (t) => { window.__gaps.push(t - last); last = t; window.__cams.add(document.querySelector('.world')?.style.transform ?? ''); if (window.__on) requestAnimationFrame(f); }; window.__on = true; requestAnimationFrame(f); return true; })()`;
      const collect = `(() => { window.__on = false; return { gaps: window.__gaps.slice(1), cams: window.__cams.size }; })()`;
      const wheel = (dx, dy, modifiers = 0) => b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 720, y: 450, deltaX: dx, deltaY: dy, modifiers });
      if (profileOut) { await b.send("Profiler.enable"); await b.send("Profiler.setSamplingInterval", { interval: 250 }); }
      const results = {};
      for (const [name, gesture] of [
        ["pan", async () => { for (let i = 0; i < 90; i++) { await wheel(i < 45 ? 35 : -35, i % 2 ? 25 : -25); await sleep(16); } }],
        ["zoom", async () => { for (let i = 0; i < 60; i++) { await wheel(0, i < 30 ? 40 : -40, 2); await sleep(16); } }],
        ["remote", async () => { for (let i = 0; i < 60; i++) await canvas.move(ids[ids.length - 1], 7200 + (i % 10) * 12, 4000 + i * 3); }],
      ]) {
        await b.ev(probe);
        if (profileOut) await b.send("Profiler.start");
        await gesture();
        await sleep(300);
        const profile = profileOut ? (await b.send("Profiler.stop")).profile : null;
        const got = await b.ev(collect);
        if (name !== "remote" && got.cams < 10) throw new Error(`REFUSED: the ${name} gesture moved the camera through only ${got.cams} positions — the wheel is not reaching the canvas`);
        results[name] = { ...frameStats(got.gaps), cameraPositions: got.cams, ...(profile ? { bySource: selfTimeBySource(profile, assets) } : {}) };
      }
      if (profileOut) writeFileSync(profileOut, JSON.stringify({ items, throttle, results }, null, 2));
      for (const [name, r] of Object.entries(results)) {
        console.log(`${name.padEnd(6)} items=${items} throttle=${throttle}x frames=${r.frames} p50=${r.p50.toFixed(1)} p90=${r.p90.toFixed(1)} p99=${r.p99.toFixed(1)} worst=${r.worst.toFixed(1)} >16.7ms=${r.over16} >32ms=${r.over32}`);
        if (r.bySource) for (const f of r.bySource.files.slice(0, 8)) console.log(`         ${f.ms.toFixed(0).padStart(6)} ms ${(100 * f.share).toFixed(1).padStart(5)}%  ${f.file}`);
      }
      const errors = b.takeErrors();
      if (errors.length) console.log(`page errors: ${JSON.stringify(errors).slice(0, 300)}`);
    } finally {
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

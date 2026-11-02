#!/usr/bin/env node
/**
 * **A motion, recorded to an MP4, a WebM or a GIF, from the terminal**
 * (motion phases 1 and 3; `docs/projects/motion/design.md` §4). The address's
 * `format` says which; this script only carries the bytes.
 *
 *   node scripts/motion-render.mjs --url <render address> --canvas prj_… --out movie.mp4
 *       [--report report.json] [--keep-dir <dir>] [--owner-from-stdin]
 *
 * `isocan motion render` builds the address with core's `motionRenderUrl`
 * and runs this; it opens that page of the web app in the headless browser
 * `canvas shot` drives (`lib/browser.mjs`), waits while the page draws and
 * encodes every frame — printing its `frame n of N` — and reads the finished
 * bytes back off `window.isocanMotionRender`, a slice at a time. The page
 * does all the work; this script carries no renderer of its own, so the
 * movie a terminal makes is the one the web will make.
 *
 * **Through the door as "Projector"**, after the same access check
 * `canvas-shot.mjs` makes before Chrome starts: an ordinary canvas is read by
 * a claimed actor; a personal one only with the owner's own credential,
 * handed in on stdin by the CLI, as `canvas shot` does. Nothing is written
 * to any canvas here — the CLI uploads the file and adds the video item.
 *
 * `--report` writes what the page said it rendered (the plan, the codec, the
 * `renderedFrom` record); `--keep-dir` writes the pre-encode PNGs the address
 * asked the page to keep (`keep=`), for a proof to compare decoded frames
 * against.
 */
import "../index.mjs";
const { DaemonClient } = await import("@isocan/api");
const { classifyAutomaticSource } = await import("@isocan/api/context");
const { paths } = await import("@isocan/server");
const { BADGE_COOKIE, canvasPath, canvasUrl } = await import("@isocan/core");
const { personalCaptureOwner } = await import("../packages/cli/src/personal-capture.ts");
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { browser, throughTheDoor, until } from "./lib/browser.mjs";

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const url = arg("--url");
const canvasId = arg("--canvas");
const out = arg("--out");
if (!url || !canvasId || !out) {
  console.error("usage: motion-render.mjs --url <render address> --canvas <canvas> --out <file> [--report <file.json>] [--keep-dir <dir>]");
  process.exit(2);
}
const address = new URL(url);
const origin = address.origin;
if (!address.pathname.startsWith(`${canvasPath(canvasId)}/`)) throw new Error(`${url} is not an address on canvas ${canvasId}`);

const access = await classifyAutomaticSource(new DaemonClient(origin, paths.isocanHome()), { canvasId, home: origin, source: canvasUrl(origin, canvasId) });
let owner = null;
if (access.kind !== "ordinary") {
  if (access.kind !== "personal" || !argv.includes("--owner-from-stdin")) throw new Error(access.refused);
  const input = JSON.parse(readFileSync(0, "utf8"));
  if (!input.actor || typeof input.actor.id !== "string" || typeof input.actor.name !== "string") throw new Error("An explicit owner identity is required for private capture.");
  owner = await personalCaptureOwner(paths.isocanHome(), origin, canvasId, input.actor);
}

/** Bytes per read off the page: 4 MB of file, about 5.3 MB of base64 in one CDP answer. */
const SLICE = 4 * 1024 * 1024;

const b = await browser();
try {
  await b.send("Emulation.setDeviceMetricsOverride", { width: 800, height: 600, deviceScaleFactor: 1, mobile: false });
  const loaded = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: origin });
  await Promise.race([loaded, sleep(15_000)]);
  if (owner) {
    await b.send("Network.setCookie", { name: BADGE_COOKIE, value: `${owner.badge.badgeId}.${owner.badge.secret}`, url: origin, httpOnly: true, secure: address.protocol === "https:", sameSite: "Lax" });
    await b.ev(`localStorage.setItem("isocan.identity", ${JSON.stringify(JSON.stringify(owner.actor))})`);
  } else await throughTheDoor(b, origin, "Projector", "motion-render");
  const opened = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: address.href });
  await Promise.race([opened, sleep(15_000)]);
  await until(b, `!!window.isocanMotionRender`, "the render page to start", 30_000);
  // The page's own clock decides how long this takes; what is bounded is
  // silence — a page whose frame count stops moving for a minute is stuck.
  // A line each tenth of the way, not each frame: a log, not a flood.
  let tenth = -1;
  let moved = Date.now();
  let last = -1;
  let status;
  for (;;) {
    status = await b.ev(`window.isocanMotionRender.status`);
    if (status.state === "done" || status.state === "error") break;
    if (status.frame !== last) { last = status.frame; moved = Date.now(); }
    if (Date.now() - moved > 60_000) throw new Error(`the render page stopped at frame ${status.frame} of ${status.frames}`);
    const now = status.frames > 0 ? Math.floor((status.frame / status.frames) * 10) : -1;
    if (status.state === "rendering" && now > tenth && now < 10) { console.log(`frame ${status.frame} of ${status.frames}`); tenth = now; }
    await sleep(200);
  }
  if (status.state === "error") throw new Error(status.error);
  const size = await b.ev(`window.isocanMotionRender.size`);
  const parts = [];
  for (let offset = 0; offset < size; offset += SLICE) {
    parts.push(Buffer.from(await b.ev(`window.isocanMotionRender.chunk(${offset}, ${SLICE})`), "base64"));
  }
  const bytes = Buffer.concat(parts);
  if (bytes.length !== size) throw new Error(`read ${bytes.length} bytes of a ${size}-byte movie`);
  writeFileSync(out, bytes);
  const keepDir = arg("--keep-dir");
  if (keepDir) {
    mkdirSync(keepDir, { recursive: true });
    const kept = await b.ev(`window.isocanMotionRender.kept`);
    for (const [n, dataUrl] of Object.entries(kept)) {
      writeFileSync(path.join(keepDir, `frame-${n}.png`), Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
    }
  }
  const report = arg("--report");
  if (report) writeFileSync(report, JSON.stringify({ ...status, bytes: bytes.length }, null, 2));
  console.log(`frame ${status.frames} of ${status.frames} — ${bytes.length} bytes of ${status.codec}`);
} finally {
  owner = null;
  await b.close();
}

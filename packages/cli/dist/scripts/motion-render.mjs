#!/usr/bin/env node
import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  browser,
  throughTheDoor,
  until
} from "./chunk-NCPWVLPN.mjs";
import "./chunk-JYOOXWJZ.mjs";

// scripts/motion-render.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
var { DaemonClient } = await import("./src-2EI3AXHR.mjs");
var { classifyAutomaticSource } = await import("./context-reader-BLFRJFGV.mjs");
var { paths } = await import("./src-7NTX2BWZ.mjs");
var { BADGE_COOKIE, canvasPath, canvasUrl } = await import("./src-LYAXAFHM.mjs");
var { personalCaptureOwner } = await import("./personal-capture-L5RW5B72.mjs");
var argv = process.argv.slice(2);
var arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : void 0;
};
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var url = arg("--url");
var canvasId = arg("--canvas");
var out = arg("--out");
if (!url || !canvasId || !out) {
  console.error("usage: motion-render.mjs --url <render address> --canvas <canvas> --out <file.mp4> [--report <file.json>] [--keep-dir <dir>]");
  process.exit(2);
}
var address = new URL(url);
var origin = address.origin;
if (!address.pathname.startsWith(`${canvasPath(canvasId)}/`)) throw new Error(`${url} is not an address on canvas ${canvasId}`);
var access = await classifyAutomaticSource(new DaemonClient(origin, paths.isocanHome()), { canvasId, home: origin, source: canvasUrl(origin, canvasId) });
var owner = null;
if (access.kind !== "ordinary") {
  if (access.kind !== "personal" || !argv.includes("--owner-from-stdin")) throw new Error(access.refused);
  const input = JSON.parse(readFileSync(0, "utf8"));
  if (!input.actor || typeof input.actor.id !== "string" || typeof input.actor.name !== "string") throw new Error("An explicit owner identity is required for private capture.");
  owner = await personalCaptureOwner(paths.isocanHome(), origin, canvasId, input.actor);
}
var SLICE = 4 * 1024 * 1024;
var b = await browser();
try {
  await b.send("Emulation.setDeviceMetricsOverride", { width: 800, height: 600, deviceScaleFactor: 1, mobile: false });
  const loaded = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: origin });
  await Promise.race([loaded, sleep(15e3)]);
  if (owner) {
    await b.send("Network.setCookie", { name: BADGE_COOKIE, value: `${owner.badge.badgeId}.${owner.badge.secret}`, url: origin, httpOnly: true, secure: address.protocol === "https:", sameSite: "Lax" });
    await b.ev(`localStorage.setItem("isocan.identity", ${JSON.stringify(JSON.stringify(owner.actor))})`);
  } else await throughTheDoor(b, origin, "Projector", "motion-render");
  const opened = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: address.href });
  await Promise.race([opened, sleep(15e3)]);
  await until(b, `!!window.isocanMotionRender`, "the render page to start", 3e4);
  let tenth = -1;
  let moved = Date.now();
  let last = -1;
  let status;
  for (; ; ) {
    status = await b.ev(`window.isocanMotionRender.status`);
    if (status.state === "done" || status.state === "error") break;
    if (status.frame !== last) {
      last = status.frame;
      moved = Date.now();
    }
    if (Date.now() - moved > 6e4) throw new Error(`the render page stopped at frame ${status.frame} of ${status.frames}`);
    const now = status.frames > 0 ? Math.floor(status.frame / status.frames * 10) : -1;
    if (status.state === "rendering" && now > tenth && now < 10) {
      console.log(`frame ${status.frame} of ${status.frames}`);
      tenth = now;
    }
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
  console.log(`frame ${status.frames} of ${status.frames} \u2014 ${bytes.length} bytes of ${status.codec}`);
} finally {
  owner = null;
  await b.close();
}

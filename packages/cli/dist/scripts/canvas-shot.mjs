#!/usr/bin/env node
import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  browser,
  throughTheDoor,
  until
} from "./chunk-DLH3FVEG.mjs";
import "./chunk-JYOOXWJZ.mjs";

// scripts/canvas-shot.mjs
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
var { DaemonClient } = await import("./src-FGGSITTB.mjs");
var { classifyAutomaticSource } = await import("./context-reader-PCL2QC4J.mjs");
var { paths } = await import("./src-VHKOBNS3.mjs");
var { BADGE_COOKIE } = await import("./src-CBMDXOLU.mjs");
var { personalCaptureOwner } = await import("./personal-capture-LCVPB7WX.mjs");
var { packageBin } = await import("./packageroot-TJ5QKZIE.mjs");
var cli = packageBin();
var argv = process.argv.slice(2);
var arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : void 0;
};
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var url = arg("--url");
if (!url) {
  console.error("usage: canvas-shot.mjs --url <canvas address> [--out <file.png>] [--into <item> --on <canvas>]");
  process.exit(2);
}
var address = new URL(url);
var origin = address.origin;
var slug = address.pathname.split("/").filter(Boolean).pop() ?? "canvas";
var out = arg("--out") ?? path.join(mkdtempSync(path.join(tmpdir(), "isocan-shot-")), `${slug}.png`);
var into = arg("--into");
var on = arg("--on");
var width = Number(arg("--width") ?? 1600);
var height = Number(arg("--height") ?? 1e3);
var access = await classifyAutomaticSource(new DaemonClient(origin, paths.isocanHome()), { canvasId: slug, home: origin, source: address.href });
var owner = null;
if (access.kind !== "ordinary") {
  if (access.kind !== "personal" || into || !argv.includes("--owner-from-stdin")) throw new Error(access.refused);
  const input = JSON.parse(readFileSync(0, "utf8"));
  if (!input.actor || typeof input.actor.id !== "string" || typeof input.actor.name !== "string") throw new Error("An explicit owner identity is required for private capture.");
  owner = await personalCaptureOwner(paths.isocanHome(), origin, slug, input.actor);
}
var b = await browser();
try {
  await b.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  const loaded = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: origin });
  await Promise.race([loaded, sleep(15e3)]);
  if (owner) {
    await b.send("Network.setCookie", { name: BADGE_COOKIE, value: `${owner.badge.badgeId}.${owner.badge.secret}`, url: origin, httpOnly: true, secure: address.protocol === "https:", sameSite: "Lax" });
    await b.ev(`localStorage.setItem("isocan.identity", ${JSON.stringify(JSON.stringify(owner.actor))})`);
  } else await throughTheDoor(b, origin, "Camera", "canvas-shot");
  const opened = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: address.href });
  await Promise.race([opened, sleep(15e3)]);
  await until(b, `document.querySelector(".canvas-viewport") !== null`, "the canvas to render", 2e4);
  await sleep(1500);
  for (const type of ["keyDown", "keyUp"]) {
    await b.send("Input.dispatchKeyEvent", { type, key: "!", code: "Digit1", modifiers: 8, windowsVirtualKeyCode: 49 });
  }
  await sleep(1200);
  const shot = await b.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log(`wrote ${out}`);
  if (into) {
    const args = [cli, ...on ? ["--canvas", on] : [], "edit", into, out];
    const r = spawnSync(process.execPath, args, { stdio: "inherit" });
    if (r.status !== 0) process.exitCode = r.status ?? 1;
  }
} finally {
  owner = null;
  await b.close();
}

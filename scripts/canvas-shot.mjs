#!/usr/bin/env node
/**
 * **A real screenshot of a canvas** (inception phase 2).
 *
 * The card a canvas item draws is LIVE — the other canvas's snapshot, pulled
 * by whoever is looking. This is the picture for whoever cannot pull: a
 * reader the door refuses, a tab that is offline, a home that is not this
 * one. It is a PNG of the canvas as the app renders it, taken by the same
 * headless browser the graders and the journeys run (`lib/browser.mjs`), and
 * with `--into` it lands as a new VERSION of the canvas item, which the card
 * shows under the words when its own pull fails and never in place of a live
 * picture it can draw.
 *
 *   node scripts/canvas-shot.mjs --url http://127.0.0.1:4441/p/prj_… [--out shot.png]
 *   node scripts/canvas-shot.mjs --url <address> --into itm_… --on prj_…
 *
 * **It takes the canvas's ADDRESS, whole.** `isocan canvas shot` builds it
 * with core's `canvasUrl`, so this script never spells `/p/<id>` — the one
 * shape this repo refuses to write twice — and knows the home from the
 * address rather than from a second flag.
 *
 * **It goes through the door as "Camera".** A canvas page is behind the
 * identity door, so the browser claims an actor before it looks — the same
 * door-crossing the journeys runner makes, in `lib/browser.mjs`, with a
 * name that says what it is. Nothing else is written to any canvas by this
 * script; `--into` is the ordinary `isocan edit`, an op like any other,
 * undoable.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browser, throughTheDoor, until } from "./lib/browser.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const cli = path.join(repo, "packages/cli/bin/isocan.js");
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const url = arg("--url");
if (!url) {
  console.error("usage: canvas-shot.mjs --url <canvas address> [--out <file.png>] [--into <item> --on <canvas>]");
  process.exit(2);
}
const address = new URL(url);
const origin = address.origin;
const slug = address.pathname.split("/").filter(Boolean).pop() ?? "canvas";
const out = arg("--out") ?? path.join(mkdtempSync(path.join(tmpdir(), "isocan-shot-")), `${slug}.png`);
const into = arg("--into");
const on = arg("--on");
const width = Number(arg("--width") ?? 1600);
const height = Number(arg("--height") ?? 1000);

const b = await browser();
try {
  await b.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  // Land on the origin first, so the door can be gone through with relative
  // fetches — the same order the journeys runner learned.
  const loaded = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: origin });
  await Promise.race([loaded, sleep(15_000)]);
  await throughTheDoor(b, origin, "Camera", "canvas-shot");
  const opened = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: address.href });
  await Promise.race([opened, sleep(15_000)]);
  await until(b, `document.querySelector(".canvas-viewport") !== null`, "the canvas to render", 20_000);
  // Let the replica arrive, then fit everything on screen the way ⇧1 does,
  // through a real key so the app's own handler answers.
  await sleep(1500);
  for (const type of ["keyDown", "keyUp"]) {
    await b.send("Input.dispatchKeyEvent", { type, key: "!", code: "Digit1", modifiers: 8, windowsVirtualKeyCode: 49 });
  }
  await sleep(1200);
  const shot = await b.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log(`wrote ${out}`);
  if (into) {
    const args = [cli, ...(on ? ["--canvas", on] : []), "edit", into, out];
    const r = spawnSync(process.execPath, args, { stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
} finally {
  await b.close();
}

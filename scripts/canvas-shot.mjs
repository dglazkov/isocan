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
 *   node scripts/canvas-shot.mjs --canvas prj_… [--origin http://127.0.0.1:4441] [--out shot.png]
 *   node scripts/canvas-shot.mjs --canvas prj_… --into itm_… --on prj_…
 *
 * **It goes through the door as "Camera".** A canvas page is behind the
 * identity door, so the browser claims an actor before it looks — the same
 * move `journeys.mjs` makes, with a name that says what it is. Nothing else
 * is written to any canvas by this script; `--into` is the ordinary `isocan
 * edit`, an op like any other, undoable.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browser } from "./lib/browser.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const cli = path.join(repo, "packages/cli/bin/isocan.js");
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const canvasId = arg("--canvas");
if (!canvasId) {
  console.error("usage: canvas-shot.mjs --canvas <id> [--origin <url>] [--out <file.png>] [--into <item> --on <canvas>]");
  process.exit(2);
}
const origin = (arg("--origin") ?? process.env.ISOCAN_ORIGIN ?? `http://127.0.0.1:${process.env.ISOCAN_PORT ?? "4441"}`).replace(/\/+$/, "");
const out = arg("--out") ?? path.join(mkdtempSync(path.join(tmpdir(), "isocan-shot-")), `${canvasId}.png`);
const into = arg("--into");
const on = arg("--on");
const width = Number(arg("--width") ?? 1600);
const height = Number(arg("--height") ?? 1000);

/** Wait until an expression is true in the page, or say what it waited for. */
async function until(b, expression, what, ms = 15_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await b.ev(expression).catch(() => false)) return;
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${what}`);
}

const b = await browser();
try {
  await b.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  // Land on the origin first, so the door can be gone through with relative
  // fetches — the same order the journeys runner learned.
  const loaded = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: origin });
  await Promise.race([loaded, sleep(15_000)]);
  await until(b, `location.origin === ${JSON.stringify(origin)}`, `the page to be at ${origin}`);
  await b.ev(`(async () => {
    await fetch("/api/door", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrier: "cookie" }) });
    const r = await fetch("/api/ops", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canvasId: null, clientId: "canvas-shot",
        op: { type: "actor.claim", name: "Camera" } }) });
    const j = await r.json();
    if (!j.envelope) throw new Error("the door did not hand out an identity: " + JSON.stringify(j).slice(0, 200));
    localStorage.setItem("isocan.identity", JSON.stringify(j.envelope.actor));
    return true;
  })()`);
  const opened = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: `${origin}/p/${encodeURIComponent(canvasId)}` });
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

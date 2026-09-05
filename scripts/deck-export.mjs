#!/usr/bin/env node
/**
 * **A deck on paper, from the terminal** (`docs/research/2026-09-04-deck-export.md`).
 *
 * The app's deck view (`/p/<canvas>/deck`, spelled by core's `deckUrl`, never
 * here) stacks every slide with a print stylesheet that puts one on each
 * landscape sheet. This script opens that same address in the headless
 * Chrome the graders and `canvas-shot` use, waits for every slide's frame to
 * arrive, and asks Chrome to print it — so the PDF the CLI writes and the one
 * Save-as-PDF writes in the app are the same pages from the same view. With
 * `--png <dir>` it photographs each slide instead, one file per page, which
 * is the raw material every picture-based format (PPTX, a thumbnail strip)
 * is made from.
 *
 *   node scripts/deck-export.mjs --url <deck address> --pdf deck.pdf
 *   node scripts/deck-export.mjs --url <deck address> --png ./slides
 *
 * **It goes through the door as "Printer".** A canvas page is behind the
 * identity door, so the browser claims an actor before it looks — the same
 * door-crossing as the journeys runner and the camera, in `lib/browser.mjs`.
 * Nothing is written to any canvas.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { browser, throughTheDoor, until } from "./lib/browser.mjs";

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const url = arg("--url");
const pdf = arg("--pdf");
const png = arg("--png");
if (!url || (!pdf && !png)) {
  console.error("usage: deck-export.mjs --url <deck address> (--pdf <file.pdf> | --png <dir>)");
  process.exit(2);
}
const address = new URL(url);
const origin = address.origin;
/** 1920×1080 is a slide's native size; the frames are 16:9 at the page width. */
const width = Number(arg("--width") ?? 1920);
const height = Number(arg("--height") ?? 1080);
/** How long a slide's own scripts get to draw after its frame has loaded. */
const settleMs = Number(arg("--settle") ?? 1500);

const b = await browser();
try {
  await b.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  const loaded = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: origin });
  await Promise.race([loaded, sleep(15_000)]);
  await throughTheDoor(b, origin, "Printer", "deck-export");
  const opened = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: address.href });
  await Promise.race([opened, sleep(15_000)]);
  await until(b, `document.querySelector(".deck-print") !== null`, "the deck view to render", 20_000);
  // The replica arrives after the page does; the pages count is the sign.
  await until(b, `Number(document.querySelector(".deck-print").dataset.pages) > 0 || document.querySelector(".deck-empty") !== null`, "the slides to arrive", 20_000);
  const count = Number(await b.ev(`document.querySelector(".deck-print").dataset.pages`));
  if (count === 0) {
    console.error("this canvas has no slides to export");
    process.exit(1);
  }
  // Every frame loaded — `complete` is not readable across the sandbox, so
  // the load event is counted from this side — then a settle for scripts.
  await b.ev(`new Promise((done) => {
    const frames = Array.from(document.querySelectorAll(".deck-page iframe"));
    let left = frames.length;
    if (left === 0) return done(true);
    const one = () => { if (--left === 0) done(true); };
    frames.forEach((f) => f.addEventListener("load", one, { once: true }));
    setTimeout(() => done(false), 20000);
  })`);
  await sleep(settleMs);

  if (pdf) {
    const out = await b.send("Page.printToPDF", {
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
    });
    writeFileSync(pdf, Buffer.from(out.data, "base64"));
    console.log(`wrote ${pdf} (${count} ${count === 1 ? "page" : "pages"})`);
  }
  if (png) {
    mkdirSync(png, { recursive: true });
    // The bar is sticky and would lie across the top of whichever slide was
    // scrolled under it — measured: a 56px band on the first picture. Off for
    // the photographs; and the clip is in DOCUMENT coordinates with
    // `captureBeyondViewport`, so no scroll has to have finished first.
    await b.ev(`(() => {
      const s = document.createElement("style");
      s.textContent = ".deck-bar, .deck-page-n { display: none } .deck-page { border-radius: 0; box-shadow: none }";
      document.head.appendChild(s);
      return true;
    })()`);
    for (let i = 0; i < count; i++) {
      const rect = await b.ev(`(() => {
        const el = document.querySelectorAll(".deck-page")[${i}];
        const r = el.querySelector("iframe, img, .deck-page-other").getBoundingClientRect();
        return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
      })()`);
      const shot = await b.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        clip: { ...rect, scale: 1 },
      });
      const file = path.join(png, `slide-${String(i + 1).padStart(2, "0")}.png`);
      writeFileSync(file, Buffer.from(shot.data, "base64"));
    }
    console.log(`wrote ${count} ${count === 1 ? "slide" : "slides"} to ${png}/`);
  }
} finally {
  await b.close();
}

#!/usr/bin/env node
import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  browser,
  throughTheDoor,
  until
} from "./chunk-NCPWVLPN.mjs";
import "./chunk-JYOOXWJZ.mjs";

// scripts/deck-export.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
var argv = process.argv.slice(2);
var arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : void 0;
};
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var url = arg("--url");
var pdf = arg("--pdf");
var png = arg("--png");
if (!url || !pdf && !png) {
  console.error("usage: deck-export.mjs --url <deck address> (--pdf <file.pdf> | --png <dir>)");
  process.exit(2);
}
var address = new URL(url);
if (argv.includes("--notes")) address.searchParams.set("notes", "1");
var origin = address.origin;
var width = Number(arg("--width") ?? 1920);
var height = Number(arg("--height") ?? 1080);
var settleMs = Number(arg("--settle") ?? 1500);
var b = await browser();
try {
  await b.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  const loaded = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: origin });
  await Promise.race([loaded, sleep(15e3)]);
  await throughTheDoor(b, origin, "Printer", "deck-export");
  const opened = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: address.href });
  await Promise.race([opened, sleep(15e3)]);
  await until(b, `document.querySelector(".deck-print") !== null`, "the deck view to render", 2e4);
  await until(b, `Number(document.querySelector(".deck-print").dataset.pages) > 0 || document.querySelector(".deck-empty") !== null`, "the slides to arrive", 2e4);
  const count = Number(await b.ev(`document.querySelector(".deck-print").dataset.pages`));
  if (count === 0) {
    console.error("this canvas has no slides to export");
    process.exitCode = 1;
  } else await exportDeck(b, count);
} finally {
  await b.close();
}
async function exportDeck(b2, count) {
  await b2.ev(`new Promise((done) => {
    const frames = Array.from(document.querySelectorAll(".deck-page iframe"));
    let left = frames.length;
    if (left === 0) return done(true);
    const one = () => { if (--left === 0) done(true); };
    frames.forEach((f) => f.addEventListener("load", one, { once: true }));
    setTimeout(() => done(false), 20000);
  })`);
  await sleep(settleMs);
  if (pdf) {
    const out = await b2.send("Page.printToPDF", {
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0
    });
    writeFileSync(pdf, Buffer.from(out.data, "base64"));
    console.log(`wrote ${pdf} (${count} ${count === 1 ? "page" : "pages"})`);
  }
  if (png) {
    mkdirSync(png, { recursive: true });
    await b2.ev(`(() => {
      const s = document.createElement("style");
      s.textContent = ".deck-bar, .deck-page-n { display: none } .deck-page { border-radius: 0; box-shadow: none }";
      document.head.appendChild(s);
      return true;
    })()`);
    for (let i = 0; i < count; i++) {
      const rect = await b2.ev(`(() => {
        const el = document.querySelectorAll(".deck-page")[${i}];
        const r = el.querySelector("iframe, img, .deck-page-other").getBoundingClientRect();
        return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
      })()`);
      const shot = await b2.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        clip: { ...rect, scale: 1 }
      });
      const file = path.join(png, `slide-${String(i + 1).padStart(2, "0")}.png`);
      writeFileSync(file, Buffer.from(shot.data, "base64"));
    }
    console.log(`wrote ${count} ${count === 1 ? "slide" : "slides"} to ${png}/`);
  }
}

// Renders harness.html in Chrome and writes the PNGs this note shows.
// Run after gen.mts: node docs/research/flow-arrows/shot.mjs
// PLAYWRIGHT_CORE: path to playwright-core's index.mjs (default: the bare package name).
// CHROME: a Chrome binary (default: the macOS install).
import { fileURLToPath } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? "playwright-core");
const dir = fileURLToPath(new URL(".", import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--allow-file-access-from-files"] });
const shots = [
  { name: "before", q: "mode=current&scale=0.3&oy=110", h: 430 },
  { name: "after", q: "mode=proposed&scale=0.3&oy=110", h: 430 },
  { name: "after-naive-lanes", q: "mode=proposed&naive=1&scale=0.3&oy=110", h: 430, keep: false },
  { name: "hover", q: "mode=proposed&scale=0.3&oy=110&hover=s0_sign-in|main.3%23submit", h: 430 },
  { name: "screen-hover", q: "mode=proposed&scale=0.3&oy=110&screen=s2_home", h: 430 },
  { name: "selected", q: "mode=proposed&scale=0.8&ox=-1400&oy=40&sel=s4_detail|footer%23button-1", h: 820 },
];
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: 1440, height: s.h }, deviceScaleFactor: 2 });
  await page.goto(`file://${dir}harness.html?${s.q}`);
  await page.waitForFunction(() => window.DONE === true, null, { timeout: 20000 });
  const r = await page.evaluate(() => ({ measure: window.MEASURE, crossings: window.CROSSINGS }));
  if (s.keep !== false) await page.screenshot({ path: `${dir}${s.name}.png` });
  console.log(s.name, JSON.stringify(r));
  await page.close();
}
await browser.close();

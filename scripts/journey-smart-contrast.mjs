#!/usr/bin/env node
/**
 * **Smart contrast, walked in a real browser** (smart-contrast phase 2).
 *
 * The suite holds the ground tier's VALUES (`groundcontrast.test.ts`); this
 * holds what a browser actually paints with them — the computed colour of the
 * name above a card, a chromeless note's words, a speaker-note caption and the
 * selection ring, on the grounds that bound each side, in both app themes.
 * A value can be right in the stylesheet and lose in the cascade; only a
 * computed style says which.
 *
 *   npm run build
 *   node scripts/journey-smart-contrast.mjs                     # checks 1–3
 *   node scripts/journey-smart-contrast.mjs --capture head.json # check 4, first half
 *   node scripts/journey-smart-contrast.mjs --baseline head.json [--shots dir]
 *
 * The four checks, one printed line each (or one per theme × ground):
 *
 * 1. On Galaxy, Ocean, Snow, Zen and no ground, in light and dark: a selected
 *    and an unselected name, a note's words, a speaker-note caption and the
 *    selected item's outline, each measured against the ground's mean (core's
 *    `GROUND_MEAN`, or the app's ground on the dot grid) at its floor.
 * 2. A card's own words on Galaxy in light mode are exactly the dot grid's:
 *    cards do not move.
 * 3. Snow → Night from the CLI, with the page open: 80ms into the change the
 *    name is strictly between its two endpoints; under reduced motion it is
 *    already the endpoint. Sampled by pausing the page's own transitions at
 *    80ms rather than by a timer, because a headless page's timers fire late
 *    (journeys.mjs, "what it must never assert").
 * 4. With `--baseline`, every inventory element on the dot grid
 *    (`packages/web/test/groundtext.ts`) computes exactly what the file —
 *    captured with `--capture` against an earlier build — says it did.
 *
 * Its own daemon, home and browser; synthetic content. Serves whatever
 * `packages/web/dist` holds, so build first — and build the earlier tree for
 * `--capture`.
 */
import "../index.mjs";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browser, throughTheDoor, until } from "./lib/browser.mjs";
import { reapOnExit, startDaemon } from "./lib/daemon.mjs";

const core = await import("@isocan/core");
const { GROUND_INVENTORY } = await import("../packages/web/test/groundtext.ts");

const repo = fileURLToPath(new URL("..", import.meta.url));
const cli = path.join(repo, "packages/cli/bin/isocan.js");
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
};
const capture = arg("--capture");
const baseline = arg("--baseline");
const shots = arg("--shots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
const line = (ok, what) => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
};

/** `rgb(1, 2, 3)` → `#010203`, for core's `contrastRatio`. */
const hex = (rgb) => {
  const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(rgb ?? "");
  return m ? `#${m.slice(1, 4).map((v) => Math.round(Number(v)).toString(16).padStart(2, "0")).join("")}` : null;
};
const lum = (rgb) => core.luminance(hex(rgb));

const home = mkdtempSync(path.join(tmpdir(), "isocan-smart-contrast-"));
const daemon = await startDaemon({ cli, home });
const run = (...args) => {
  const out = execFileSync(process.execPath, [cli, "--json", ...args], {
    cwd: home, encoding: "utf8",
    env: { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(daemon.origin).port, ISOCAN_SESSION_ID: "smart-contrast", ISOCAN_HARNESS: "test" },
  });
  return /^[[{]/.test(out.trim()) ? JSON.parse(out) : out;
};
const idOf = (out) => out?.itemId ?? out?.id ?? out?.item?.id ?? out?.items?.[0]?.id ?? out?.items?.[0]?.itemId;

let b = null;
try {
  run("identity", "--session", "--name", "Acme Contrast");
  const id = run("canvas", "new", "Acme contrast board").canvasId;
  const file = (name, body) => {
    const p = path.join(home, name);
    writeFileSync(p, body);
    return p;
  };
  const brief = idOf(run("--canvas", id, "add", file("Acme brief.md", "# Acme brief\n\nThe card's own words.\n")));
  const other = idOf(run("--canvas", id, "add", file("Acme other.md", "# Acme other\n\nAnother card.\n")));
  const words = idOf(run("--canvas", id, "text", "Acme words on the ground"));
  // Laid out apart, one op: the brief and another card side by side, the
  // note's words below them.
  run("--canvas", id, "mv", brief, "80", "140", other, "520", "140", words, "80", "520");
  // A speaker note is a text node that points at its slide.
  let noted = false;
  try {
    run("--canvas", id, "slides", "add", brief);
    run("--canvas", id, "slides", "note", brief, "Acme talking point");
    noted = true;
  } catch (err) {
    console.log(`NOTE  no speaker note: ${String(err.message).split("\n")[0]}`);
  }

  b = await browser({ args: ["--disable-extensions"] });
  const unreap = reapOnExit(b.pid);
  await b.send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  const go = async (url) => {
    const loaded = b.once("Page.loadEventFired");
    await b.send("Page.navigate", { url });
    await Promise.race([loaded, sleep(15_000)]);
  };
  await go(daemon.origin);
  await throughTheDoor(b, daemon.origin, "Acme Viewer", "smart-contrast");

  /** Open the canvas in one app theme, with the brief selected by a real click. */
  const open = async (theme) => {
    await b.ev(`(() => { localStorage.setItem("isocan.theme", ${JSON.stringify(theme)}); return true; })()`);
    await go(`${daemon.origin}/p/${id}`);
    await until(b, `[...document.querySelectorAll(".world .item .item-titlebar .name")].some((n) => n.textContent.includes("Acme brief"))`, "the brief's name row");
    const at = await b.ev(`(() => {
      const item = [...document.querySelectorAll(".world .item")].find((i) => i.querySelector(".item-titlebar .name")?.textContent.includes("Acme brief"));
      const r = item.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    for (const type of ["mousePressed", "mouseReleased"]) {
      await b.send("Input.dispatchMouseEvent", { type, x: at.x, y: at.y, button: "left", clickCount: 1 });
    }
    await until(b, `!!document.querySelector(".item.selected .item-titlebar")`, "the brief to be selected");
  };
  /** Wear a ground and let every transition land. */
  const wear = async (ground) => {
    run("--canvas", id, "canvas", "background", ground ?? "none");
    const want = ground === null ? null : core.toneOfGround({ properties: core.themePatch(ground).properties }, "light");
    if (!capture) {
      await until(b, `(document.querySelector(".canvas-page")?.dataset.groundTone ?? null) === ${JSON.stringify(want)}`, `data-ground-tone=${want} on ${ground ?? "no ground"}`);
    } else {
      await until(b, `${ground === null} ? !document.querySelector("[class*=canvas-theme-]") : true`, "the ground to go");
    }
    await sleep(500);
    await b.ev(`(() => { document.getAnimations().forEach((a) => { try { a.finish(); } catch {} }); return true; })()`);
  };
  const read = () => b.ev(`(() => {
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const items = [...document.querySelectorAll(".world .item")];
    const named = (n) => items.find((i) => i.querySelector(".item-titlebar .name")?.textContent.includes(n));
    const brief = named("Acme brief"), other = named("Acme other");
    const words = items.find((i) => i.classList.contains("textnode") && i.textContent.includes("Acme words"));
    return {
      tone: document.querySelector(".canvas-page")?.dataset.groundTone ?? null,
      selectedName: cs(brief?.querySelector(".item-titlebar"))?.color ?? null,
      name: cs(other?.querySelector(".item-titlebar"))?.color ?? null,
      words: cs(words?.querySelector(".md-view"))?.color ?? null,
      noteOf: cs(document.querySelector(".note-of"))?.color ?? null,
      ring: cs(brief)?.outlineColor ?? null,
      card: cs(brief?.querySelector(".item-content .md-view") ?? brief?.querySelector(".item-content"))?.color ?? null,
    };
  })()`);
  const shoot = async (name) => {
    if (!shots) return;
    mkdirSync(shots, { recursive: true });
    const { data } = await b.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(path.join(shots, `${name}.png`), Buffer.from(data, "base64"));
  };

  /** Check 4's reading: every inventory selector present on the page. */
  const inventory = async () => {
    // Point at the other card, so the hover dash is drawn too.
    const at = await b.ev(`(() => {
      const item = [...document.querySelectorAll(".world .item")].find((i) => i.querySelector(".item-titlebar .name")?.textContent.includes("Acme other"));
      const r = item.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
    await sleep(300);
    await b.ev(`(() => { document.getAnimations().forEach((a) => { try { a.finish(); } catch {} }); return true; })()`);
    return b.ev(`(() => {
      const out = {};
      for (const sel of ${JSON.stringify(GROUND_INVENTORY.map((e) => e.selector))}) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const s = getComputedStyle(el);
        out[sel] = { color: s.color, outline: s.outlineColor, border: s.borderTopColor, background: s.backgroundColor };
      }
      return out;
    })()`);
  };

  if (capture) {
    const values = {};
    for (const theme of ["light", "dark"]) {
      await open(theme);
      await wear(null);
      values[theme] = await inventory();
    }
    writeFileSync(capture, JSON.stringify(values, null, 2));
    const n = Object.values(values).reduce((sum, v) => sum + Object.keys(v).length, 0);
    console.log(`CAPTURED  ${n} inventory readings on the dot grid → ${capture}`);
  } else {
    // ---- 1 and 2 ----
    const GROUNDS = [null, "galaxy", "ocean", "snow", "zen"];
    const cards = {};
    for (const theme of ["light", "dark"]) {
      await open(theme);
      for (const ground of GROUNDS) {
        await wear(ground);
        const r = await read();
        const under = ground === null ? core.TEXT_SURFACES[theme].ground : core.GROUND_MEAN[ground];
        const floors = { selectedName: core.CONTRAST_BODY, name: core.CONTRAST_BODY, words: core.CONTRAST_BODY, noteOf: core.CONTRAST_BODY, ring: core.CONTRAST_UI };
        const parts = [];
        let ok = true;
        for (const [key, floor] of Object.entries(floors)) {
          if (key === "noteOf" && !noted) continue;
          const c = hex(r[key]);
          const ratio = c ? core.contrastRatio(c, under) : null;
          const pass = ratio !== null && ratio >= floor;
          ok &&= pass;
          parts.push(`${key} ${c ?? "missing"} ${ratio ?? "?"}${pass ? "" : ` < ${floor}`}`);
        }
        cards[`${theme}/${ground ?? "none"}`] = r.card;
        line(ok, `1 ${theme} on ${ground ?? "no ground"} (${under}, tone ${r.tone ?? "none"}): ${parts.join(", ")}`);
        await shoot(`${theme}-${ground ?? "none"}`);
      }
    }
    line(
      cards["light/galaxy"] !== null && cards["light/galaxy"] === cards["light/none"],
      `2 a card's own words on Galaxy in light are the dot grid's: ${cards["light/galaxy"]} vs ${cards["light/none"]}`,
    );

    // ---- 3 ----
    const sample = async (to) => {
      await b.ev(`(() => {
        window.__sc = null;
        const page = document.querySelector(".canvas-page");
        const name = [...document.querySelectorAll(".world .item")].find((i) => i.querySelector(".item-titlebar .name")?.textContent.includes("Acme other")).querySelector(".item-titlebar");
        new MutationObserver((_, obs) => {
          obs.disconnect();
          /* Twice: the name row's own colour ease only starts once the
             tier's value has moved, so the second pass catches it. */
          const at80 = () => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 80; } };
          at80();
          getComputedStyle(name).color;
          at80();
          const anims = document.getAnimations();
          window.__sc = {
            color: getComputedStyle(name).color,
            ground: anims.filter((a) => String(a.transitionProperty ?? "").startsWith("--ground")).map((a) => a.transitionProperty),
          };
          for (const a of anims) a.play();
        }).observe(page, { attributes: true, attributeFilter: ["data-ground-tone"] });
        return true;
      })()`);
      run("--canvas", id, "canvas", "background", to);
      await until(b, `window.__sc !== null`, `the change to ${to} to land`);
      const s = await b.ev(`window.__sc`);
      await sleep(400);
      await b.ev(`(() => { document.getAnimations().forEach((a) => { try { a.finish(); } catch {} }); return true; })()`);
      return s;
    };
    await open("dark");
    await wear("snow");
    const snow = (await read()).name;
    const moving = await sample("night");
    const night = (await read()).name;
    const [lo, hi] = [lum(snow), lum(night)].sort((x, y) => x - y);
    const mid = lum(moving.color);
    line(
      mid > lo && mid < hi && moving.ground.includes("--ground-ink-muted"),
      `3 Snow → Night crossfades: at 80ms the name is ${moving.color}, between ${snow} and ${night} (transitions: ${moving.ground.join(" ") || "none"})`,
    );
    await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    const still = await sample("snow");
    const snowAgain = (await read()).name;
    line(
      still.color === snowAgain && still.ground.length === 0,
      `3 under reduced motion Night → Snow does not: at 80ms the name is ${still.color}, the endpoint is ${snowAgain}`,
    );
    await b.send("Emulation.setEmulatedMedia", { features: [] });

    // ---- 4 ----
    if (baseline) {
      const before = JSON.parse(readFileSync(baseline, "utf8"));
      for (const theme of ["light", "dark"]) {
        await open(theme);
        await wear(null);
        const now = await inventory();
        const shared = Object.keys(before[theme] ?? {}).filter((sel) => sel in now);
        const differ = shared.filter((sel) => JSON.stringify(before[theme][sel]) !== JSON.stringify(now[sel]));
        for (const sel of shared) {
          console.log(`      ${theme} ${sel}: before ${JSON.stringify(before[theme][sel])} now ${JSON.stringify(now[sel])}`);
        }
        line(differ.length === 0 && shared.length > 0, `4 ${theme}, no ground: ${shared.length} inventory elements, ${differ.length} differ from the baseline${differ.length ? `: ${differ.join(", ")}` : ""}`);
      }
    } else {
      console.log("SKIP  4 needs --baseline <file> from a --capture run against the earlier build");
    }
  }
  unreap();
} catch (err) {
  failed++;
  console.log(`FAIL  ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await b?.close().catch(() => {});
  await daemon.stop().catch(() => {});
  rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
process.exit(failed ? 1 : 0);

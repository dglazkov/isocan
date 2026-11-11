#!/usr/bin/env node
/**
 * **Layers, containing blocks, and overlaps — walked in a real browser.**
 *
 * Stylesheet tests (`packages/web/test/layers.test.ts`) hold the `:root` scale
 * and catch raw numbers. Four real bug classes slip past static CSS rules:
 *
 * 1. **Containing-block traps** — a `position: fixed` popover inside an
 *    ancestor with `backdrop-filter`, `filter`, `transform`, `perspective`, or
 *    `contain` measures its offsets against that ancestor instead of the
 *    viewport, inherits its stacking context, and clips when that ancestor
 *    scrolls (`AddPopover` inside `.tool-rail.floats`, `.wb-peek` inside
 *    `.dock-panel.floats` / `.workbench`, `.identity-popover` inside
 *    `.bar-cluster.floats` on mobile).
 * 2. **Portaled popovers behind covers** — `.fullscreen`, `.workbench`, and
 *    `.module-page` sit at `--z-fullscreen` (55), while body-portaled menus
 *    and hover cards (`.mention-menu`, `.hover-card`, `.wb-peek`,
 *    `.context-menu`, `.proposal-toast`) sit at `--z-popover` (40) or
 *    `--z-toast` (45) unless lifted when a cover is mounted.
 * 3. **Viewport clipping** — a tooltip or popover that opens upward when its
 *    anchor moved to the top of the screen (`.scrubber.at-top .scrub-peek`),
 *    or overflows a narrow viewport (`AddPopover` below 640px).
 * 4. **Co-resident chrome collisions** — two bars, rails, or floating panels
 *    claiming the same edge or corner at the same time (`.sketch-bar` under an
 *    open or chip-bearing `.chat-bar`, `.sketch-bar` on top of `.scrubber`,
 *    `.chat-bar` covering `.zoom-controls` and `.minimap-panel` on narrower
 *    windows, or `.trash-panel` / `.explain-panel` / `.walk-panel` /
 *    `.module-overlays-right` sitting across `.tool-rail` and `.zoom-controls`).
 *
 *   npm run build
 *   node scripts/journey-layers.mjs [--shots <dir>] [--json <file>]
 */
import "../index.mjs";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browser, until } from "./lib/browser.mjs";
import { reapOnExit, startDaemon } from "./lib/daemon.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const cli = path.join(repo, "packages/cli/bin/isocan.js");
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
};
const shotsDir = arg("--shots");
const jsonOut = arg("--json");
const onlyFilter = arg("--only");
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const home = mkdtempSync(path.join(tmpdir(), "isocan-layers-"));
const kitDir = path.join(home, "acme-web");
mkdirSync(path.join(kitDir, "src"), { recursive: true });
writeFileSync(
  path.join(kitDir, "src/checkout.tsx"),
  "export function AcmeCheckout() {\n  return <main><h1>Acme Checkout</h1><button>Place order</button></main>;\n}\n",
);
writeFileSync(
  path.join(kitDir, "src/basket.tsx"),
  "export function AcmeBasket() {\n  return <section><h2>Your basket</h2><p>2 items ready</p></section>;\n}\n",
);

const daemon = await startDaemon({ cli, home });
const baseEnv = {
  ...process.env,
  ISOCAN_HOME: home,
  ISOCAN_PORT: new URL(daemon.origin).port,
  ISOCAN_HARNESS: "test",
};

const runCli = (args, extraEnv = {}) => {
  const out = execFileSync(process.execPath, [cli, "--json", ...args], {
    cwd: home,
    encoding: "utf8",
    env: { ...baseEnv, ISOCAN_SESSION_ID: "layers-owner", ...extraEnv },
  });
  return /^[[{]/.test(out.trim()) ? JSON.parse(out) : out;
};

/**
 * In-page audit function evaluated in real Chromium at every scene.
 */
const AUDIT_SOURCE = `window.__auditLayers = function(opts = {}) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const issues = [];
  const rects = {};

  function describeEl(el) {
    if (!el || el === document.documentElement) return "html";
    const id = el.id ? "#" + el.id : "";
    const cls = typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\\s+/).slice(0, 3).join(".")
      : "";
    return el.tagName.toLowerCase() + id + cls;
  }

  function isShown(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0.5 && r.height > 0.5;
  }

  function findFixedTrap(el) {
    let p = el.parentElement;
    while (p && p !== document.documentElement) {
      const cs = getComputedStyle(p);
      const wb = cs.getPropertyValue("-webkit-backdrop-filter");
      const reasons = [];
      if (cs.transform && cs.transform !== "none") reasons.push("transform");
      if (cs.perspective && cs.perspective !== "none") reasons.push("perspective");
      if (cs.filter && cs.filter !== "none") reasons.push("filter");
      if ((cs.backdropFilter && cs.backdropFilter !== "none") || (wb && wb !== "none")) reasons.push("backdrop-filter");
      if (/\\b(paint|layout|strict|content)\\b/.test(cs.contain || "")) reasons.push("contain:" + cs.contain);
      if (/\\b(transform|perspective|filter|backdrop-filter)\\b/.test(cs.willChange || "")) reasons.push("will-change:" + cs.willChange);
      if (reasons.length) return { ancestor: describeEl(p), reasons };
      p = p.parentElement;
    }
    return null;
  }

  // A. Check every visible fixed element in the document for containing-block traps.
  for (const el of document.querySelectorAll("*")) {
    if (!(el instanceof HTMLElement)) continue;
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed") continue;
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    const trap = findFixedTrap(el);
    if (trap) {
      issues.push({
        kind: "fixed-trap",
        detail: describeEl(el) + " is position:fixed inside " + trap.ancestor + " (" + trap.reasons.join(", ") + ")",
      });
    }
  }

  // B. Check required active surfaces exist, are visible, and stay inside viewport.
  for (const sel of opts.mustExist ?? []) {
    const el = document.querySelector(sel);
    if (!el || !(el instanceof HTMLElement)) {
      issues.push({ kind: "missing", detail: sel + " not in DOM" });
      continue;
    }
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    rects[sel] = { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height), zIndex: cs.zIndex };
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0 || r.width < 8 || r.height < 8) {
      issues.push({ kind: "invisible", detail: sel + " hidden or collapsed (" + Math.round(r.width) + "x" + Math.round(r.height) + ")" });
      continue;
    }
    if (r.left < -1.5 || r.top < -1.5 || r.right > vw + 1.5 || r.bottom > vh + 1.5) {
      issues.push({
        kind: "viewport-clip",
        detail: sel + " clips outside " + vw + "x" + vh + ": [" + Math.round(r.left) + ", " + Math.round(r.top) + ", " + Math.round(r.right) + ", " + Math.round(r.bottom) + "]",
      });
    }
  }

  // C. Check pointer hit-testing at center of required controls / surfaces.
  const allowOver = opts.allowOver ?? [];
  for (const sel of opts.mustHit ?? []) {
    const el = document.querySelector(sel);
    if (!el || !(el instanceof HTMLElement)) {
      issues.push({ kind: "occluded", detail: sel + " missing for hit test" });
      continue;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) {
      issues.push({ kind: "occluded", detail: sel + " collapsed (" + Math.round(r.width) + "x" + Math.round(r.height) + ")" });
      continue;
    }
    const cx = Math.min(vw - 2, Math.max(2, r.left + r.width / 2));
    const cy = Math.min(vh - 2, Math.max(2, r.top + r.height / 2));
    const restorePe = [];
    if (getComputedStyle(el).pointerEvents === "none") {
      restorePe.push([el, el.style.pointerEvents]);
      el.style.pointerEvents = "auto";
    }
    const hit = document.elementFromPoint(cx, cy);
    for (const [node, prev] of restorePe) node.style.pointerEvents = prev;
    if (!hit) {
      issues.push({ kind: "occluded", detail: sel + " elementFromPoint(" + Math.round(cx) + "," + Math.round(cy) + ") returned null" });
      continue;
    }
    const ok = el.contains(hit) || hit.contains(el) || allowOver.some((a) => hit.closest(a));
    if (!ok) {
      issues.push({
        kind: "occluded",
        detail: sel + " at (" + Math.round(cx) + "," + Math.round(cy) + ") hit " + describeEl(hit) + " instead",
      });
    }
  }

  // D. Check pairwise bounding-box intersections across visible painted chrome slabs.
  const CHROME_SLABS = [
    ".toolbar > *",
    ".rail-strip",
    ".dock-panel:not(.chat-bar > *)",
    ".tool-rail",
    ".zoom-controls",
    ".minimap-panel",
    ".minimap-dock.folded .minimap-handle",
    ".chat-bar",
    ".scrubber",
    ".sketch-bar",
    ".marks",
    ".trash-panel",
    ".explain-panel",
    ".walk-panel",
    ".room-card",
    ".away-panel",
    ".follow-banner",
    ".sprint-chip",
    ".stuck-card",
  ];
  if (!opts.skipSlabs) {
    const slabs = [];
    for (const sel of CHROME_SLABS) {
      let idx = 0;
      for (const el of document.querySelectorAll(sel)) {
        if (!isShown(el)) continue;
        if (getComputedStyle(el).pointerEvents === "none") continue;
        if (document.querySelector(".workbench, .fullscreen, .module-page") && !el.closest(".workbench, .fullscreen, .module-page")) {
          continue;
        }
        const r = el.getBoundingClientRect();
        const label = describeEl(el);
        rects[label + (idx ? "#" + idx : "")] = { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height), zIndex: getComputedStyle(el).zIndex };
        slabs.push({ sel: label, el, r });
        idx++;
      }
    }
    for (let i = 0; i < slabs.length; i++) {
      for (let j = i + 1; j < slabs.length; j++) {
        const a = slabs[i];
        const b = slabs[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const ix = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const iy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (ix > 1.5 && iy > 1.5) {
          issues.push({
            kind: "chrome-overlap",
            detail: a.sel + " [" + Math.round(a.r.left) + "," + Math.round(a.r.top) + ".." + Math.round(a.r.right) + "," + Math.round(a.r.bottom) + "] overlaps " +
              b.sel + " [" + Math.round(b.r.left) + "," + Math.round(b.r.top) + ".." + Math.round(b.r.right) + "," + Math.round(b.r.bottom) + "] by " +
              Math.round(ix) + "x" + Math.round(iy) + "px",
          });
        }
      }
    }
  }

  return { viewport: { width: vw, height: vh }, issues, rects };
};`;

const results = [];
let rcProc = null;
let b = null;

try {
  runCli(["identity", "--home", "--name", "Acme Lead"], { ISOCAN_SESSION_ID: "", ISOCAN_HARNESS: "" });
  runCli(["canvas", "create", "Acme Design System"], { ISOCAN_SESSION_ID: "", ISOCAN_HARNESS: "" });
  const id = runCli(["canvas", "create", "Acme Checkout"], { ISOCAN_SESSION_ID: "", ISOCAN_HARNESS: "" }).canvasId;
  runCli(["--canvas", id, "share", "--link", "edit"], { ISOCAN_SESSION_ID: "", ISOCAN_HARNESS: "" });
  runCli(["--canvas", id, "canvas", "group", "new", "Order flow"]);

  const writeHtml = (slug, title, body, dir = home) => {
    const file = path.join(dir, `${slug}.html`);
    writeFileSync(
      file,
      `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font:16px/1.5 system-ui;padding:28px;background:#fff;color:#111"><h1>${title}</h1><p>${body}</p><button style="padding:10px 16px">Continue</button></body>`,
    );
    return file;
  };

  const checkout = runCli([
    "--canvas", id, "add", writeHtml("checkout", "Acme Checkout", "Subtotal $42 · Shipping $6 · Total $48", kitDir),
    "--title", "Checkout", "--size", "390x520", "--in", "Order flow", "--at", "0,0",
  ]).itemId;
  runCli([
    "--canvas", id, "edit", checkout, writeHtml("checkout", "Acme Checkout", "Express pickup ready · Total $42", kitDir),
  ]);
  const basket = runCli([
    "--canvas", id, "add", writeHtml("basket-v1", "Acme Basket", "2 sourdough loaves in basket"),
    "--title", "Basket", "--size", "390x520", "--in", "Order flow", "--at", "480,0",
  ]).itemId;
  const trashed = runCli([
    "--canvas", id, "add", writeHtml("legacy-hero", "Legacy Promo Banner", "Old seasonal banner"),
    "--title", "Legacy Promo Banner", "--size", "390x300", "--at", "960,0",
  ]).itemId;
  runCli(["--canvas", id, "rm", trashed]);

  runCli(["--canvas", id, "comment", "add", "Keep the total prominent near the button", "--item", checkout]);
  execFileSync(process.execPath, [cli, "use", id], {
    cwd: kitDir,
    env: { ...baseEnv, ISOCAN_SESSION_ID: "", ISOCAN_HARNESS: "" },
    encoding: "utf8",
  });
  runCli(["--canvas", id, "rc", "add", "Kit", "--dir", kitDir]);
  runCli(["--canvas", id, "canvas", "edit", "--prop", "proactive=Kit"]);

  runCli(["identity", "--session", "--name", "Pip"], { ISOCAN_SESSION_ID: "pip-agent" });
  runCli(["--canvas", id, "notify", `Updated #${checkout} hierarchy and checked #${basket} spacing.`], { ISOCAN_SESSION_ID: "pip-agent" });
  runCli(["--canvas", id, "react", "👍", checkout], { ISOCAN_SESSION_ID: "pip-agent" });

  rcProc = spawn(process.execPath, [cli, "--canvas", id, "rc"], {
    cwd: home,
    env: { ...baseEnv, ISOCAN_SESSION_ID: "kit-rc" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  reapOnExit(rcProc.pid);

  const { address } = runCli(["--canvas", id, "pass"], { ISOCAN_SESSION_ID: "", ISOCAN_HARNESS: "" });

  b = await browser();

  const setViewport = async (width, height, mobile = false) => {
    await b.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile });
    await sleep(160);
  };
  const installAudit = async () => b.ev(AUDIT_SOURCE);
  const mouseMove = async (x, y) => b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: Math.round(x), y: Math.round(y), button: "none" });
  const clickAt = async (x, y, button = "left", clickCount = 1) => {
    await mouseMove(x, y);
    await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: Math.round(x), y: Math.round(y), button, clickCount });
    await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: Math.round(x), y: Math.round(y), button, clickCount });
  };
  const clickSel = async (sel) => {
    const pt = await b.ev(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!pt) throw new Error(`clickSel: ${sel} not found`);
    await clickAt(pt.x, pt.y);
  };
  const hoverSel = async (sel) => {
    const pt = await b.ev(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!pt) throw new Error(`hoverSel: ${sel} not found`);
    await mouseMove(pt.x, pt.y);
    await sleep(180);
  };
  const pressKey = async (key, code = key, modifiers = 0) => {
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0, modifiers });
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0, modifiers });
  };
  const holdPenSession = async () => {
    await b.ev(`document.activeElement && document.activeElement !== document.body && document.activeElement.blur()`);
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "p", code: "KeyP", windowsVirtualKeyCode: 80 });
    await until(b, `!!document.querySelector(".sketch-bar")`, "wet-ink .sketch-bar mounted", 5_000);
  };
  const releasePenSession = async () => {
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "p", code: "KeyP", windowsVirtualKeyCode: 80 });
    await pressKey("Escape", "Escape");
    await sleep(100);
  };
  const typeIn = async (sel, value) => {
    await b.ev(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) throw new Error("missing input " + ${JSON.stringify(sel)});
      el.focus();
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.setSelectionRange(${value.length}, ${value.length});
      el.dispatchEvent(new KeyboardEvent("keyup", { key: ${JSON.stringify(value.slice(-1) || "a")}, bubbles: true }));
    })()`);
    await sleep(180);
  };
  const runPaletteAction = async (query) => {
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "k", code: "KeyK", windowsVirtualKeyCode: 75, modifiers: 2 });
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "k", code: "KeyK", windowsVirtualKeyCode: 75, modifiers: 2 });
    await until(b, `!!document.querySelector(".palette input")`, `palette to open for ${query}`);
    await typeIn(".palette input", query);
    await sleep(120);
    await pressKey("Enter", "Enter");
    await sleep(240);
  };
  const openTrashFromCanvasMenu = async () => {
    await pressKey("Escape", "Escape");
    await b.ev(`(() => {
      const more = [...document.querySelectorAll(".toolbar button")].find((el) =>
        /menu|more|···|⋯/i.test((el.getAttribute("aria-label") || "") + " " + (el.getAttribute("title") || "") + " " + (el.textContent || "")),
      );
      if (more) { more.click(); return; }
      const vp = document.querySelector(".canvas-viewport");
      if (!vp) throw new Error("missing .canvas-viewport");
      vp.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 120, clientY: 120 }));
    })()`);
    await until(b, `!!document.querySelector(".context-menu, .canvas-popover")`, "canvas menu open", 5_000);
    const clicked = await b.ev(`(() => {
      const row = [...document.querySelectorAll(".context-menu button, .canvas-popover button")].find((el) =>
        /\\bTrash\\b/i.test(el.textContent || ""),
      );
      if (!row) return false;
      row.click();
      return true;
    })()`);
    if (!clicked) throw new Error("Trash option not found in canvas menu");
    await until(b, `!!document.querySelector(".trash-panel")`, "Trash panel open", 5_000);
  };
  const gotoPath = async (urlPath, waitExpr = `!!document.querySelector(".canvas-page")`) => {
    await b.send("Page.navigate", { url: `${daemon.origin}${urlPath}` });
    await until(b, `(${waitExpr}) && !document.querySelector(".canvas-finding")`, urlPath, 15_000);
    await sleep(220);
  };
  const selectItemOnCanvas = async (itemId) => {
    const pt = await b.ev(`(() => {
      const el = [...document.querySelectorAll(".world .item")].find((node) =>
        node.dataset.itemId === ${JSON.stringify(itemId)} || node.textContent.includes("Checkout"),
      );
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!pt) throw new Error(`item ${itemId} not found on canvas`);
    await clickAt(pt.x, pt.y);
    await until(b, `!!document.querySelector(".item.selected")`, "item selected", 5_000);
  };

  const runScene = async (slug, label, fn, opts = {}) => {
    if (onlyFilter && !slug.includes(onlyFilter)) return;
    try {
      await fn();
      await installAudit();
      await sleep(140);
      const report = await b.ev(`window.__auditLayers(${JSON.stringify(opts)})`);
      let shotFile = null;
      if (shotsDir) {
        shotFile = path.join(shotsDir, `${slug}.png`);
        const { data } = await b.send("Page.captureScreenshot", { format: "png" });
        writeFileSync(shotFile, Buffer.from(data, "base64"));
      }
      const ok = report.issues.length === 0;
      results.push({ slug, label, ok, viewport: report.viewport, issues: report.issues, rects: report.rects, shot: shotFile });
      console.log(`${ok ? "PASS" : "FAIL"}  [${slug}] ${label}${ok ? "" : ` (${report.issues.length} issue${report.issues.length === 1 ? "" : "s"})`}`);
      for (const issue of report.issues) console.log(`        - [${issue.kind}] ${issue.detail}`);
    } catch (err) {
      let shotFile = null;
      if (shotsDir) {
        shotFile = path.join(shotsDir, `${slug}-error.png`);
        const { data } = await b.send("Page.captureScreenshot", { format: "png" }).catch(() => ({ data: null }));
        if (data) writeFileSync(shotFile, Buffer.from(data, "base64"));
      }
      const msg = String(err?.message ?? err).split("\n")[0];
      results.push({ slug, label, ok: false, viewport: null, issues: [{ kind: "scene-error", detail: msg }], rects: {}, shot: shotFile });
      console.log(`FAIL  [${slug}] ${label} (scene-error)`);
      console.log(`        - [scene-error] ${msg}`);
    }
  };

  // Boot through pass door onto canvas at 1440x900 and read the live canvas pathname directly.
  await setViewport(1440, 900);
  await b.send("Page.navigate", { url: address });
  await until(b, `!!document.querySelector(".canvas-page") && !!document.querySelector(".toolbar") && !!document.querySelector(".tool-rail") && !document.querySelector(".canvas-finding")`, "canvas boot", 25_000);
  const canvasPath = await b.ev(`location.pathname`);
  await b.ev(`localStorage.setItem("isocan.chat.at", "left"); true`);
  await gotoPath(canvasPath, `!!document.querySelector(".toolbar") && !!document.querySelector(".tool-rail")`);

  // Scene 01: Left dock closed default chrome
  await runScene("01-canvas-left-closed", "Canvas 1440x900 — left rail strip, toolbar islands, tool rail, minimap & zoom controls", async () => {
    await b.ev(`document.querySelector('.dock-panel .main-close:not(.chat-move):not(.chat-tidy-open)')?.click()`);
    await sleep(160);
  }, {
    mustExist: [".tool-rail", ".tool-rail button[aria-label='Add']", ".zoom-controls", ".minimap-panel"],
    mustHit: [".tool-rail button[aria-label='History']", ".zoom-controls", ".minimap-panel"],
  });

  // Scene 02: Left dock open on Chat
  await runScene("02-canvas-left-chat-open", "Canvas 1440x900 — left Chat dock open alongside canvas chrome", async () => {
    await runPaletteAction("Chat");
    await until(b, `!!document.querySelector(".dock-panel .main-msgs")`, "left Chat dock open");
  }, {
    mustExist: [".dock-panel", ".tool-rail", ".zoom-controls"],
    mustHit: [".dock-panel textarea", ".tool-rail button[aria-label='History']", ".zoom-controls"],
  });

  // Scene 03: AddPopover on 1440x900 desktop
  await runScene("03-add-popover-desktop", "Canvas 1440x900 — AddPopover open beside tool rail (containing-block & stacking check)", async () => {
    await runPaletteAction("Add");
    await until(b, `!!document.querySelector(".add-popover")`, "AddPopover open on desktop");
  }, {
    mustExist: [".add-popover"],
    mustHit: [".add-popover input.text-input", ".add-popover .add-kinds"],
  });
  await pressKey("Escape", "Escape");

  // Scene 04: AddPopover on 640x520 narrow + short desktop boundary viewport
  await runScene("04-add-popover-narrow-640x520", "Narrow & short 640x520 — AddPopover open beside compact tool rail (containing-block & short-window fit)", async () => {
    await setViewport(640, 520, false);
    await gotoPath(canvasPath, `!!document.querySelector(".tool-rail")`);
    await runPaletteAction("Add");
    await until(b, `!!document.querySelector(".add-popover")`, "AddPopover open on 640x520 viewport");
  }, {
    mustExist: [".add-popover"],
    mustHit: [".add-popover input.text-input", ".add-popover .add-kinds"],
    skipSlabs: false,
  });

  // Restore 1440x900 desktop for right-side panels & docks.
  await setViewport(1440, 900, false);
  await gotoPath(canvasPath, `!!document.querySelector(".toolbar") && !!document.querySelector(".tool-rail")`);

  // Scene 05: Trash panel open on canvas
  await runScene("05-canvas-trash-panel", "Canvas 1440x900 — Trash panel open with toolbar, tool rail & zoom controls", async () => {
    await openTrashFromCanvasMenu();
  }, {
    mustExist: [".trash-panel", ".tool-rail", ".zoom-controls"],
    mustHit: [".trash-panel header", ".trash-panel .trash-entry button", ".tool-rail button[aria-label='History']", ".zoom-controls"],
  });
  await b.ev(`document.querySelector(".trash-panel header button")?.click()`);
  await sleep(140);

  // Scene 06: Reactions (.marks) dock open on canvas
  await runScene("06-canvas-marks-dock", "Canvas 1440x900 — Reactions (.marks) dock open with toolbar, tool rail & zoom controls", async () => {
    await clickSel(".tool-rail button[aria-label='Reactions']");
    await until(b, `!!document.querySelector(".marks")`, "Reactions (.marks) dock open");
  }, {
    mustExist: [".marks", ".tool-rail", ".zoom-controls"],
    mustHit: [".marks", ".tool-rail button[aria-label='History']", ".zoom-controls"],
  });
  await b.ev(`document.querySelector(".marks header button")?.click()`);
  if (await b.ev(`!!document.querySelector(".marks")`)) await clickSel(".tool-rail button[aria-label='Reactions']");
  await until(b, `!document.querySelector(".marks")`, "Reactions (.marks) closed");

  // Scene 07: Explain panel open on canvas
  await runScene("07-canvas-explain-panel", "Canvas 1440x900 — Explain panel open beside tool rail & toolbar", async () => {
    await selectItemOnCanvas(checkout);
    await runPaletteAction("Explain");
    await until(b, `!!document.querySelector(".explain-panel")`, "Explain panel open");
  }, {
    mustExist: [".explain-panel", ".tool-rail", ".zoom-controls"],
    mustHit: [".explain-panel .explain-close", ".tool-rail button[aria-label='History']", ".zoom-controls"],
  });
  await b.ev(`document.querySelector(".explain-panel .explain-close")?.click()`);
  await sleep(120);

  // Scene 08: Walk panel open (with simulated walker lanes expanded) on canvas
  await runScene("08-canvas-walk-panel", "Canvas 1440x900 — Walk panel open (with lanes) beside tool rail & zoom controls", async () => {
    await selectItemOnCanvas(checkout);
    await runPaletteAction("Walk it as someone else");
    await until(b, `!!document.querySelector(".walk-panel")`, "Walk panel open");
    if (await b.ev(`!!document.querySelector("[data-walk-go]")`)) {
      await clickSel("[data-walk-go]");
      await sleep(250);
    }
  }, {
    mustExist: [".walk-panel", ".tool-rail", ".zoom-controls"],
    mustHit: [".walk-panel .walk-close", ".tool-rail button[aria-label='History']", ".zoom-controls"],
  });
  await b.ev(`document.querySelector(".walk-panel .walk-close")?.click()`);
  await sleep(120);

  // Scene 09: Left-dock layout + History Scrubber + wet-ink Pen Sketch Bar active simultaneously
  await runScene("09-left-scrubber-and-sketch", "Canvas 1440x900 (chat left) — History scrubber AND wet-ink Pen sketch-bar active together", async () => {
    await pressKey("Escape", "Escape");
    await clickSel(".tool-rail button[aria-label='History']");
    await until(b, `!!document.querySelector(".scrubber")`, "History Scrubber at bottom");
    await holdPenSession();
  }, {
    mustExist: [".scrubber", ".sketch-bar"],
    mustHit: [".scrubber", ".sketch-bar"],
  });
  await releasePenSession();
  await b.ev(`document.querySelector(".tool-rail button[aria-label='History']")?.click()`);
  await sleep(140);

  // Switch Chat to BOTTOM bar using the real `.chat-move` header button.
  if (!(await b.ev(`!!document.querySelector(".dock-panel .chat-move")`))) {
    await runPaletteAction("Chat");
    await until(b, `!!document.querySelector(".dock-panel .chat-move")`, "Chat move button");
  }
  await clickSel(".dock-panel .chat-move");
  await until(b, `!!document.querySelector(".chat-bar")`, "Chat bar docked at bottom");

  // Scene 10: Chat at bottom + History Scrubber at top + hover bar for `.scrub-peek`
  await runScene("10-chat-bottom-scrubber-peek", "Canvas 1440x900 (chat bottom) — Top History scrubber with hovered .scrub-peek tooltip", async () => {
    await clickSel(".tool-rail button[aria-label='History']");
    await until(b, `!!document.querySelector(".scrubber.at-top .scrub-bar")`, "Top Scrubber bars rendered");
    await hoverSel(".scrubber.at-top .scrub-bar");
    await until(b, `!!document.querySelector(".scrubber.at-top .scrub-peek")`, "Scrubber peek card shown on hover");
  }, {
    mustExist: [".chat-bar", ".scrubber.at-top", ".scrubber.at-top .scrub-peek"],
    mustHit: [".chat-bar", ".scrubber.at-top .scrub-peek"],
  });
  await mouseMove(720, 450);
  await b.ev(`document.querySelector(".tool-rail button[aria-label='History']")?.click()`);
  await sleep(140);

  // Scene 11: Chat at bottom (minimized WITH selected item attachment row) + wet-ink Pen `.sketch-bar`
  await runScene("11-chat-bottom-chips-and-sketch", "Canvas 1440x900 (chat bottom + selected chip) — Wet-ink Pen sketch-bar vs bottom chat-bar", async () => {
    await selectItemOnCanvas(checkout);
    await holdPenSession();
  }, {
    mustExist: [".chat-bar", ".sketch-bar"],
    mustHit: [".chat-bar textarea", ".sketch-bar"],
  });
  await releasePenSession();

  // Scene 12: Chat at bottom OPEN (messages expanded!) + wet-ink Pen `.sketch-bar`
  await runScene("12-chat-bottom-open-and-sketch", "Canvas 1440x900 (chat bottom OPEN) — Expanded chat-bar vs wet-ink Pen sketch-bar", async () => {
    await clickSel('.chat-bar-controls button[aria-label*="Chat"]');
    await until(b, `!!document.querySelector(".chat-bar.open .main-scroll")`, "Bottom chat-bar expanded open");
    await b.ev(`document.activeElement && document.activeElement !== document.body && document.activeElement.blur()`);
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "p", code: "KeyP", windowsVirtualKeyCode: 80 });
    await until(b, `!!document.querySelector(".sketch-bar")`, "wet-ink .sketch-bar mounted while chat open", 5_000);
  }, {
    mustExist: [".chat-bar.open", ".sketch-bar"],
    mustHit: [".chat-bar.open textarea", ".sketch-bar"],
  });
  await releasePenSession();
  await b.ev(`document.querySelector('.chat-bar-controls button[aria-label*="Minimize"]')?.click()`);
  await sleep(120);

  // Scene 13: Chat at bottom at 1024x768 (laptop split screen / iPad landscape)
  await runScene("13-chat-bottom-1024x768", "Canvas 1024x768 (chat bottom) — Bottom chat-bar vs minimap & zoom controls", async () => {
    await setViewport(1024, 768, false);
    await gotoPath(canvasPath, `!!document.querySelector(".chat-bar") && !!document.querySelector(".zoom-controls")`);
  }, {
    mustExist: [".chat-bar", ".zoom-controls", ".minimap-panel"],
    mustHit: [".chat-bar textarea", ".zoom-controls button", ".minimap-panel"],
  });

  // Scene 14: Chat at bottom at 820x700 (side pane / tablet portrait)
  await runScene("14-chat-bottom-820x700", "Canvas 820x700 (chat bottom) — Narrow desktop bottom chat-bar vs minimap & zoom controls", async () => {
    await setViewport(820, 700, false);
    await gotoPath(canvasPath, `!!document.querySelector(".chat-bar") && !!document.querySelector(".zoom-controls")`);
  }, {
    mustExist: [".chat-bar", ".zoom-controls"],
    mustHit: [".chat-bar textarea", ".zoom-controls button"],
  });

  // Restore 1440x900 for Cover routes.
  await setViewport(1440, 900, false);
  await gotoPath(canvasPath, `!!document.querySelector(".toolbar") && !!document.querySelector(".tool-rail")`);

  // Scene 15: Item Stage Cover (`/w/:checkout` -> `.workbench`) — `/` `.mention-menu` & `.hover-card.command-card` above cover
  await runScene("15-focus-cover-slash-menu", "Item Stage Cover 1440x900 (/w/:id) — Slash .mention-menu & .command-card above cover", async () => {
    await gotoPath(`${canvasPath.replace(/\/$/, "")}/w/${checkout}`, `!!document.querySelector(".workbench textarea")`);
    await typeIn(".workbench textarea", "/");
    await until(b, `!!document.querySelector(".mention-menu button")`, "Slash command .mention-menu mounted in cover");
    await hoverSel(".mention-menu button");
  }, {
    mustExist: [".workbench", ".mention-menu"],
    mustHit: [".mention-menu button"],
    skipSlabs: false,
  });

  // Scene 16: Workbench Cover (`w` shortcut from canvas) — `@` `.mention-menu` above `.workbench`
  await gotoPath(canvasPath, `!!document.querySelector(".toolbar") && !!document.querySelector(".tool-rail")`);
  await pressKey("Escape", "Escape");
  await runScene("16-workbench-cover-mention-menu", "Workbench Cover 1440x900 (/w) — @mention menu above .workbench (z-fullscreen: 55)", async () => {
    await pressKey("w", "KeyW");
    await until(b, `!!document.querySelector(".workbench") && !!document.querySelector(".workbench textarea")`, "Workbench cover open");
    await typeIn(".workbench textarea", "@");
    await until(b, `!!document.querySelector(".mention-menu")`, "@mention menu mounted inside Workbench");
  }, {
    mustExist: [".workbench", ".mention-menu"],
    mustHit: [".mention-menu button"],
    skipSlabs: false,
  });
  await typeIn(".workbench textarea", "").catch(() => {});

  // Scene 17: Workbench Cover (`/w`) — hovered agent `.wb-row` -> `.wb-peek`
  await runScene("17-workbench-cover-agent-peek", "Workbench Cover 1440x900 (/w) — Hovered agent row .wb-peek above .workbench", async () => {
    await until(b, `!!document.querySelector(".workbench .wb-row")`, "Workbench .wb-row present");
    await hoverSel(".workbench .wb-row");
    await until(b, `!!document.querySelector(".wb-peek")`, ".wb-peek mounted on hover");
  }, {
    mustExist: [".workbench", ".wb-peek"],
    mustHit: [".wb-peek"],
    skipSlabs: false,
  });
  await mouseMove(10, 10);

  // Scene 18: Workbench Cover (`/w`) — hover bound directory file row `.wb-tree-file.on-canvas` -> `.hover-card.item-peek`
  await runScene("18-workbench-cover-file-peek", "Workbench Cover 1440x900 (/w) — Hovered bound file row .item-peek above .workbench", async () => {
    await until(b, `!!document.querySelector(".workbench .wb-tree-file.on-canvas")`, "Workbench bound file row present", 5_000);
    await hoverSel(".workbench .wb-tree-file.on-canvas");
    await until(b, `!!document.querySelector(".hover-card")`, "Workbench file hover-card mounted", 5_000);
  }, {
    mustExist: [".workbench", ".hover-card"],
    mustHit: [".hover-card"],
    skipSlabs: false,
  });
} finally {
  if (rcProc && rcProc.exitCode === null) rcProc.kill("SIGTERM");
  await b?.close();
  await daemon.stop();
  rmSync(home, { recursive: true, force: true });
}

if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify(results, null, 2));
}

const failedScenes = results.filter((r) => !r.ok);
console.log(`\nSummary: ${results.length - failedScenes.length}/${results.length} scenes cleanly layered (${failedScenes.length} failed)`);
process.exit(failedScenes.length > 0 ? 1 : 0);

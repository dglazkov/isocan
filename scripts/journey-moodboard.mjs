#!/usr/bin/env node
/**
 * Headless Chrome journey for moodboard Phases 1–2: Keep, drop, more, push, and swatches.
 * Run after `npm run build`: `node scripts/journey-moodboard.mjs`
 */
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { crc32, deflateSync } from "node:zlib";
import { register } from "tsx/esm/api";

register();

const repo = fileURLToPath(new URL("../", import.meta.url));
const { startDaemon } = await import(pathToFileURL(path.join(repo, "packages/server/src/daemon.ts")).href);
const { writeKey } = await import(pathToFileURL(path.join(repo, "packages/core/src/keystore.ts")).href);
const { deltaE, parseMoodSwatches } = await import(pathToFileURL(path.join(repo, "packages/core/src/mood.ts")).href);
const { writeBadge, adoptIdentity } = await import(pathToFileURL(path.join(repo, "packages/server/src/badge-store.ts")).href);
const { DaemonClient } = await import(pathToFileURL(path.join(repo, "packages/api/src/client.ts")).href);
const { BADGE_COOKIE, parseBadgeToken } = await import(pathToFileURL(path.join(repo, "packages/core/src/index.ts")).href);
const { browser, until } = await import(pathToFileURL(path.join(repo, "scripts/lib/browser.mjs")).href);
const { click, navigate, enterName, screenshot } = await import(pathToFileURL(path.join(repo, "scripts/lib/personal-journey-fixture.mjs")).href);
const { clickText, fill } = await import(pathToFileURL(path.join(repo, "scripts/lib/design-systems-browser.mjs")).href);

function makeTricolorPng(width = 60, height = 60) {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    raw[row] = 0;
    const [r, g, b] =
      y < Math.floor(height * 0.5)
        ? [0xb5, 0x65, 0x1d]
        : y < Math.floor(height * 0.8)
          ? [0x2f, 0x3e, 0x46]
          : [0xf4, 0xf1, 0xea];
    for (let x = 0; x < width; x++) {
      const o = row + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = 255;
    }
  }
  const pngChunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** A 60×60 synthetic tricolour PNG (#b5651d crust, #2f3e46 slate, #f4f1ea flour) returned by the stubbed image model. */
const PNG_BASE64 = makeTricolorPng(60, 60).toString("base64");
const GEMINI_KEY = "fake-gemini-acme-mood-journey-1234567890";
const CANVAS_ID = "prj_acme_mood_journey";

const output = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-moodboard-journey-"));
const home = path.join(output, "daemon-home");
const clientHome = path.join(output, "client-home");
await fs.mkdir(home, { recursive: true });
await fs.mkdir(clientHome, { recursive: true });

process.env.ISOCAN_STORE = "file";
await writeKey(home, "gemini", GEMINI_KEY);

const modelCalls = [];
const fakeFetch = async (url, init) => {
  const body = JSON.parse(String(init?.body ?? "{}"));
  modelCalls.push({ url: String(url), body });
  return new Response(
    JSON.stringify({
      id: `int_acme_${modelCalls.length}`,
      object: "interaction",
      status: "completed",
      steps: [
        {
          type: "model_output",
          content: [{ type: "image", mime_type: "image/png", data: PNG_BASE64 }],
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
};

const daemon = await startDaemon({
  host: "127.0.0.1",
  port: 0,
  home,
  birthHome: null,
  auth: null,
  operators: [],
  contentPort: "off",
  image: { fetch: fakeFetch, perMinute: 40 },
});
const port = daemon.app.server.address().port;
const base = `http://127.0.0.1:${port}`;
const b = await browser();
await b.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });

const checks = [];
const trayReady = () =>
  until(b, `document.querySelectorAll(".mood-tray button:disabled").length === 0`, "mood tray idle");

try {
  // 1. Identity, workstation owner record, and canvas creation.
  await navigate(b, `${base}/`);
  const maya = await enterName(b, "Acme Maya");
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify(maya));

  const cookies = (await b.send("Network.getCookies", { urls: [base] })).cookies;
  const token = parseBadgeToken(cookies.find((c) => c.name === BADGE_COOKIE)?.value ?? "");
  assert(token, "browser holds a valid badge cookie");
  await writeBadge(clientHome, base, { ...token, at: new Date().toISOString() });
  await adoptIdentity(clientHome, maya);
  const client = new DaemonClient(base, clientHome);

  await client.sendOp(null, maya, {
    type: "project.create",
    canvasId: CANVAS_ID,
    title: "Acme Mood Journey",
    groupMode: "groups",
  });

  // 2. Enable moodboard experiment and open the canvas.
  await b.ev(`localStorage.setItem("isocan.experiments", JSON.stringify(["moodboard"]))`);
  await navigate(b, `${base}/p/${CANVAS_ID}`);
  await until(b, `document.querySelector(".canvas-page") !== null`, "canvas page loaded");

  // 3. Open Design systems -> Explore a look… (and verify cost line), then also test `/moodboard`.
  await click(b, '[aria-label="Design system and references"]');
  await until(b, `document.querySelector(".design-systems") !== null`, "Design systems dialog open");
  await clickText(b, "Explore a look…", ".design-systems button");
  await until(b, `document.querySelector(".mood-dialog") !== null`, "Explore a look dialog opened from Design systems");
  const initialCost = await b.ev(`document.querySelector('[data-testid="mood-cost-line"]')?.textContent?.trim()`);
  assert(initialCost?.startsWith("9 images ≈ $"), `expected 9-image cost line, got: ${initialCost}`);
  await clickText(b, "Cancel", ".mood-dialog button");
  await until(b, `document.querySelector(".mood-dialog") === null`, "Explore dialog closed");

  // Open via `/moodboard a quiet bakery at dawn` in the Chat composer.
  if (!(await b.ev(`document.querySelector(".main-panel form textarea") !== null`))) {
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "j", modifiers: 4, windowsVirtualKeyCode: 74 });
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "j", windowsVirtualKeyCode: 74 });
  }
  await until(b, `document.querySelector(".main-panel form textarea") !== null`, "Chat composer open");
  await fill(b, ".main-panel form textarea", "/moodboard a quiet bakery at dawn");
  await click(b, '.main-panel button[type="submit"]');
  await until(b, `document.querySelector(".mood-dialog") !== null`, "Explore dialog opened from /moodboard");
  const seededWords = await b.ev(`document.querySelector('.mood-dialog textarea')?.value`);
  assert.equal(seededWords, "a quiet bakery at dawn");
  checks.push("Design systems button and /moodboard both open Explore a look with live cost line.");

  // 4. Submit exploration of 9 tiles.
  await clickText(b, "Draw spread", ".mood-dialog button");
  await until(b, `document.querySelector(".mood-dialog") === null`, "Explore dialog closed after Draw spread");
  await until(b, `document.querySelectorAll(".mood-tray .mood-tile").length === 9`, "9 candidate tiles in Mood tray");
  assert.equal(modelCalls.length, 9, "stubbed image model called 9 times");
  const firstRunId = await b.ev(`document.querySelector(".mood-tray-run")?.getAttribute("data-mood-run")`);
  assert(firstRunId, "first tray run id present");
  checks.push("Explore generates 9 candidate tiles and opens the Mood tray.");

  // 5. Keep 2 tiles together via multi-select, then Keep 1 more tile via ✓ Keep.
  const firstThreeIds = await b.ev(`Array.from(document.querySelectorAll(".mood-tray .mood-tile")).slice(0, 3).map(e => e.getAttribute("data-mood-tile"))`);
  assert.equal(firstThreeIds.length, 3);
  await click(b, `[data-mood-tile="${firstThreeIds[0]}"] .mood-tile-thumb`);
  await click(b, `[data-mood-tile="${firstThreeIds[1]}"] .mood-tile-thumb`);
  await clickText(b, "Keep selected (2)", ".mood-tray button");
  await until(b, `document.querySelectorAll(".mood-tray .mood-tile").length === 7`, "2 tiles moved out of candidate tray");
  await trayReady();

  await click(b, `[data-mood-tile="${firstThreeIds[2]}"] .mood-btn-keep`);
  await until(b, `document.querySelectorAll(".mood-tray .mood-tile").length === 6`, "3rd tile moved out of candidate tray");
  await trayReady();

  let snap = await client.snapshot(CANVAS_ID);
  const boards = Object.values(snap.canvas.items).filter((i) => i.properties.moodBoard === "true");
  assert.equal(boards.length, 1, "exactly one Mood board created and reused");
  const board = boards[0];
  assert.equal(board.title, "Mood");
  const webSwatchesByItem = {};
  for (const id of firstThreeIds) {
    assert.equal(snap.canvas.items[id]?.properties.mood, "kept", `${id} marked kept`);
    assert.equal(snap.canvas.items[id]?.containerId, board.id, `${id} moved into Mood board`);
    const rawSwatches = snap.canvas.items[id]?.properties.moodSwatches;
    assert(rawSwatches, `${id} carries moodSwatches after browser Keep`);
    webSwatchesByItem[id] = rawSwatches;
    const swatches = parseMoodSwatches(rawSwatches);
    assert(swatches.length >= 3, `${id} extracted at least 3 swatches`);
    assert(deltaE(swatches[0].hex, "#b5651d") <= 3, `crust ΔE <= 3, got ${swatches[0].hex} (ΔE ${deltaE(swatches[0].hex, "#b5651d").toFixed(2)})`);
    assert(deltaE(swatches[1].hex, "#2f3e46") <= 3, `slate ΔE <= 3, got ${swatches[1].hex} (ΔE ${deltaE(swatches[1].hex, "#2f3e46").toFixed(2)})`);
    assert(deltaE(swatches[2].hex, "#f4f1ea") <= 3, `flour ΔE <= 3, got ${swatches[2].hex} (ΔE ${deltaE(swatches[2].hex, "#f4f1ea").toFixed(2)})`);
  }
  await until(
    b,
    `document.querySelectorAll(${JSON.stringify(`[data-item-id="${firstThreeIds[0]}"] .mood-swatch-strip .mood-swatch-chip`)}).length >= 3`,
    "swatch strip rendered under kept tile on Mood board",
  );
  checks.push("Keeping tiles creates the Mood board once, writes moodSwatches within ΔE <= 3, and renders .mood-swatch-strip.");

  // 6. Drop 1 candidate tile with ✕ Drop.
  const dropId = await b.ev(`document.querySelector(".mood-tray .mood-tile")?.getAttribute("data-mood-tile")`);
  assert(dropId);
  await click(b, `[data-mood-tile="${dropId}"] [aria-label^="Drop "]`);
  await until(b, `document.querySelectorAll(".mood-tray .mood-tile").length === 5`, "dropped tile removed from tray");
  await trayReady();
  snap = await client.snapshot(CANVAS_ID);
  assert.equal(snap.canvas.items[dropId], undefined, "dropped tile deleted from canvas");
  checks.push("Dropping a candidate tile deletes it from the canvas and tray.");

  // 7. Run More like this and Push -> quieter from the tray.
  const branchParentId = await b.ev(`document.querySelector(".mood-tray .mood-tile")?.getAttribute("data-mood-tile")`);
  assert(branchParentId);
  const callsBeforeMore = modelCalls.length;
  await click(b, `[data-mood-tile="${branchParentId}"] [aria-label^="More like "]`);
  await until(b, `document.querySelectorAll(".mood-tray-run").length === 2`, "More like this opened a second tray run");
  await trayReady();
  assert.equal(modelCalls.length - callsBeforeMore, 4, "More like this generated 4 tiles");

  const callsBeforePush = modelCalls.length;
  const pushSelector = `[data-mood-tile="${branchParentId}"] .mood-push-select`;
  await until(b, `document.querySelector(${JSON.stringify(pushSelector)}) !== null`, "Push select present");
  await b.ev(`(() => {
    const select = document.querySelector(${JSON.stringify(pushSelector)});
    select.focus();
    select.value = "quieter";
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await until(b, `document.querySelectorAll(".mood-tray-run").length === 3`, "Push -> quieter opened a third tray run");
  await trayReady();
  assert.equal(modelCalls.length - callsBeforePush, 4, "Push -> quieter generated 4 tiles");
  assert(
    String(modelCalls.at(-1)?.body?.input?.find((p) => p.type === "text")?.text ?? "").includes("Push the look quieter:"),
    "Push prompt wrapped with quieter dial",
  );

  snap = await client.snapshot(CANVAS_ID);
  const pushedTiles = Object.values(snap.canvas.items).filter(
    (i) => i.properties.moodParent === branchParentId && i.properties.moodAxis?.startsWith("push: quieter · "),
  );
  assert.equal(pushedTiles.length, 4, "4 pushed tiles carry moodParent and push: quieter axis");
  checks.push("More like this and Push -> quieter each branch 4 tiles with moodParent and moodAxis.");

  // 8. Fit the canvas onto the stage, drop a synthetic reference photo onto the Mood board, and run More like this from its item menu.
  await click(b, ".zoom-pct");
  await clickText(b, "Zoom to Fit", ".zoom-menu-row > span:first-child");
  await b.ev(`new Promise(requestAnimationFrame)`);

  await b.ev(`(async () => {
    const boardEl = document.querySelector(${JSON.stringify(`[data-item-id="${board.id}"]`)});
    if (!boardEl) throw new Error("Mood board DOM element not found");
    const rect = boardEl.getBoundingClientRect();
    const clientX = rect.left + Math.min(80, rect.width / 2);
    const clientY = rect.top + Math.min(80, rect.height / 2);
    const bytes = Uint8Array.from(atob(${JSON.stringify(PNG_BASE64)}), (c) => c.charCodeAt(0));
    const file = new File([bytes], "acme-linen-ref.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);
    const dropEvent = new DragEvent("drop", { bubbles: true, cancelable: true, clientX, clientY, dataTransfer: dt });
    boardEl.dispatchEvent(dropEvent);
  })()`);

  let refItem = null;
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    snap = await client.snapshot(CANVAS_ID);
    refItem = Object.values(snap.canvas.items).find((i) => i.properties.mood === "reference") ?? null;
    if (refItem) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert(refItem, "dropped photo received mood=reference");
  assert.equal(refItem.containerId, board.id, "reference photo landed inside Mood board");
  const refSwatches = parseMoodSwatches(refItem.properties.moodSwatches);
  assert(refSwatches.length >= 3, "dropped reference photo also carries moodSwatches");
  assert(deltaE(refSwatches[0].hex, "#b5651d") <= 3, "reference photo crust ΔE <= 3");
  await until(b, `document.querySelector(${JSON.stringify(`[data-item-id="${refItem.id}"] .mood-swatch-strip`)}) !== null`, "reference tile and swatch strip rendered");

  // Fit again after the drop and enter the Mood board group so right-clicking targets the child item, not the outer group.
  await click(b, ".zoom-pct");
  await clickText(b, "Zoom to Fit", ".zoom-menu-row > span:first-child");
  await b.ev(`new Promise(requestAnimationFrame)`);

  await b.ev(`(() => {
    const boardEl = document.querySelector(${JSON.stringify(`[data-item-id="${board.id}"]`)});
    const rect = boardEl.getBoundingClientRect();
    boardEl.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, clientX: rect.left + 20, clientY: rect.top + 20 }));
  })()`);
  await b.ev(`(() => {
    const refEl = document.querySelector(${JSON.stringify(`[data-item-id="${refItem.id}"]`)});
    if (!refEl) throw new Error("reference item element not found");
    const rect = refEl.getBoundingClientRect();
    refEl.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: rect.left + Math.min(20, rect.width / 2), clientY: rect.top + Math.min(20, rect.height / 2), button: 2 }));
  })()`);
  await until(b, `document.querySelector(".context-menu") !== null`, "item context menu opened on reference tile");
  await clickText(b, "More like this…", ".context-menu button");
  await until(b, `document.querySelector(".mood-dialog") !== null`, "Explore dialog opened from reference item menu");
  const refDialogCount = await b.ev(`Number(document.querySelector('.mood-dialog input[type="number"]')?.value)`);
  assert.equal(refDialogCount, 4, "More like this defaults to 4 tiles");
  await clickText(b, "Draw spread", ".mood-dialog button");
  await until(b, `document.querySelectorAll(".mood-tray-run").length === 4`, "reference More like this added 4th tray run");

  snap = await client.snapshot(CANVAS_ID);
  const fromRef = Object.values(snap.canvas.items).filter((i) => i.properties.moodParent === refItem.id);
  assert.equal(fromRef.length, 4, "4 tiles branched from reference photo");
  checks.push("Dropping a photo onto Mood sets mood=reference, and right-click -> More like this branches 4 tiles.");

  // 9. Close the first tray run and verify one Undo restores its 5 remaining candidates.
  await click(b, `[data-mood-run="${firstRunId}"] .mood-tray-head .mood-btn`);
  await until(
    b,
    `document.querySelector(${JSON.stringify(`[data-mood-run="${firstRunId}"]`)}) === null`,
    "first tray run closed",
  );
  snap = await client.snapshot(CANVAS_ID);
  const firstRunCandidatesAfterClose = Object.values(snap.canvas.items).filter(
    (i) => i.properties.moodRun === firstRunId && i.properties.mood === "candidate",
  );
  const firstRunKeptAfterClose = Object.values(snap.canvas.items).filter(
    (i) => i.properties.moodRun === firstRunId && i.properties.mood === "kept",
  );
  assert.equal(firstRunCandidatesAfterClose.length, 0, "Close tray deleted all remaining candidates in run");
  assert.equal(firstRunKeptAfterClose.length, 3, "Close tray kept the 3 kept tiles intact");

  // Trigger Undo via the Undo button in zoom controls (same door as ⌘Z).
  await click(b, '.zoom-controls button[title^="Undo"]');
  await until(
    b,
    `document.querySelectorAll(${JSON.stringify(`[data-mood-run="${firstRunId}"] .mood-tile`)}).length === 5`,
    "one Undo restored all 5 closed candidate tiles",
  );
  checks.push("Close tray removes remaining candidates in one undoable group, and one Undo restores them.");

  await screenshot(b, path.join(output, "moodboard-phase2.png"));
  assert.deepEqual(b.takeErrors(), [], "no browser runtime errors");

  // 10. Close the browser and verify CLI / client reads the exact same moodSwatches with no browser open.
  await b.close();
  const closedSnap = await client.snapshot(CANVAS_ID);
  for (const id of firstThreeIds) {
    assert.equal(
      closedSnap.canvas.items[id]?.properties.moodSwatches,
      webSwatchesByItem[id],
      `kept tile ${id} read with browser closed holds exact web moodSwatches`,
    );
  }
  checks.push("With the browser closed, reading the canvas shows the exact same moodSwatches the web wrote.");

  console.log(JSON.stringify({ ok: true, output, modelCalls: modelCalls.length, checks }, null, 2));
} catch (err) {
  const diag = await b
    .ev(`(() => {
      const target = [...document.querySelectorAll(".context-menu button")].find(e => e.textContent?.trim() === "More like this…");
      const r = target?.getBoundingClientRect();
      const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
      return {
        trayRuns: document.querySelectorAll(".mood-tray-run").length,
        trayTiles: document.querySelectorAll(".mood-tray .mood-tile").length,
        problem: document.querySelector(".mood-tray [role='alert']")?.textContent ?? null,
        dialogProblem: document.querySelector(".mood-dialog [role='alert']")?.textContent ?? null,
        busyButtons: document.querySelectorAll(".mood-tray button:disabled").length,
        menuOpen: document.querySelector(".context-menu") !== null,
        menuRect: document.querySelector(".context-menu")?.getBoundingClientRect()?.toJSON() ?? null,
        targetRect: r?.toJSON() ?? null,
        hitTag: hit ? hit.tagName + "." + hit.className : null,
      };
    })()`)
    .catch(() => null);
  await screenshot(b, path.join(output, "failure.png")).catch(() => {});
  console.error("Moodboard journey failed.", { output, modelCalls: modelCalls.length, diag, browserErrors: b.takeErrors() });
  throw err;
} finally {
  await b.close().catch(() => {});
  daemon.app.server.closeAllConnections();
  await daemon.close().catch(() => {});
  await fs.rm(output, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {});
}

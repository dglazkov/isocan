// Run after npm run build: node scripts/journey-jetski-pane.mjs
// Jetski phases 0 and 3 (docs/projects/jetski/) in an ACTUAL browser.
//
// The Isocan Canvas pane, served by its own loopback fallback, framing a
// canvas on a daemon from this checkout — the half no source-reading test can
// answer. `embed-chat.test.ts` reads that every way into the Chat is guarded;
// only a browser can say the frame really has no Chat, that ⌘J and the palette
// really lead nowhere, and that a selection made in the frame really reaches
// the pane — and the pane's pointing the frame — while a message from anybody
// else is ignored. Every press is Chrome's own input at the control's centre,
// after checking the control is what sits there.
//
// Everything is synthetic ("Acme"), on a temp home, a daemon of its own and
// ports of its own; it never touches the person's canvases. What it cannot
// reach is the host: the pane runs standalone here, so Jetski's Sidecar SDK,
// the AuxPane and the conversation beside it are walked by a person
// (docs/verify/2026-09-28-jetski-plugin.md).
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browser, until } from "./lib/browser.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = path.join(repo, "packages", "cli", "bin", "isocan.js");
const paneMain = path.join(repo, "plugins", "jetski", "sidecars", "canvas", "main.mjs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(path.join(repo, "packages", "web", "dist", "index.html"))) {
  console.error("packages/web/dist is missing — run `npm run build` first; the daemon serves the canvas from it.");
  process.exit(2);
}

const out = fs.mkdtempSync(path.join(os.tmpdir(), "isocan-jetski-pane-"));
const home = path.join(out, "home");
const app = path.join(out, "acme-app");
fs.mkdirSync(home);
fs.mkdirSync(app);
// Below the ephemeral floor, as scripts/journeys.mjs picks: the daemon polls
// its own health on a known port, so it must be told the number.
const port = 20_000 + Math.floor(Math.random() * 9_000);
const panePort = port + 7;

// Nothing of the person's: no isocan variable and no agent session survives,
// so every command below is a stranger's on a machine of its own.
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (key.startsWith("ISOCAN_") || ["ANTIGRAVITY_CONVERSATION_ID", "CLAUDE_CODE_SESSION_ID", "CODEX_THREAD_ID", "PI_SESSION_ID"].includes(key)) delete env[key];
}
Object.assign(env, {
  ISOCAN_HOME: home,
  ISOCAN_PORT: String(port),
  ISOCAN_CONTENT_PORT: String(port + 1),
  ISOCAN_BROWSER: "none",
  ISOCAN_DEFAULT_HOME: "",
});

const isocan = (...args) =>
  new Promise((resolve, reject) => {
    execFile(process.execPath, [cli, ...args], { cwd: app, env, encoding: "utf8", timeout: 60_000 }, (err, stdout, stderr) =>
      err ? reject(new Error(`isocan ${args.join(" ")}: ${stderr || err.message}`)) : resolve(stdout),
    );
  });

const results = [];
const check = (what, ok, detail = "") => {
  results.push(`${ok ? "PASS" : "FAIL"}  ${what}${detail ? ` — ${detail}` : ""}`);
  console.log(results.at(-1));
};

let b;
let pane;
let daemonUp = false;
try {
  // `serve` detaches the daemon and returns; `isocan stop` below ends it.
  await isocan("serve");
  daemonUp = true;
  await isocan("identity", "--name", "Acme Person", "--home");

  pane = spawn(process.execPath, [paneMain], { env: { ...env, ISOCAN_CLI: cli, PORT: String(panePort) }, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    let said = "";
    const deadline = setTimeout(() => reject(new Error(`the pane did not start:\n${said}`)), 20_000);
    const look = (chunk) => {
      said += chunk;
      if (said.includes("isocan pane: http")) {
        clearTimeout(deadline);
        resolve();
      }
    };
    pane.stdout.on("data", look);
    pane.stderr.on("data", look);
    pane.once("exit", (code) => reject(new Error(`the pane exited ${code}:\n${said}`)));
  });

  b = await browser();
  await b.send("Emulation.setDeviceMetricsOverride", { width: 900, height: 700, deviceScaleFactor: 1, mobile: false });

  /** Chrome's own mouse, at a point in the pane's viewport. */
  const mouse = async ({ x, y }) => {
    await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    for (const type of ["mousePressed", "mouseReleased"]) {
      await b.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mousePressed" ? 1 : 0, clickCount: 1 });
    }
  };
  /** Where a control's centre is, if a person could press it there. Runs in
   * whichever document it is evaluated in. */
  const centreOf = (selector) => `(() => {
    const e = document.querySelector(${JSON.stringify(selector)});
    if (!e) return { error: "is not there" };
    const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (!r.width || !r.height) return { error: "has no size" };
    const top = document.elementFromPoint(x, y);
    if (!(top && (e === top || e.contains(top)))) return { error: "is covered by " + (top ? top.tagName + "." + top.className : "nothing") };
    return { x, y };
  })()`;
  const press = async (selector) => {
    const at = await b.ev(centreOf(selector));
    if (at?.error) throw new Error(`${selector} ${at.error} — a person could not press it`);
    await mouse(at);
  };
  /** The frame is another origin, so its document is read through an
   * isolated world of its own — the same DOM, none of the page's script. */
  const inFrame = async (expression) => {
    const { frameTree } = await b.send("Page.getFrameTree");
    const child = frameTree.childFrames?.[0]?.frame;
    if (!child) return undefined;
    const { executionContextId } = await b.send("Page.createIsolatedWorld", { frameId: child.id, worldName: "journey" });
    const r = await b.send("Runtime.evaluate", { expression, contextId: executionContextId, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`frame probe threw: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`.split("\n")[0]);
    return r.result?.value;
  };
  const untilInFrame = async (expression, what, ms = 20_000) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (await inFrame(expression).catch(() => false)) return;
      await sleep(200);
    }
    throw new Error(`timed out waiting for ${what} in the frame`);
  };
  const pressInFrame = async (selector) => {
    const frame = await b.ev(`(() => { const f = document.getElementById("frame"), r = f.getBoundingClientRect(); return { x: r.left + f.clientLeft, y: r.top + f.clientTop }; })()`);
    const at = await inFrame(centreOf(selector));
    if (!at || at.error) throw new Error(`${selector} in the frame ${at?.error ?? "is not there"} — a person could not press it`);
    await mouse({ x: frame.x + at.x, y: frame.y + at.y });
  };
  // ⌘ on a Mac and Ctrl elsewhere: the chord a person on this machine presses.
  const MOD = process.platform === "darwin" ? 4 : 2;
  const chord = async (key, code, vk, modifiers = 0) => {
    for (const type of ["keyDown", "keyUp"]) await b.send("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: vk, modifiers });
  };
  const paletteRows = async (world, typed) => {
    await chord("k", "KeyK", 75, MOD);
    const field = `Boolean(document.querySelector(".palette-field"))`;
    if (world === "frame") await untilInFrame(field, "the palette");
    else await until(b, field, "the palette");
    await b.send("Input.insertText", { text: typed });
    await sleep(600);
    const rows = `[...document.querySelectorAll(".palette-row")].map((r) => (r.querySelector(".palette-name") ?? r).textContent.trim())`;
    const found = world === "frame" ? await inFrame(rows) : await b.ev(rows);
    await chord("Escape", "Escape", 27);
    return found ?? [];
  };
  const openChat = (rows) => rows.includes("Open Chat");

  // 1. An unbound folder: the pane offers to bind it, and Create does.
  let loaded = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: `http://127.0.0.1:${panePort}/?workspace=${encodeURIComponent(app)}` });
  await Promise.race([loaded, sleep(15_000)]);
  await until(b, `!document.getElementById("unbound").hidden`, "the unbound card", 20_000);
  check("an unbound folder shows the bind card", true);
  await press("#create");
  await until(b, `Boolean(framed && framed.origin) && document.getElementById("frame").src.includes("embed=1")`, "the framed canvas", 30_000);
  const first = await b.ev(`({ ...framed, src: document.getElementById("frame").src, open: document.getElementById("open").href })`);
  check("Create bound the folder to a new canvas and framed an embed address", fs.existsSync(path.join(app, ".isocan", "project.json")), `${first.canvasId} at ${first.origin}`);
  check("Open ↗ is the plain canvas address, no pass and no embed switch", !/embed=|#/.test(first.open), first.open);

  // 2. The frame: no Chat, the Agents door kept, the pass spent.
  await untilInFrame(`Boolean(document.querySelector(".rail-strip"))`, "the canvas rail");
  const dom = await inFrame(`({
    chatDock: Boolean(document.querySelector(".main-panel")),
    chatButton: Boolean(document.querySelector(".strip-chat:not(.strip-agents)")),
    agentsDoor: Boolean(document.querySelector(".strip-agents")),
    search: location.search,
    hash: location.hash,
  })`);
  check("framed: no Chat dock", dom?.chatDock === false, JSON.stringify(dom));
  check("framed: no Chat button on the rail", dom?.chatButton === false);
  check("framed: the Agents door stays", dom?.agentsDoor === true);
  check("framed: the pass was spent off the address", dom?.hash === "" && dom?.search === "?embed=1", `search=${dom?.search} hash=${JSON.stringify(dom?.hash)}`);

  // 3. An item from the CLI, then Reload: a fresh pass per load, and the
  // canvas fits what is on it.
  fs.writeFileSync(path.join(app, "acme-note.md"), "# Acme note\n\nA synthetic item for the journey.\n");
  const itemId = /itm_[A-Za-z0-9_-]+/.exec(await isocan("--json", "add", "acme-note.md"))?.[0];
  check("an item was added through the CLI", Boolean(itemId), itemId ?? "");
  await press("#reload");
  await until(b, `document.getElementById("frame").src !== ${JSON.stringify(first.src)} && document.getElementById("frame").src.includes("embed=1#")`, "a fresh pass for the frame", 30_000);
  const item = `[data-item-id="${itemId}"]`;
  await untilInFrame(`Boolean(document.querySelector(${JSON.stringify(item)}))`, "the item after Reload", 30_000);
  check("Reload minted a fresh pass and the canvas came back with the item", true);
  await sleep(800);

  // 4. Canvas → pane: selecting in the frame reaches the pane.
  await pressInFrame(item);
  await until(b, `selection.length === 1 && selection[0].id === ${JSON.stringify(itemId)}`, "the selection to reach the pane", 15_000).then(
    () => check("pressing the item in the frame → isocan:selection → the pane holds it", true),
    (err) => check("pressing the item in the frame → the pane holds it", false, String(err)),
  );

  // 5. Every way in to the Chat leads nowhere: ⌘J, and the palette.
  await chord("j", "KeyJ", 74, MOD);
  await sleep(500);
  check("framed: ⌘J opens no Chat", (await inFrame(`Boolean(document.querySelector(".main-panel"))`)) === false);
  const framedRows = await paletteRows("frame", "Open");
  check("framed: the palette offers the other panels but not the Chat", framedRows.includes("Open Files") && !openChat(framedRows), framedRows.slice(0, 6).join(" | "));

  // 6. Pane → canvas: Escape clears the selection (and the pane hears it);
  // the pane pointing at the item selects it again. The chips that call
  // focusItem show only inside Jetski — standalone there is nobody to Ask —
  // so the journey calls the chip's own function.
  for (let i = 0; i < 3 && (await b.ev(`selection.length`)) > 0; i++) {
    await chord("Escape", "Escape", 27);
    await sleep(400);
  }
  check("Escape in the frame clears the pane's selection too", (await b.ev(`selection.length`)) === 0);
  await b.ev(`focusItem(${JSON.stringify(itemId)}), true`);
  await until(b, `selection.length === 1 && selection[0].id === ${JSON.stringify(itemId)}`, "the focused item to come back as the selection", 15_000).then(
    () => check("isocan:focus-item from the pane → the canvas selected it → the pane holds it", true),
    (err) => check("focus-item round trip", false, String(err)),
  );

  // 7. A stranger is not believed: a selection message from the pane's own
  // window, not the frame, changes nothing.
  await b.ev(`window.postMessage({ type: "isocan:selection", canvasId: framed.canvasId, items: [] }, "*"), true`);
  await sleep(500);
  check("a selection message that did not come from the frame is ignored", (await b.ev(`selection.length`)) === 1);
  let shot = await b.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(out, "pane-framed.png"), Buffer.from(shot.data, "base64"));

  // 8. The control, so the checks above could have failed: the same canvas
  // as an ordinary tab has its Chat, and its palette offers it.
  const tab = await b.ev(`document.getElementById("open").href`);
  loaded = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: tab });
  await Promise.race([loaded, sleep(15_000)]);
  await until(b, `Boolean(document.querySelector(".main-panel") || document.querySelector(".strip-chat:not(.strip-agents)"))`, "the tab's Chat", 20_000).then(
    () => check("control: the same canvas as a tab shows its Chat", true),
    async (err) => check("control: the tab shows its Chat", false, `${err} — ${await b.ev("document.body.innerText.slice(0, 200)").catch(() => "")}`),
  );
  const tabRows = await paletteRows("tab", "Open");
  check("control: the tab's palette offers Open Chat", openChat(tabRows), tabRows.slice(0, 6).join(" | "));
  shot = await b.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(out, "tab-control.png"), Buffer.from(shot.data, "base64"));
} catch (err) {
  check("journey", false, err instanceof Error ? err.stack : String(err));
  if (b) {
    const shot = await b.send("Page.captureScreenshot", { format: "png" }).catch(() => null);
    if (shot) fs.writeFileSync(path.join(out, "failure.png"), Buffer.from(shot.data, "base64"));
  }
} finally {
  await b?.close().catch(() => {});
  pane?.kill();
  // Only ever this run's own daemon: the environment above names nothing else.
  if (daemonUp && env.ISOCAN_HOME === home) await isocan("stop").catch((err) => console.error(String(err)));
  fs.rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  fs.rmSync(app, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  fs.writeFileSync(path.join(out, "results.txt"), `${results.join("\n")}\n`);
  const failed = results.filter((r) => r.startsWith("FAIL"));
  console.log(`\n${failed.length} failed of ${results.length} — screenshots and results in ${out}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

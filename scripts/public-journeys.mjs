#!/usr/bin/env node
/**
 * Public's real browser/CLI journey. Run `npm run build` first, then
 * `node scripts/public-journeys.mjs`. Every run owns a fresh local daemon and
 * two Chrome profiles. Screenshots and request evidence remain in /tmp;
 * synthetic canvas state and credentials are removed on completion.
 */
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { ApiError, DaemonClient, DaemonRoutes, harnessVars } from "../index.mjs";
import { browser, throughTheDoor, until } from "./lib/browser.mjs";

const { startDaemon, writeBadge, adoptIdentity, fileBadgeStore } = await import("@isocan/server");
const { BADGE_COOKIE, parseBadgeToken, itemPath, VIEW_ONLY } = await import("@isocan/core");
const repo = fileURLToPath(new URL("..", import.meta.url));
assert.equal(process.argv.length, 2, "Run without arguments; this journey has no partial-proof mode.");
await fs.access(path.join(repo, "packages/web/dist/index.html")).catch(() => {
  throw new Error("Build this checkout first: npm run build");
});
const output = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-public-journeys-"));
const home = path.join(output, "home");
const clientHome = path.join(home, "client");
await fs.mkdir(clientHome, { recursive: true });
const readId = "prj_public_read_proof";
const viewId = "prj_public_view_proof";
const switchSelector = '[role="switch"][aria-label="Public on this home"]';
const content = "A synthetic published example.";
let daemon, owner, fresh, base;

async function click(b, selector) {
  await until(b, `document.querySelector(${JSON.stringify(selector)})!==null`, `control ${selector}`);
  const position = await b.ev(`(async () => {
    const e = document.querySelector(${JSON.stringify(selector)});
    e.scrollIntoView({ behavior: "instant", block: "center" });
    await new Promise(requestAnimationFrame);
    const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (!r.width || !r.height || !e.contains(document.elementFromPoint(x, y))) throw Error("covered or zero-sized control");
    return { x, y };
  })()`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await b.send("Input.dispatchMouseEvent", { type, ...position, button: "left", buttons: type === "mousePressed" ? 1 : 0, clickCount: 1 });
  }
}

async function navigate(b, url) {
  await b.send("Page.navigate", { url });
  await until(b, `location.href===${JSON.stringify(url)}&&document.readyState==="complete"`, `navigation ${url}`);
}

async function cookieOf(b) {
  const cookies = (await b.send("Network.getCookies", { urls: [base] })).cookies;
  const cookie = cookies.find((row) => row.name === BADGE_COOKIE);
  assert(cookie, "the isolated browser holds its own badge");
  return cookie;
}

async function cli(...args) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("ISOCAN_") || harnessVars.includes(key)) delete env[key];
  Object.assign(env, { ISOCAN_HOME: clientHome, ISOCAN_DIRECT: base, ISOCAN_PORT: new URL(base).port, ISOCAN_DEFAULT_HOME_URL: "" });
  const child = spawn(process.execPath, [path.join(repo, "packages/cli/bin/isocan.js"), ...args], {
    env, cwd: clientHome, stdio: ["ignore", "pipe", "pipe"], timeout: 30_000, killSignal: "SIGKILL",
  });
  let stdout = "", stderr = "";
  child.stdout.on("data", (data) => { stdout += data; });
  child.stderr.on("data", (data) => { stderr += data; });
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
  assert.equal(code, 0, `CLI ${args.join(" ")}: ${stderr}`);
  return JSON.parse(stdout);
}

// The fixture changes only the carrier. The shared API still constructs every
// daemon request, including the named browser viewer's deliberate write probe.
class BrowserClient extends DaemonRoutes {
  constructor(cookie = null) {
    super(base, fileBadgeStore(clientHome, base));
    this.fetcher = async (input, init) => {
      const headers = new Headers(init?.headers);
      headers.delete("Authorization"); headers.delete("Cookie");
      if (cookie) headers.set("Cookie", `${cookie.name}=${cookie.value}`);
      const response = await fetch(input, { ...init, headers });
      this.responseHeaders = Object.fromEntries(response.headers);
      return response;
    };
  }
}

async function screenshot(b, name) {
  const { data } = await b.send("Page.captureScreenshot", { format: "png" });
  await fs.writeFile(path.join(output, `${name}.png`), Buffer.from(data, "base64"));
}

try {
  // Force the owned fixture to stay on disk and loopback even when invoked
  // from an operator shell configured to run a hosted cloud daemon.
  process.env.ISOCAN_STORE = "file";
  daemon = await startDaemon({ port: 0, host: "127.0.0.1", home: path.join(home, "daemon"), birthHome: null, auth: null, operators: [], contentHost: "", contentPort: "off", servesWorld: true });
  base = `http://127.0.0.1:${daemon.app.server.address().port}`;
  owner = await browser(); fresh = await browser();
  await owner.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await fresh.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate(owner, `${base}/`);
  await throughTheDoor(owner, base, "Acme publisher", "public-owner");
  const actor = await owner.ev('JSON.parse(localStorage.getItem("isocan.identity"))');
  const token = parseBadgeToken((await cookieOf(owner)).value);
  assert(token, "owner browser credential parses");
  await writeBadge(clientHome, base, { ...token, at: new Date().toISOString() });
  await adoptIdentity(clientHome, actor);
  const ownerClient = new DaemonClient(base, clientHome);
  for (const [id, title] of [[readId, "Acme public reading"], [viewId, "Acme public presentation"]]) {
    await ownerClient.sendOp(null, actor, { type: "project.create", canvasId: id, title });
  }
  const fixture = path.join(clientHome, "acme-slide.md");
  await fs.writeFile(fixture, `# Acme public proof\n\n${content}`);
  for (const id of [readId, viewId]) await cli("add", fixture, "--canvas", id, "--title", "Acme public proof", "--prop", "slide=yes", "--json");
  const slide = Object.values((await ownerClient.snapshot(viewId)).canvas.items).find((item) => item.title === "Acme public proof");
  assert(slide, "the presentation fixture contains its slide");

  await navigate(owner, `${base}/p/${readId}`);
  await until(owner, 'document.body.innerText.includes("Acme public reading")', "initial editor canvas");
  await click(owner, 'button[title="Who may enter this canvas"]');
  await until(owner, `document.querySelector(${JSON.stringify(switchSelector)})!==null`, "initial publication control");
  assert.equal(await owner.ev(`document.querySelector(${JSON.stringify(switchSelector)}).disabled`), true, "Editor link cannot be published");
  await cli("share", "--canvas", readId, "--link", "read", "--json");
  await cli("share", "--canvas", viewId, "--link", "view", "--json");
  await cli("share", "--canvas", viewId, "--public", "on", "--json");
  await navigate(owner, `${base}/p/${readId}`);
  await until(owner, 'document.body.innerText.includes("Acme public reading")', "owner canvas");
  await click(owner, 'button[title="Who may enter this canvas"]');
  await click(owner, switchSelector);
  await until(owner, `document.querySelector(${JSON.stringify(switchSelector)})?.getAttribute("aria-checked")==="true"`, "accepted publication");
  await screenshot(owner, "public-share");

  const anonymous = new BrowserClient();
  const dto = await anonymous.publicCanvases();
  assert.deepEqual(await cli("canvas", "list", "--public", "--home", base, "--json"), dto.canvases);
  assert.deepEqual(dto.canvases, [
    { id: viewId, title: "Acme public presentation", home: base, capability: "view" },
    { id: readId, title: "Acme public reading", home: base, capability: "read" },
  ]);
  assert.equal(anonymous.responseHeaders["x-robots-tag"], "noindex, nofollow");
  assert.equal(anonymous.responseHeaders["cache-control"], "no-store");
  await navigate(owner, `${base}/`);
  await until(owner, 'document.querySelector("section.public-catalogue")?.innerText.includes("Acme public reading")', "named home Public section");
  await screenshot(owner, "public-named-home");
  console.log("PASS owner Share, named home, and CLI catalogue agree");

  const network = [];
  const offRequest = fresh.on("Network.requestWillBeSent", (event) => network.push({ url: event.request.url, method: event.request.method }));
  const offSocket = fresh.on("Network.webSocketCreated", (event) => network.push({ url: event.url, method: "WS" }));
  await fresh.send("Network.enable");
  await navigate(fresh, `${base}/`);
  await until(fresh, `document.querySelector(${JSON.stringify('a[href="/public"]')})!==null`, "unsigned Public entry");
  assert.equal(await fresh.ev('localStorage.getItem("isocan.identity")'), null);
  await click(fresh, 'a[href="/public"]');
  await until(fresh, 'document.body.innerText.includes("Acme public reading")&&document.body.innerText.includes("Acme public presentation")', "public rows");
  const rowSelector = `a[href="${base}/p/${readId}"]`;
  const position = await fresh.ev(`(() => {
    const e = document.querySelector(${JSON.stringify(rowSelector)}), r = e.getBoundingClientRect();
    e.focus(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  await fresh.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...position });
  for (const type of ["keyDown", "keyUp"]) await fresh.send("Input.dispatchKeyEvent", { type, key: "Tab", code: "Tab" });
  await fresh.ev("new Promise(requestAnimationFrame)");
  assert.equal(await fresh.ev('document.querySelector(".public-catalogue img,.public-catalogue iframe,.public-catalogue canvas")!==null'), false);
  assert.deepEqual(network.filter((row) => /\/api\/projects\/|\/ws\?|\/seen|\/sessions|\/thumbnail|\/blob/.test(row.url)), [], "browsing/focus/hover fetched canvas content or admission");
  assert.deepEqual(network.filter((row) => !["GET", "HEAD"].includes(row.method)), [], "browsing wrote state or opened a socket");
  assert.equal(await fresh.ev('localStorage.getItem("isocan.identity")'), null);
  const browserBadge = parseBadgeToken((await cookieOf(fresh)).value);
  assert(browserBadge);
  const held = await daemon.desk.badge(browserBadge.badgeId);
  assert.deepEqual(held.claims, [], "catalogue creates no actor claim");
  assert.deepEqual(held.admissions, [], "catalogue creates no canvas admission");
  offRequest(); offSocket();
  await fs.writeFile(path.join(output, "public-requests.json"), JSON.stringify(network, null, 2));
  await screenshot(fresh, "public-catalogue");
  for (const route of ["/public", "/public/"]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.equal(response.headers.get("cache-control"), "no-store");
    await response.arrayBuffer();
  }
  const canvasPage = await fetch(`${base}/p/${readId}`);
  assert.equal(canvasPage.status, 200);
  assert.match(canvasPage.headers.get("x-robots-tag") ?? "", /noindex/);
  await canvasPage.arrayBuffer();
  console.log("PASS unsigned browsing: no identity, canvas reads, writes, admission, or previews");

  await click(fresh, `a[href="${base}/p/${viewId}"]`);
  await until(fresh, `location.pathname===${JSON.stringify(itemPath(viewId, slide.id))}&&document.querySelector(".fullscreen")?.dataset.presentedItem===${JSON.stringify(slide.id)}&&document.querySelector(".fullscreen-stage")?.innerText.includes(${JSON.stringify(content)})`, "actual presentation content");
  assert.equal(await fresh.ev('document.querySelector(".identity-dialog,.canvas-page,textarea")!==null'), false);
  assert.equal(await fresh.ev('localStorage.getItem("isocan.identity")'), null);
  await screenshot(fresh, "public-presentation");
  await navigate(fresh, `${base}/public`);
  await until(fresh, 'document.body.innerText.includes("Acme public reading")', "catalogue returns");
  await click(fresh, rowSelector);
  await until(fresh, 'document.querySelector(".identity-dialog")!==null', "read naming door");
  await click(fresh, '.identity-dialog input[placeholder="Your name"]');
  await fresh.send("Input.insertText", { text: "Acme catalogue reader" });
  await click(fresh, '.identity-dialog button[type="submit"]');
  await until(fresh, 'document.querySelector(".canvas-page.read-only")!==null&&document.body.innerText.includes("Acme public proof")', "named read-only canvas");
  await screenshot(fresh, "public-read-viewer");
  const readerActor = await fresh.ev('JSON.parse(localStorage.getItem("isocan.identity"))');
  const reader = new BrowserClient(await cookieOf(fresh));
  const beforeWrite = await reader.snapshot(readId);
  await assert.rejects(reader.sendOp(readId, readerActor, { type: "project.update", patch: { title: "Unauthorized viewer change" } }),
    (error) => error instanceof ApiError && error.status === 403 && error.code === VIEW_ONLY);
  const afterWrite = await ownerClient.snapshot(readId);
  assert.equal(afterWrite.lastSeq, beforeWrite.lastSeq, "refused viewer write appends no operation");
  assert.deepEqual(afterWrite.project, beforeWrite.project, "refused viewer write changes no project metadata");
  assert.deepEqual(afterWrite.canvas, beforeWrite.canvas, "refused viewer write changes no canvas content");
  console.log("PASS Presentation Viewer stays unnamed; named Canvas Viewer reads and cannot write (403)");

  const beforeUnlist = await cli("share", "--canvas", readId, "--json");
  await cli("share", "--canvas", readId, "--public", "off", "--json");
  assert(!(await anonymous.publicCanvases()).canvases.some((row) => row.id === readId));
  const afterUnlist = await cli("share", "--canvas", readId, "--json");
  const linkRows = (share) => share.grants.filter((grant) => grant.subject === "link").map(({ id, capability }) => ({ id, capability }));
  assert.deepEqual(linkRows(afterUnlist), linkRows(beforeUnlist));
  assert.equal(afterUnlist.public, false);
  const knownRead = await reader.snapshot(readId);
  assert(Object.values(knownRead.canvas.items).some((item) => item.title === "Acme public proof"));
  await cli("share", "--canvas", viewId, "--link", "off", "--json");
  await cli("share", "--canvas", viewId, "--link", "view", "--json");
  assert.deepEqual(await anonymous.publicCanvases(), { canvases: [] });
  console.log("PASS unlisting keeps known-address access; off/on needs deliberate republication");
  assert.deepEqual({ owner: owner.takeErrors(), fresh: fresh.takeErrors() }, { owner: [], fresh: [] });
  console.log(`Public journeys passed. Evidence: ${output}`);
} catch (error) {
  for (const [name, b] of [["owner", owner], ["fresh", fresh]]) {
    if (!b) continue;
    await fs.writeFile(path.join(output, `${name}-failure.txt`), await b.ev("document.body.innerText.slice(-6000)").catch(() => "Browser unavailable"));
    await screenshot(b, `${name}-failure`).catch(() => {});
  }
  console.error(`Public journey failed. Evidence: ${output}`);
  throw error;
} finally {
  const closed = await Promise.allSettled([owner?.close(), fresh?.close()]);
  daemon?.app.server.closeAllConnections();
  await daemon?.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  for (const result of closed) if (result.status === "rejected") throw result.reason;
  console.log("Public fixture and owned browsers closed.");
}

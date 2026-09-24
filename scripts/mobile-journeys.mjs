#!/usr/bin/env node
/** Actual touch input, against a synthetic daemon and a fresh browser badge. */
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { browser, throughTheDoor, until } from "./lib/browser.mjs";
import { DaemonClient, connect } from "../index.mjs";
const { startDaemon } = await import("@isocan/server/daemon");
const { newCanvasId, BADGE_COOKIE, THREAD_QUERY, itemPath, deckPath, noteProperties } = await import("@isocan/core");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const home = await mkdtemp(path.join(tmpdir(), "isocan-mobile-"));
const out = process.env.MOBILE_PROOF_DIR;
if (out) await mkdir(out, { recursive: true });
const daemon = await startDaemon({ home, port: 0, contentPort: 0, auth: null, birthHome: null });
const port = daemon.app.server.address().port;
const origin = `http://127.0.0.1:${port}`;
let b = await browser();
const touch = (type, points) => b.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y, id = 1]) => ({ x, y, id })) });
async function size(width, touchEnabled = true) {
  await b.send("Emulation.setDeviceMetricsOverride", { width, height: 812, deviceScaleFactor: 1, mobile: touchEnabled });
  await b.send("Emulation.setTouchEmulationEnabled", { enabled: touchEnabled, maxTouchPoints: 5 });
}
async function tap(selector) {
  const box = await b.ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find(el=>el.getBoundingClientRect().width); if (!e) return null; const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2; return { x, y, hit: e.contains(document.elementFromPoint(x,y)) }; })()`);
  assert(box?.hit, `${selector} is reachable`);
  await touch("touchStart", [[box.x, box.y]]); await touch("touchEnd", []); await pause(200);
}
async function shot(name) { if (out) { const { data } = await b.send("Page.captureScreenshot", { format: "png" }); await writeFile(path.join(out, `${name}.png`), Buffer.from(data, "base64")); } }
try {
  process.env.ISOCAN_HOME = home;
  const client = new DaemonClient(origin, home);
  await client.claimActor({ type: "actor.claim", name: "Fixture", sessionKey: "proof:mobile" });
  const h = await connect({ port, identity: { session: "mobile", harness: "proof" } });
  const id = newCanvasId();
  await client.sendOp(null, h.actor, { type: "project.create", canvasId: id, title: "Acme mobile" });
  const canvas = await h.canvas(id);
  const first = await canvas.add({ title: "First", content: "# First\nA synthetic mobile example.", mime: "text/markdown", at: { x: 0, y: 0 }, size: { width: 300, height: 240 } });
  const priorSeq = (await client.snapshot(id)).lastSeq;
  const second = await canvas.add({ title: "Second", content: "# Second\nThe next node.", mime: "text/markdown", at: { x: 500, y: 0 }, size: { width: 300, height: 240 } });
  const pinned = await canvas.comment(first.id, "Discuss the first node here.");
  const session = await client.createSession(id, h.actor, "Synthetic agent", "proof");
  await client.updateSession(id, session.sessionId, { status: "working", activity: { kind: "working", itemId: second.id } });
  await size(375);
  const loaded = b.once("Page.loadEventFired"); await b.send("Page.navigate", { url: origin }); await loaded;
  await throughTheDoor(b, origin, "Morgan", "mobile-proof");
  const cookie = (await b.send("Network.getCookies", { urls: [origin] })).cookies.find((row) => row.name === BADGE_COOKIE);
  assert(cookie, "the synthetic browser holds its own badge");
  class BrowserBadgeClient extends DaemonClient {
    constructor() {
      super(origin, home);
      this.fetcher = (input, init) => {
        const headers = new Headers(init?.headers); headers.delete("Authorization"); headers.set("Cookie", `${cookie.name}=${cookie.value}`);
        return fetch(input, { ...init, headers });
      };
    }
  }
  const browserActor = await b.ev('JSON.parse(localStorage.getItem("isocan.identity"))');
  await new BrowserBadgeClient().markSeen(id, priorSeq, browserActor.id);
  await b.ev(`localStorage.setItem("isocan.minimap", "1"); localStorage.setItem("isocan.mainpanel.${id}", "closed"); localStorage.setItem("isocan.filespanel.${id}", "open")`);
  await b.send("Page.navigate", { url: `${origin}/p/${id}` });
  await until(b, '!!document.querySelector(".phone-face .main-panel textarea")', "Chat first");
  await until(b, '!!document.querySelector(".phone-digest [data-change-seq]")', "prior-seen digest");
  const digestSeqs = await b.ev('[...document.querySelectorAll(".phone-digest [data-change-seq]")].map(e => Number(e.dataset.changeSeq))');
  assert(digestSeqs.every(seq => seq > priorSeq), "digest starts after prior mark");
  assert(digestSeqs.includes(priorSeq+1), "visit did not erase the preceding insertion");
  await shot("phone-digest");
  const navigationHead = (await client.snapshot(id)).lastSeq;
  await tap('.phone-digest button'); await until(b, '!!document.querySelector(".phone-sheet")', "digest conversation link");
  await tap('[aria-label="Close conversation"]');
  await tap('.phone-digest > div:last-child button');
  assert.equal(await b.ev('document.querySelector(".phone-node").dataset.nodeId'), second.id, "digest item link");
  assert.equal((await client.snapshot(id)).lastSeq, navigationHead, "navigation writes no operation");
  await tap('.phone-tabs button:nth-child(1)');
  await tap(".phone-face .main-panel textarea"); await b.send("Input.insertText", { text: "A real phone question" });
  await tap(".phone-face .main-panel button[type=submit]");
  await until(b, 'document.querySelector(".phone-face .main-msgs").textContent.includes("A real phone question")', "posted Chat");
  assert(Object.values((await client.snapshot(id)).canvas.threads).some(t => t.comments.some(c => c.body === "A real phone question")), "UI comment reaches daemon");
  await tap(".phone-face .main-panel textarea"); await b.send("Input.insertText", { text: "An unsent draft" }); await shot("phone-chat");
  await tap('.phone-tabs button:nth-child(2)');
  await until(b, '!!document.querySelector(".phone-node")', "node face");
  await tap(".edge-left");
  assert.equal(await b.ev('document.querySelector(".phone-node").dataset.nodeId'), first.id);
  await touch("touchStart", [[290, 320]]); await touch("touchMove", [[70, 320]]); await touch("touchEnd", []);
  await until(b, `document.querySelector(".phone-node")?.dataset.nodeId === ${JSON.stringify(second.id)}`, "node text swipe reaches next node");
  await touch("touchStart", [[70, 320]]); await touch("touchMove", [[290, 320]]); await touch("touchEnd", []);
  await until(b, `document.querySelector(".phone-node")?.dataset.nodeId === ${JSON.stringify(first.id)}`, "node text swipe returns");
  await tap('.edge-right'); assert.equal(await b.ev('document.querySelector(".phone-node").dataset.nodeId'), second.id);
  assert.equal(await b.ev('document.querySelector(".edge-right").disabled'), true, "dead edge has no destination");
  await tap('.edge-left');
  await tap('.phone-thread-toggle'); await until(b, 'document.querySelector(".phone-sheet").textContent.includes("Discuss the first")', "current-node thread"); await shot("phone-thread");
  await tap('[aria-label="Close conversation"]');
  await touch("touchStart", [[120, 140], [220, 140, 2]]); await touch("touchMove", [[80, 140], [260, 140, 2]]); await touch("touchEnd", []);
  await until(b, '!!document.querySelector(".phone-current-node")', "pinch-out marked plan");
  assert.equal(await b.ev('document.querySelector(".canvas-viewport").dataset.currentNode'), first.id);
  await shot("phone-plan");
  await tap(`.phone-plan [data-item-id="${second.id}"]`);
  assert.equal(await b.ev('document.querySelector(".phone-node").dataset.nodeId'), second.id, "plan tap enters node");
  await tap('.phone-node-bar button');
  await until(b, '!!document.querySelector(".world")', "the canvas plan");
  const rail = await b.ev('[...document.querySelectorAll(".tool-rail button")].filter(e=>e.getBoundingClientRect().width).map(e=>({name:e.getAttribute("aria-label"),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))');
  assert.deepEqual(rail.map((x) => x.name), ["Hand", "Comment", "More tools"]);
  assert(rail.every((x) => x.w >= 44 && x.h >= 44), "44px primary controls");
  await tap('[aria-label="More tools"]'); await until(b, 'document.querySelector(".phone-face .tool-rail").classList.contains("tools-expanded")', "expanded tools");
  await tap('[aria-label="More tools"]');
  const viewport = () => b.ev('document.querySelector(".world").style.transform');
  const before = await viewport();
  await touch("touchStart", [[100, 620]]); await touch("touchMove", [[140, 660]]); await touch("touchMove", [[150, 670]]); await touch("touchEnd", []);
  assert.notEqual(await viewport(), before, "one finger pans");
  await pause(650); assert.equal(await b.ev('!!document.querySelector(".context-menu")'), false, "motion cancels long press");
  const prePinch = await viewport();
  await touch("touchStart", [[100, 600], [180, 600, 2]]); await touch("touchMove", [[60, 600], [220, 600, 2]]); await touch("touchEnd", []);
  assert.notEqual(await viewport(), prePinch, "two fingers pinch");
  await pause(650); assert.equal(await b.ev('!!document.querySelector(".context-menu")'), false, "second touch cancels long press");
  await touch("touchStart", [[100, 620]]); await pause(700);
  await until(b, '!!document.querySelector(".context-menu")', "stationary long press menu");
  await touch("touchEnd", []); await shot("touch-controls");
  await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", windowsVirtualKeyCode: 27 });
  await tap('.phone-return');
  await tap('.phone-tabs button:nth-child(3)'); await until(b, '!!document.querySelector(".phone-agents .wb-row")', "agent roster");
  await shot("phone-agents");
  await tap('.phone-agents .wb-row-head'); await until(b, '!!document.querySelector(".phone-agents .wb-thumb")', "agent stage link");
  await tap('.phone-agents .wb-thumb'); assert.equal(await b.ev('document.querySelector(".phone-node").dataset.nodeId'), second.id);
  await tap('.phone-tabs button:nth-child(1)'); assert.equal(await b.ev('document.querySelector(".phone-face textarea").value'), "An unsent draft");
  await size(768); await until(b, '!!document.querySelector(".world")', "desktop restoration"); await shot("desktop-restored");
  assert.equal(await b.ev(`localStorage.getItem("isocan.mainpanel.${id}")`), "closed", "resize does not rewrite desktop Chat preference");
  assert.equal(await b.ev(`localStorage.getItem("isocan.filespanel.${id}")`), "open", "desktop Files preference survives");
  assert.equal(await b.ev('localStorage.getItem("isocan.minimap")'), "1");
  const tablet = await viewport(); await touch("touchStart", [[550, 650]]); await touch("touchMove", [[610, 650]]); await touch("touchEnd", []); assert.notEqual(await viewport(), tablet, "tablet touch pans");
  await size(375, false);
  await until(b, '!!document.querySelector(".phone-tabs")', "phone resize");
  await tap('.phone-tabs button:nth-child(2)'); await tap('.phone-node-bar button');
  await until(b, '!!document.querySelector(".world")', "narrow mouse plan");
  const mouseBefore = await viewport();
  await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: 100, y: 620, button: "left", buttons: 1, clickCount: 1 });
  await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 160, y: 680, button: "left", buttons: 1 });
  await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 160, y: 680, button: "left", buttons: 0, clickCount: 1 });
  assert.notEqual(await viewport(), mouseBefore, "mouse can pan the phone plan without moving an item");
  assert.deepEqual(b.takeErrors(), []);
  await client.createGrant(id, "link", "read", h.actor.id);
  await b.close(); b = await browser(); await size(375);
  const readLoad = b.once("Page.loadEventFired"); await b.send("Page.navigate", { url: origin }); await readLoad;
  await throughTheDoor(b, origin, "Reader", "mobile-reader"); await b.send("Page.navigate", { url: `${origin}/p/${id}` });
  await until(b, '!!document.querySelector(".phone-face .main-panel")', "read admission Chat");
  assert.equal(await b.ev('!!document.querySelector(".phone-face textarea")'), false, "reader has no composer");
  await tap('.phone-tabs button:nth-child(2)'); await tap('.phone-thread-toggle');
  assert.equal(await b.ev('!!document.querySelector(".phone-sheet form, .phone-sheet .thread-actions")'), false, "reader thread has no writes");
  await shot("phone-read-only");
  await b.send("Page.navigate", { url: `${origin}/p/${id}?${new URLSearchParams({ [THREAD_QUERY]: pinned.threadId })}` });
  await until(b, 'document.querySelector(".phone-sheet")?.textContent.includes("Discuss the first")', "addressed conversation opens phone sheet");
  const mainThread = Object.values((await client.snapshot(id)).canvas.threads).find(t => t.main);
  await b.send("Page.navigate", { url: `${origin}/p/${id}?${new URLSearchParams({ [THREAD_QUERY]: mainThread.id })}` });
  await until(b, 'document.activeElement === document.querySelector(".phone-face .main-scroll")', "addressed main conversation focuses Chat");
  await canvas.edit(second.id, { content: "# Second\n\n" + Array.from({ length: 40 }, (_, n) => `Paragraph ${n+1}: the reader scrolls this synthetic long slide.`).join("\n\n") });
  // Presentation proof uses a third slide to catch accidental double advancement.
  const third = await canvas.add({ title: "Third", mime: "text/html", content: `<!doctype html><button style="position:absolute;left:10px;top:10px;width:120px;height:60px" onclick="this.textContent='Pressed'">Press me</button>`, at: { x: 1000, y: 0 } });
  for (const slide of [first, second, third]) await canvas.set(slide.id, { properties: { slide: "yes" } });
  await canvas.add({ title: "First notes", mime: "text/markdown", content: "Remember the synthetic example.", properties: noteProperties(first.id) });
  async function presentation(label) {
    await b.send("Page.navigate", { url: origin + itemPath(id, first.id) });
    const current = () => b.ev('document.querySelector(".fullscreen")?.dataset.presentedItem');
    await until(b, `document.querySelector(".fullscreen")?.dataset.presentedItem === ${JSON.stringify(first.id)}`, `${label} presentation`);
    await until(b, 'document.querySelector(".fullscreen-stage")?.textContent.includes("A synthetic mobile")', `${label} content`);
    const prefs = await b.ev('JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.includes("presenterNotes") || k.includes("stage"))))');
    await touch("touchStart", [[40, 400]]); await touch("touchEnd", []); await pause(200);
    assert.equal(await current(), first.id, `${label} first boundary`);
    await touch("touchStart", [[330, 400]]); await touch("touchEnd", []);
    await until(b, `document.querySelector(".fullscreen")?.dataset.presentedItem === ${JSON.stringify(second.id)}`, `${label} right-third tap`);
    await until(b, 'document.querySelector(".present-position")?.textContent === "2 / 3"', `${label} deck position follows the tap`);
    // The bar keeps no slot for an Inbox the slide covers, so the title has room to be read.
    assert.equal(await b.ev('(() => { const e = document.querySelector(".navigation-inbox"); if (!e) return false; const r = e.getBoundingClientRect(); return !!r.width && e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })()'), false, `${label} no Inbox reachable over a presentation`);
    assert(await b.ev('document.querySelector(".mobile-presentation-bar strong").getBoundingClientRect().width') >= 80, `${label} title has room`);
    await touch("touchStart", [[40, 400]]); await touch("touchEnd", []);
    await until(b, `document.querySelector(".fullscreen")?.dataset.presentedItem === ${JSON.stringify(first.id)}`, `${label} left-third tap`);
    await touch("touchStart", [[290, 400]]); await touch("touchMove", [[170, 400]]); await touch("touchMove", [[70, 400]]); await touch("touchEnd", []); await pause(250);
    assert.equal(await current(), second.id, `${label} swipe advances exactly once`);
    await until(b, 'document.querySelector(".fullscreen-stage .md-view")?.scrollHeight > document.querySelector(".fullscreen-stage .md-view")?.clientHeight', `${label} long slide loaded`);
    await touch("touchStart", [[180, 450]]); await touch("touchMove", [[180, 350]]); await touch("touchEnd", []); await pause(250);
    assert.equal(await current(), second.id, `${label} vertical gesture does not flip`);
    assert(await b.ev('document.querySelector(".fullscreen-stage .md-view").scrollTop > 0'), `${label} vertical touch actually scrolls text`);
    await touch("touchStart", [[330, 400]]); await touch("touchEnd", []);
    await until(b, `document.querySelector(".fullscreen")?.dataset.presentedItem === ${JSON.stringify(third.id)}`, `${label} third slide`);
    await until(b, '!!document.querySelector(".fullscreen-stage iframe")', `${label} interactive frame`);
    const frameTree = await b.send("Page.getFrameTree");
    const frame = frameTree.frameTree.childFrames?.find(f => f.frame.url.includes(third.versions[0].blobHash));
    assert(frame, `${label} content frame exists`);
    const { executionContextId } = await b.send("Page.createIsolatedWorld", { frameId: frame.frame.id });
    const frameValue = async(expression) => (await b.send("Runtime.evaluate", { expression, contextId: executionContextId, returnByValue: true })).result.value;
    await until({ ev: frameValue }, '!!document.querySelector("button")', `${label} frame loaded`);
    const frameRect = await b.ev('(() => {const r=document.querySelector(".fullscreen-stage iframe").getBoundingClientRect();return {x:r.x,y:r.y};})()');
    await touch("touchStart", [[frameRect.x+70, frameRect.y+40]]); await touch("touchEnd", []);
    await until({ ev: frameValue }, 'document.querySelector("button").textContent === "Pressed"', `${label} frame owns touch`);
    assert.equal(await current(), third.id, `${label} iframe touch does not flip`);
    await shot(`${label}-presentation`);
    await b.send("Page.navigate", { url: origin + itemPath(id, first.id) });
    await until(b, '!!document.querySelector(".mobile-presentation-bar")', `${label} notes controls`);
    await tap('.mobile-presentation-bar button[aria-pressed]');
    await until(b, 'document.querySelector(".presentation-notes-sheet")?.textContent.includes("Remember the synthetic")', `${label} readable notes`);
    await shot(`${label}-notes`);
    await tap('[aria-label="Close speaker notes"]');
    assert.equal(await current(), first.id, `${label} closing notes preserves slide`);
    // N on an attached keyboard opens the same sheet, and closes it again.
    for (const open of [true, false]) {
      await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "n", code: "KeyN", text: "n", windowsVirtualKeyCode: 78 });
      await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "n", code: "KeyN", windowsVirtualKeyCode: 78 });
      await until(b, `!!document.querySelector(".presentation-notes-sheet") === ${open}`, `${label} N ${open ? "opens" : "closes"} the notes`);
    }
    // The browser's own chrome goes too, where the platform allows it, and
    // Exit leaves browser full screen on the way out.
    assert.equal(await b.ev("document.fullscreenEnabled"), true, `${label} headless Chrome offers the Fullscreen API`);
    await tap('[aria-label="Full screen"]');
    await until(b, "document.fullscreenElement === document.documentElement", `${label} slide takes the whole screen`);
    await shot(`${label}-glass`);
    assert.equal(await b.ev('JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.includes("presenterNotes") || k.includes("stage"))))'), prefs, `${label} desktop presentation preferences unchanged`);
    await tap('[aria-label="Exit presentation"]');
    await until(b, '!document.querySelector(".fullscreen")', `${label} Back exits`);
    await until(b, "document.fullscreenElement === null", `${label} Back leaves browser full screen`);
    assert.deepEqual(b.takeErrors(), []);
  }
  await presentation("fullscreen");
  await b.send("Page.navigate", { url: origin + deckPath(id) });
  await until(b, 'document.querySelectorAll(".deck-sheet").length === 3', "print deck still renders all slides");
  await client.createGrant(id, "link", "view", h.actor.id);
  await b.close(); b = await browser(); await size(375);
  await presentation("viewer");
  console.log("PASS mobile: stage 0 touch; stage 1a Chat, node walk, draft, plan, agents, capability and desktop restoration; stage 1c prior-seen digest and conversation links; stage 2 FullScreen/Viewer taps, swipe, deck position, boundaries, vertical gesture, iframe, notes by button and N, browser full screen, exit and print deck");
} finally {
  await b.close(); await daemon.close();
  await rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

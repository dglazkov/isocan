#!/usr/bin/env node
/**
 * **Journeys: the app, driven, doing what a person does.**
 *
 * The suite is 2,300 source-scanning guards and they are good at one thing —
 * *this decision is still written down.* They are structurally blind to
 * *this screen is broken*, and one day proved it four times over:
 *
 * - the new canvas's card never scrolled into view; the guard passed
 * - ⌘Enter appeared to add nothing; every test green
 * - the Personas panel's header collapsed to `display: block`; 2,200 green
 * - the reducer stopped stamping the canvas — **the entire suite still passed**
 *
 * Each was found by opening the app and using it. This is that, on a cadence,
 * so it stops depending on somebody happening to look.
 *
 *   node scripts/journeys.mjs              # all of them
 *   node scripts/journeys.mjs --only pen   # one, by name
 *   node scripts/journeys.mjs --json       # the detail, for a person
 *   node scripts/journeys.mjs --failing    # one integer, for a persona's goal
 *   node scripts/journeys.mjs --selftest   # prove a journey can fail
 *
 * **It boots its own daemon on its own port with its own temp home**, so it
 * never touches anybody's canvases and two runs cannot collide. `port: 0` is
 * atomic — the daemon picks and reports; nothing here guesses a port, which is
 * a bug this repo has already paid for twice.
 *
 * **What it must never assert.** A headless page throttles `requestAnimationFrame`
 * and background timers, so smooth scrolling is a no-op and a 90ms interval
 * fires at ~400ms. Two findings on the day this was written looked like bugs
 * and were the harness. So journeys assert on STATE — what is in the DOM, what
 * the server holds — never on an animation having visibly run. A checker that
 * cannot tell its own limits from a defect generates confident nonsense.
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browser, throughTheDoor } from "./lib/browser.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const cli = path.join(repo, "packages/cli/bin/isocan.js");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
};
const asJson = argv.includes("--json");

/** Wait for a condition in the page, or fail saying what never became true. */
async function until(b, expression, what, ms = 8000) {
  const deadline = Date.now() + ms;
  for (;;) {
    if (await b.ev(expression)) return;
    if (Date.now() > deadline) throw new Error(`never became true: ${what}`);
    await sleep(100);
  }
}

/**
 * A daemon of this run's own, and a browser that has been through the door.
 *
 * The identity is claimed through the API and written to `localStorage` under
 * the key the app reads, because every journey starts signed in — the door
 * itself has its own journey and does not belong in the middle of the others.
 */
/**
 * **A port this run picks, and retries when it loses.**
 *
 * `ISOCAN_PORT=0` is not available: the daemon polls its own health on a known
 * port before reporting ready, so it must be told the number — the same
 * constraint `managed.ts` has, and the reason that file's `freePort` guesses
 * too. A guess has a real race, so this does what `smokeTest` does about it:
 * tries again. Below the ephemeral floor on both platforms (32768 on Linux,
 * 49152 on macOS), so nothing the OS hands out can land on top of it.
 */
const pickPort = () => 20_000 + Math.floor(Math.random() * 9_000);

async function startDaemon(home, attempt = 0) {
  const port = pickPort();
  const proc = spawn(process.execPath, [cli, "serve"], {
    env: {
      ...process.env,
      ISOCAN_HOME: home,
      ISOCAN_PORT: String(port),
      ISOCAN_CONTENT_PORT: String(port + 1),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  try {
    const origin = await new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error(`daemon did not start:\n${out}`)), 30_000);
      const look = (chunk) => {
        out += chunk.toString();
        if (out.includes(`http://127.0.0.1:${port}`) && /started|running/i.test(out)) {
          clearTimeout(deadline);
          resolve(`http://127.0.0.1:${port}`);
        }
      };
      proc.stdout.on("data", look);
      proc.stderr.on("data", look);
      proc.once("exit", (code) => {
        clearTimeout(deadline);
        reject(new Error(`daemon exited (${code}):\n${out}`));
      });
    });
    return { proc, origin };
  } catch (err) {
    proc.kill();
    // Only a lost port is retried. A daemon that will not boot for any other
    // reason must say so rather than be tried four more times.
    const raced = /EADDRINUSE|did not come up|already/i.test(String(err));
    if (raced && attempt < 3) return startDaemon(home, attempt + 1);
    throw err;
  }
}

async function rig() {
  const home = mkdtempSync(path.join(tmpdir(), "isocan-journeys-"));
  const { proc, origin } = await startDaemon(home);

  const b = await browser();
  /**
   * **Arm the load listener BEFORE navigating**, and wait for the document
   * rather than for a duration. `Page.navigate` resolves when navigation
   * STARTS; evaluating against a page that is still `about:blank` makes a
   * relative `fetch("/api/door")` fail with "Failed to fetch" — which reads as
   * a daemon that is down and is nothing of the kind. `grade.mjs` learned the
   * same lesson and its `once` exists for exactly this.
   */
  const loaded = b.once("Page.loadEventFired");
  await b.send("Page.navigate", { url: origin });
  await Promise.race([loaded, sleep(15_000)]);
  // One door-crossing, shared with the canvas screenshot (`lib/browser.mjs`).
  await throughTheDoor(b, origin, "Journey", "journeys");
    /**
   * **A real click, on whatever is actually on top at that point.**
   *
   * `element.click()` is not this. It fires the handler directly and
   * bypasses hit-testing entirely, so it succeeds on a control covered by an
   * overlay, sized to zero, or under `pointer-events: none` — a journey
   * built on it cannot tell "this works" from "this is there but nobody can
   * press it", which is a whole class of interface bug.
   *
   * So: find the control, take its centre (or the requested point), check the
   * browser agrees that point belongs to it, and press THERE. When it does not agree, the thing
   * on top is named in the failure, because "the button did not respond" and
   * "something is sitting over the button" are different bugs.
   */
  const rigClick = async (selector, what = selector, point = { x: 0.5, y: 0.5 }) => {
    const box = await b.ev(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return { zero: true };
      const x = Math.round(r.left + r.width * ${point.x}), y = Math.round(r.top + r.height * ${point.y});
      const top = document.elementFromPoint(x, y);
      /* Containment one way only: the point may land on a CHILD of the
         target, and a button's inner glyph is not an obstruction.

         The reverse test was here too and was exactly backwards — an ancestor
         always contains its descendant, so a full-page overlay on the body
         satisfied it and every covered control passed. Found by covering the
         whole page and watching the journey fail somewhere else instead: the
         check that proves a checker works has to be RUN, not assumed.
         (No backticks in here: this comment lives inside a template literal,
          and the first one closed it.) */
      return { x, y, hit: el === top || el.contains(top),
               over: top ? (top.className?.toString?.() || top.tagName) : "nothing" };
    })()`);
    if (!box) throw new Error(`no ${what} to press`);
    if (box.zero) throw new Error(`${what} has no size — nothing to press`);
    if (!box.hit) throw new Error(`${what} is covered by ${box.over} — a person could not press it`);
    await b.send("Input.dispatchMouseEvent", {
      type: "mousePressed", x: box.x, y: box.y, button: "left", buttons: 1, clickCount: 1,
    });
    await b.send("Input.dispatchMouseEvent", {
      type: "mouseReleased", x: box.x, y: box.y, button: "left", buttons: 0, clickCount: 1,
    });
    await sleep(250);
  };

  return {
    origin,
    home,
    b,
    click: rigClick,
    /**
     * The same real press, on the first element matching `selector` whose text
     * starts with `text` — menus and rosters have no stable selector of their
     * own, and finding by the words a person reads is closer to what they do
     * than counting children.
     */
    clickText: async (selector, text, what = `"${text}"`) => {
      const mark = await b.ev(`(() => {
        const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
          .find(e => e.textContent.trim().startsWith(${JSON.stringify(text)}));
        if (!el) return null;
        el.setAttribute("data-journey-target", "1");
        return true;
      })()`);
      if (!mark) throw new Error(`no ${what} to press`);
      try {
        await rigClick("[data-journey-target]", what);
      } finally {
        await b.ev(`(() => { document.querySelector("[data-journey-target]")?.removeAttribute("data-journey-target"); return true; })()`);
      }
    },
    /**
     * Arm a tool by its accessible name, with a real press, and insist it
     * actually armed. A rail button that renders and does not select is the
     * exact failure `.click()` cannot see.
     */
    clickTool: async (label) => {
      const sel = `.tool-btn[aria-label="${label}"]`;
      await rigClick(sel, `the ${label} tool`);
      await until(
        b,
        `/active|on/.test(document.querySelector(${JSON.stringify(sel)})?.className ?? "")`,
        `the ${label} tool to arm`,
        4000,
      );
    },
    /** Type, key by key, through the browser's own keyboard pipeline. */
    type: async (text) => {
      for (const ch of text) {
        await b.send("Input.dispatchKeyEvent", { type: "keyDown", text: ch });
        await b.send("Input.dispatchKeyEvent", { type: "keyUp" });
      }
    },
    /** A modifier chord — ⌘Enter and friends, as the browser delivers them. */
    press: async (key, { meta = false } = {}) => {
      const codes = {
        Enter: { windowsVirtualKeyCode: 13, key: "Enter", text: "\r" },
        k: { windowsVirtualKeyCode: 75, key: "k", code: "KeyK" },
        o: { windowsVirtualKeyCode: 79, key: "o", code: "KeyO" },
        Delete: { windowsVirtualKeyCode: 46, key: "Delete", code: "Delete" },
      };
      const k = codes[key];
      if (!k) throw new Error(`journeys cannot press ${key} yet`);
      const mods = meta ? 4 : 0;
      await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", modifiers: mods, ...k });
      await b.send("Input.dispatchKeyEvent", { type: "keyUp", modifiers: mods, ...k });
      await sleep(600);
    },
    /**
     * Select all in the focused editor. CodeMirror binds Mod-a, which is ⌘ on a
     * Mac and Ctrl everywhere else — and the nightly runs on Linux, where ⌘A
     * selects nothing and the next insertText lands at the caret, splicing the
     * new document into the middle of the old one. The browser runs on this
     * machine, so this machine's platform is the editor's.
     */
    selectAll: async () => {
      const k = { windowsVirtualKeyCode: 65, key: "a", code: "KeyA" };
      const modifiers = process.platform === "darwin" ? 4 : 2;
      await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", modifiers, ...k });
      await b.send("Input.dispatchKeyEvent", { type: "keyUp", modifiers, ...k });
    },
    /**
     * A key held DOWN, with the release handed back — the gesture a tap is
     * not. T and H are tap-to-latch, hold-to-borrow, and since 4a758df6 a held
     * T that placed something keeps itself, so the hold has to be a real one:
     * down, something else happens, then up. `rawKeyDown` carries no text, so
     * nothing is typed while the key is down.
     */
    hold: async (key) => {
      const codes = { t: { windowsVirtualKeyCode: 84, key: "t", code: "KeyT" } };
      const k = codes[key];
      if (!k) throw new Error(`journeys cannot hold ${key} yet`);
      await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...k });
      return async () => {
        await b.send("Input.dispatchKeyEvent", { type: "keyUp", ...k });
      };
    },
    /**
     * A press, some moves and a release, through Chrome's own input pipeline.
     * `Input.dispatchMouseEvent` produces trusted events with a real active
     * pointer — the thing a synthetic `PointerEvent` cannot be.
     */
    stroke: async (points) => {
      const [first, ...rest] = points;
      await b.send("Input.dispatchMouseEvent", {
        type: "mousePressed", x: first[0], y: first[1], button: "left", buttons: 1, clickCount: 1,
      });
      for (const [x, y] of rest) {
        await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "left", buttons: 1 });
        await sleep(30);
      }
      const last = points[points.length - 1];
      await b.send("Input.dispatchMouseEvent", {
        type: "mouseReleased", x: last[0], y: last[1], button: "left", buttons: 0, clickCount: 1,
      });
    },
    go: async (route = "/") => {
      await b.send("Page.navigate", { url: origin + route });
      await sleep(900);
    },
    close: async () => {
      await b.close();
      proc.kill();
      await new Promise((r) => {
        proc.once("exit", r);
        setTimeout(r, 3000);
      });
      rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    },
  };
}

/** Make a canvas through the app's own Create form, and land on it. */
async function makeCanvas(rig, title) {
  await rig.go("/");
  await until(rig.b, `!!document.querySelector(".canvas-card.create input")`, "the Create form");
  await rig.b.ev(`(() => {
    const i = document.querySelector(".canvas-card.create input");
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(i, ${JSON.stringify(title)});
    i.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
  await rig.click(".canvas-card.create button[type=submit]", "the Create button");
  await until(
    rig.b,
    `[...document.querySelectorAll(".canvas-card h3")].some(h => h.textContent === ${JSON.stringify(title)})`,
    `the canvas "${title}" to appear in the list`,
  );
  const id = await rig.b.ev(`(() => {
    const h = [...document.querySelectorAll(".canvas-card h3")].find(h => h.textContent === ${JSON.stringify(title)});
    return h.closest("a").getAttribute("href").split("/").pop();
  })()`);
  await rig.go(`/p/${id}`);
  await until(rig.b, `!!document.querySelector(".world")`, "the canvas to open");
  return id;
}

/**
 * **How much of a quiet canvas's time may be spent working.**
 *
 * Zero is the honest answer and an unusable bound: a real page has a stray
 * timer, a font settling, a store notification. Measured on the fixed build,
 * a canvas at rest reads 0% over six seconds, headless and hosted alike; the
 * loop this exists to catch read 32%. Fifteen leaves room for noise and still
 * catches anything looping.
 *
 * Raising it is one line with a reason, the same rule as the bundle ceiling —
 * but note which way that rule runs here: a bound that drifts up is a canvas
 * that has quietly got busier, which is the thing itself.
 */
const IDLE_BOUND = 15;

export const JOURNEYS = [
  {
    name: "design-contract",
    what: "governing recipes and reasoned exceptions are visible; a policy edit refreshes findings, Undo restores it, and HTML repair preserves policy",
    async run(rig) {
      const { b } = rig;
      await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
      const id = await makeCanvas(rig, "Acme design contract");
      const reason = 'Acme #1 needs room for its "two-line" label.';
      const extension = { lint: { version: 1, literals: "require-references", recipes: { Button: { owns: { padding: "{spacing.md}", "border-radius": "{rounded.card}" }, allow: [], treatments: { compact: { padding: "{spacing.sm}" } } } }, exceptions: { "hero-spacing": { recipe: "Button", properties: ["padding"], reason } } } };
      const design = `---\nname: Acme contract\nisocan: ${JSON.stringify(extension)}\ncolors:\n  ink: "#112233"\nspacing:\n  md: 16px\n  sm: 8px\ntypography:\n  body:\n    fontSize: 16px\nrounded:\n  card: 8px\n---\n## Usage\nSynthetic contract fixture.\n`;
      const html = '<style>:root{--radius-card:8px}</style><button data-isocan-recipe="Button" data-isocan-treatment="compact" data-isocan-exception="hero-spacing" style="padding:16px;border-radius:8px">Acme contract</button>';
      const repaired = html.replace("border-radius:8px", "border-radius:var(--radius-card)");
      const designFile = path.join(rig.home, "DESIGN.md"), htmlFile = path.join(rig.home, "acme-contract.html");
      writeFileSync(designFile, design); writeFileSync(htmlFile, html);
      const runCli = (...args) => { const out = execFileSync(process.execPath, [cli, "--json", ...args], { cwd: rig.home, encoding: "utf8", env: { ...process.env, ISOCAN_HOME: rig.home, ISOCAN_PORT: new URL(rig.origin).port, ISOCAN_SESSION_ID: "acme-contract-journey", ISOCAN_HARNESS: "test" } }); return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out; };
      runCli("identity", "--session", "--name", "Acme Contract CLI");
      runCli("--canvas", id, "design", "set", designFile);
      const added = runCli("--canvas", id, "add", htmlFile, "--title", "Acme contract screen");
      const audit = () => runCli("--canvas", id, "design", "audit", "--item", added.itemId).items[0];
      const initial = audit();
      const same = (actual, expected, label) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`); };
      const tokens = runCli("--canvas", id, "design", "--tokens");
      same(tokens.$extensions?.["io.isocan"]?.isocan, extension, "DTCG exported contract");
      const css = runCli("--canvas", id, "design", "--css");
      if (typeof css !== "string" || !css.includes("not preserved")) throw new Error("CSS export omitted its contract conversion note");
      const tokenFile = path.join(rig.home, "acme-tokens.json"), cssFile = path.join(rig.home, "acme-tokens.css");
      writeFileSync(tokenFile, JSON.stringify(tokens)); writeFileSync(cssFile, css);
      const imported = runCli("--canvas", id, "design", "import", tokenFile, "--dry-run");
      if (!imported.markdown.includes(JSON.stringify(extension))) throw new Error("DTCG import dry run lost the native extension");
      const cssImport = runCli("--canvas", id, "design", "import", cssFile, "--dry-run");
      if (!cssImport.notes?.some(note => /polic|contract/i.test(note))) throw new Error("CSS import omitted its contract conversion note");
      same(initial.diagnostics.map(({ code, property, actual }) => ({ code, property, actual })), [{ code: "design/reference-required", property: "border-radius", actual: "8px" }], "strict contract's seeded reference finding");
      same(initial.policy.effective.literals, "require-references", "CLI initial policy");
      same(initial.policy.appliedExceptions[0].reason, reason, "CLI active exception reason");
      const snapshot = async () => (await b.ev(`fetch('/api/projects/${id}/canvas', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json())`)).canvas;
      const readItem = async item => { const hash = item.versions.find(v => v.id === item.currentVersionId).blobHash; return b.ev(`fetch('/api/projects/${id}/blobs/${hash}').then(r => r.text())`); };
      const openScreen = async () => { await rig.go(`/p/${id}/w/${added.itemId}`); await until(b, `!!document.querySelector('.stage-editor') || !!document.querySelector('button[title="Open the editor"]')`, "screen editor access"); if (!await b.ev(`!!document.querySelector('.stage-editor')`)) await rig.click('button[title="Open the editor"]'); await until(b, `!!document.querySelector('[data-design-policy]')`, "effective contract report"); };
      const replaceEditor = async text => { await rig.click(".cm-content", "document editor"); await rig.selectAll(); await b.send("Input.insertText", { text }); };
      await openScreen();
      same(await b.ev(`document.querySelector('[data-design-policy]').dataset.designLiterals`), initial.policy.effective.literals, "CLI/browser literal policy");
      same(await b.ev(`[...document.querySelectorAll('[data-design-code]')].map(el => el.dataset.designCode)`), initial.diagnostics.map(one => one.code), "CLI/browser contract findings");
      same(await b.ev(`document.querySelector('[data-design-code="design/reference-required"] > p').textContent`), initial.diagnostics[0].explanation, "browser reference requirement explanation");
      if (!await b.ev(`document.querySelector('.design-lint-source').textContent.includes(${JSON.stringify(initial.governing.versionId)})`)) throw new Error("initial governing version missing from browser report");
      if (!await b.ev(`document.querySelector('[data-design-exception="hero-spacing"]')?.textContent.includes(${JSON.stringify(reason)})`)) throw new Error("active exception reason missing in browser");
      if (!await b.ev(`!!document.querySelector('[data-design-treatment="compact"]')`)) throw new Error("active treatment missing in browser");
      await b.ev(`document.querySelector('.design-lint-contract summary').scrollIntoView({block:'center'})`);
      await rig.click(".design-lint-contract summary", "effective recipe details");
      if (!await b.ev(`document.querySelector('.design-lint-contract').textContent.includes('padding: {spacing.md}')`)) throw new Error("owned declaration not inspectable");
      const screenshot = path.join(tmpdir(), `isocan-design-contract-${Date.now()}.png`);
      writeFileSync(screenshot, Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
      await b.ev(`document.querySelector('.design-lint-provenance a').scrollIntoView({block:'center'})`);
      await rig.click(".design-lint-provenance a", "governing document link");
      await until(b, `location.pathname.includes(${JSON.stringify(initial.governing.itemId)})`, "governing workbench");
      await until(b, `!!document.querySelector('.cm-content') || !!document.querySelector('button[title="Open the editor"]')`, "governing editor access");
      if (!await b.ev(`!!document.querySelector('.cm-content')`)) await rig.click('button[title="Open the editor"]');
      await until(b, `!!document.querySelector('.cm-content')`, "governing document editor");
      const relaxed = design.replace('"require-references"', '"allow"');
      await replaceEditor(relaxed);
      await rig.clickText(".stage-editor-bar button", "Save version");
      await until(b, `fetch('/api/projects/${id}/canvas', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json()).then(r => r.canvas.items[${JSON.stringify(initial.governing.itemId)}].currentVersionId !== ${JSON.stringify(initial.governing.versionId)})`, "ordinary policy version saved");
      const changed = (await snapshot()).items[initial.governing.itemId];
      same(await readItem(changed), relaxed, "saved governing bytes");
      await openScreen();
      await until(b, `document.querySelector('[data-design-policy]')?.dataset.designLiterals === 'allow' && document.querySelector('.design-lint-summary')?.dataset.designFindings === '0'`, "policy edit refreshed findings");
      const relaxedAudit = audit();
      same(relaxedAudit.diagnostics, [], "CLI refreshed contract findings");
      same(relaxedAudit.governing.versionId, changed.currentVersionId, "CLI changed governing version");
      if (!await b.ev(`document.querySelector('.design-lint-source').textContent.includes(${JSON.stringify(changed.currentVersionId)})`)) throw new Error("browser did not report changed governing version");
      await rig.go(`/p/${id}`);
      await until(b, `!!document.querySelector('.zoom-controls')`, "canvas Undo controls");
      await rig.click('button[title="Undo (⌘Z)"]', "governing document Undo");
      await until(b, `fetch('/api/projects/${id}/canvas', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json()).then(r => r.canvas.items[${JSON.stringify(initial.governing.itemId)}].currentVersionId === ${JSON.stringify(initial.governing.versionId)})`, "policy Undo restored version");
      const restoredPolicy = (await snapshot()).items[initial.governing.itemId];
      same(await readItem(restoredPolicy), design, "Undo restored policy bytes");
      await openScreen();
      await until(b, `document.querySelector('[data-design-policy]')?.dataset.designLiterals === 'require-references' && document.querySelector('.design-lint-summary')?.dataset.designFindings === '${initial.diagnostics.length}'`, "Undo restored strict findings");
      const undoneAudit = audit();
      same(undoneAudit.policy, initial.policy, "Undo restored complete effective policy and active reasons");
      same(undoneAudit.diagnostics, initial.diagnostics, "Undo restored exact reference findings");
      same(undoneAudit.governing, initial.governing, "Undo restored governing provenance");
      same(await b.ev(`document.querySelector('[data-design-code="design/reference-required"] > p').textContent`), initial.diagnostics[0].explanation, "Undo restored browser explanation");
      if (!await b.ev(`document.querySelector('.design-lint-source').textContent.includes(${JSON.stringify(initial.governing.versionId)})`)) throw new Error("Undo did not restore browser governing version");
      await replaceEditor(repaired);
      await until(b, `document.querySelector('.design-lint-summary')?.dataset.designFindings === '0'`, "authored HTML repair check");
      await rig.clickText(".design-lint button", "Save repair");
      await until(b, `document.querySelector('.design-lint-receipt')?.textContent.includes('Repair saved as one operation')`, "HTML repair accepted");
      const after = await snapshot();
      same(after.items[initial.governing.itemId], restoredPolicy, "HTML repair kept governing version stack");
      same(await readItem(after.items[initial.governing.itemId]), design, "HTML repair kept governing bytes");
      same(await readItem(after.items[added.itemId]), repaired, "HTML repair stored authored bytes");
      return { screenshot, policy: initial.policy.effective, governing: initial.governing, activeExceptionReason: reason, findingsBefore: initial.diagnostics.length, findingsAfterPolicyEdit: 0, policyUndo: true, htmlRepairPreservedPolicy: true };
    },
  },
  {
    name: "design-lint",
    what: "CLI and browser findings agree; source selection, one-version repair, undo and stale refusal preserve edits",
    async run(rig) {
      await rig.b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      const id = await makeCanvas(rig, "Acme design lint");
      const { b } = rig;
      const bad = '<p style="color:var(--missing);padding:13px">A prose #ff0000</p>';
      const good = '<p style="color:#112233;padding:16px">A prose #ff0000</p>';
      const newer = good.replace("A prose", "Acme newer");
      const htmlFile = path.join(rig.home, "acme-screen.html");
      const designFile = path.join(rig.home, "DESIGN.md");
      const newerFile = path.join(rig.home, "acme-newer.html");
      writeFileSync(htmlFile, bad);
      writeFileSync(newerFile, newer);
      writeFileSync(designFile, '---\nname: Acme system\ncolors:\n  ink: "#112233"\nspacing:\n  md: 16px\ntypography:\n  body:\n    fontSize: 16px\nrounded:\n  card: 8px\n---\n## Usage\nSynthetic fixture.\n');
      const runCli = (...args) => { const out = execFileSync(process.execPath, [cli, "--json", ...args], {
        cwd: rig.home, encoding: "utf8", env: { ...process.env, ISOCAN_HOME: rig.home,
          ISOCAN_PORT: new URL(rig.origin).port, ISOCAN_SESSION_ID: "acme-lint-journey", ISOCAN_HARNESS: "test" },
      }); return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out; };
      runCli("identity", "--session", "--name", "Acme Lint CLI");
      runCli("--canvas", id, "design", "set", designFile);
      const added = runCli("--canvas", id, "add", htmlFile, "--title", "Acme CLI screen");
      const cliAudit = runCli("--canvas", id, "design", "audit").items.find(item => item.itemId === added.itemId);
      const expected = ["design/missing-variable", "design/off-scale-spacing"];
      const same = (actual, wanted, label) => { if (JSON.stringify(actual) !== JSON.stringify(wanted)) throw new Error(`${label}: ${JSON.stringify(actual)} != ${JSON.stringify(wanted)}`); };
      same(cliAudit?.diagnostics.map(f => f.code), expected, "the CLI's two seeded findings");
      const snapshot = async () => { const result = await b.ev(`fetch('/api/projects/${id}/canvas', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json())`); if (!result?.canvas) throw new Error(`snapshot response: ${JSON.stringify(result)}`); return result.canvas; };
      const beforeAdd = Object.keys((await snapshot()).items);
      // The native chooser is opened through real UI controls, then receives
      // a filesystem selection through CDP (never a synthetic element.click).
      await rig.press("k", { meta: true });
      await until(b, `!!document.querySelector('.palette')`, "launcher");
      await rig.type("Add");
      await rig.clickText(".palette-row", "Add…");
      await until(b, `!!document.querySelector('.add-kinds')`, "Add kinds");
      await b.send("Page.setInterceptFileChooserDialog", { enabled: true });
      const chosen = b.once("Page.fileChooserOpened");
      await rig.clickText(".add-kind", "Files");
      const chooser = await Promise.race([chosen, sleep(5000).then(() => { throw new Error("native file picker did not open"); })]);
      await b.send("DOM.setFileInputFiles", { files: [htmlFile], backendNodeId: chooser.backendNodeId });
      await until(b, `fetch('/api/projects/${id}/canvas', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json()).then(r => Object.keys(r.canvas.items).some(id => !${JSON.stringify(beforeAdd)}.includes(id)))`, "browser HTML upload");
      const webItem = Object.values((await snapshot()).items).find(item => !beforeAdd.includes(item.id));
      const original = webItem.currentVersionId;
      await rig.go(`/p/${id}/w/${webItem.id}`);
      await until(b, `!!document.querySelector('.stage-preview-toolbar') || !!document.querySelector('.stage-editor')`, "HTML workbench");
      if (!await b.ev(`!!document.querySelector('.stage-editor')`)) await rig.clickText("button", "Design check");
      await until(b, `document.querySelector('.design-lint-summary')?.dataset.designFindings === '2'`, "browser's two seeded findings");
      const screenshot = path.join(tmpdir(), `isocan-design-lint-${Date.now()}.png`);
      writeFileSync(screenshot, Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
      const webCodes = await b.ev(`[...document.querySelectorAll('[data-design-code]')].map(el => el.dataset.designCode)`);
      same(webCodes, expected, "browser seeded findings");
      same(webCodes, cliAudit.diagnostics.map(f => f.code), "CLI/browser findings");
      const webLocations = await b.ev(`[...document.querySelectorAll('[data-design-code] .design-lint-location')].map(el => el.textContent.trim())`);
      same(webLocations, cliAudit.diagnostics.map(f => `Line ${f.range.start.line}:${f.range.start.column} · ${f.actual}`), "CLI/browser actual values and source positions");
      if (!await b.ev(`document.querySelector('.design-lint-source').textContent.includes(${JSON.stringify(cliAudit.input.sha256)})`)) throw new Error("browser checked hash differs from CLI bytes");
      const suggestions = '[data-design-code="design/off-scale-spacing"] details summary';
      await b.ev(`document.querySelector(${JSON.stringify(suggestions)}).scrollIntoView({block:'center'})`);
      await rig.click(suggestions, "spacing repair suggestions");
      if (!await b.ev(`document.querySelector('[data-design-code="design/off-scale-spacing"] details[open]')?.textContent.includes('isocan design --css')`)) throw new Error("missing CSS declaration prerequisite is not reachable");
      await rig.click(suggestions, "close spacing suggestions");
      const location = '[data-design-code="design/off-scale-spacing"] .design-lint-location';
      await b.ev(`document.querySelector(${JSON.stringify(location)}).scrollIntoView({block:'center'})`);
      await rig.click(location, "spacing finding source");
      const selected = await b.ev(`window.getSelection().toString()`);
      same(selected, "13px", "selected source text");
      await b.send("Input.insertText", { text: "16px" });
      await until(b, `document.querySelector('.design-lint-summary')?.dataset.designFindings === '1'`, "spacing draft recheck");
      await b.ev(`document.querySelector('[data-design-code="design/missing-variable"] .design-lint-location').scrollIntoView({block:'center'})`);
      await rig.click('[data-design-code="design/missing-variable"] .design-lint-location', "missing variable source");
      same(await b.ev(`window.getSelection().toString()`), "var(--missing)", "missing variable selection");
      await b.send("Input.insertText", { text: "#112233" });
      await until(b, `document.querySelector('.design-lint-summary')?.dataset.designFindings === '0'`, "repaired draft check");
      await rig.clickText(".design-lint button", "Save repair");
      await until(b, `document.querySelector('.design-lint-receipt')?.textContent.includes('Repair saved as one operation')`, "accepted repair receipt");
      let item = (await snapshot()).items[webItem.id];
      same(item.versions.length, webItem.versions.length + 1, "repair version count");
      const savedVersion = item.currentVersionId;
      const readItem = async current => {
        const hash = current.versions.find(v => v.id === current.currentVersionId).blobHash;
        return b.ev(`fetch('/api/projects/${id}/blobs/${hash}').then(r => r.text())`);
      };
      same(await readItem(item), good, "accepted repaired bytes");
      await rig.go(`/p/${id}`);
      await until(b, `!!document.querySelector('.zoom-controls')`, "canvas undo controls");
      await rig.click('button[title="Undo (⌘Z)"]', "canvas version Undo");
      await until(b, `fetch('/api/projects/${id}/canvas', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json()).then(r => r.canvas.items['${webItem.id}'].currentVersionId === '${original}')`, "repair undo");
      same(await readItem((await snapshot()).items[webItem.id]), bad, "undo restored original bytes");
      await rig.go(`/p/${id}/w/${webItem.id}`);
      await until(b, `!!document.querySelector('.cm-content')`, "editor after undo");
      // An accepted repair is done: a second one starts from inputs a person
      // re-reviewed, not from the first repair's capture (cdcf22d3).
      await until(b, `[...document.querySelectorAll('.design-lint button')].some(el => el.textContent === 'Review current repair inputs' && !el.disabled)`, "review current repair inputs");
      await rig.clickText(".design-lint button", "Review current repair inputs");
      await until(b, `[...document.querySelectorAll('.design-lint button')].some(el => el.textContent.startsWith('I reviewed these inputs'))`, "reviewed inputs");
      await b.ev(`[...document.querySelectorAll('.design-lint button')].find(el => el.textContent.startsWith('I reviewed these inputs')).scrollIntoView({block:'center'})`);
      await rig.clickText(".design-lint button", "I reviewed these inputs; retain my edits");
      await until(b, `document.querySelector('.design-lint-receipt')?.textContent.includes('Current inputs explicitly reviewed')`, "fresh repair capture");
      await rig.click(".cm-content", "HTML editor");
      await rig.selectAll();
      await b.send("Input.insertText", { text: good });
      await until(b, `document.querySelector('.design-lint-summary')?.dataset.designFindings === '0'`, "new repair draft");
      runCli("--canvas", id, "edit", webItem.id, newerFile);
      await until(b, `document.querySelector('.stage-editor-note')?.textContent.includes('landed')`, "concurrent version arrival");
      await until(b, `[...document.querySelectorAll('.design-lint button')].some(el => el.textContent === 'Save repair' && !el.disabled)`, "fresh draft report retaining opened base");
      const concurrent = (await snapshot()).items[webItem.id];
      await rig.clickText(".design-lint button", "Save repair");
      await until(b, `document.querySelector('.design-lint-receipt')?.textContent.includes('Repair refused')`, "stale repair refusal");
      item = (await snapshot()).items[webItem.id];
      same(item.currentVersionId, concurrent.currentVersionId, "stale repair kept concurrent version");
      same(item.versions.length, concurrent.versions.length, "stale repair added no version");
      same(await readItem(item), newer, "stale repair kept newer bytes");
      same(await b.ev(`document.querySelector('.cm-content').textContent`), good, "stale repair kept editor draft");
      if (!await b.ev(`!!document.querySelector('.stage-editor-dirty')`)) throw new Error("stale draft lost its unsaved label");
      // Hold the actual upload while typing continues. Normal Save still
      // stacks a version, and confirmation may clean only submitted bytes.
      await b.send("Fetch.enable", { patterns: [{ urlPattern: `*/api/projects/${id}/blobs`, requestStage: "Request" }] });
      const uploadPaused = b.once("Fetch.requestPaused");
      await rig.clickText(".stage-editor-bar button", "Save version");
      const upload = await Promise.race([uploadPaused, sleep(5000).then(() => { throw new Error("normal save did not upload"); })]);
      const laterDraft = `${good}<!-- typed during upload -->`;
      await rig.click(".cm-content", "editable source during upload");
      await rig.selectAll();
      await b.send("Input.insertText", { text: laterDraft });
      await b.send("Fetch.continueRequest", { requestId: upload.requestId });
      await b.send("Fetch.disable");
      await until(b, `[...document.querySelectorAll('.stage-editor-bar button')].some(el => el.textContent === 'Save version' && !el.disabled)`, "normal save accepted while later draft remains");
      const stacked = (await snapshot()).items[webItem.id];
      same(stacked.versions.length, concurrent.versions.length + 1, "normal save retained concurrent stack");
      same(await readItem(stacked), good, "normal save stored captured bytes");
      same(await b.ev(`document.querySelector('.cm-content').textContent`), laterDraft, "typing during save preserved");
      if (!await b.ev(`!!document.querySelector('.stage-editor-dirty')`)) throw new Error("accepted save incorrectly cleaned newer typing");
      // Inject a home refusal at the transport boundary, with the real UI
      // still producing its ordinary item.addVersion operation.
      await b.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/ops", requestStage: "Request" }] });
      const writePaused = b.once("Fetch.requestPaused");
      await rig.clickText(".stage-editor-bar button", "Save version");
      const write = await Promise.race([writePaused, sleep(5000).then(() => { throw new Error("normal save did not submit an operation"); })]);
      same(JSON.parse(write.request.postData).op.type, "item.addVersion", "normal save operation");
      await b.send("Fetch.fulfillRequest", { requestId: write.requestId, responseCode: 403, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from(JSON.stringify({ error: "Acme save refused", code: "test-refused" })).toString("base64") });
      await b.send("Fetch.disable");
      await until(b, `document.body.innerText.includes('Acme save refused')`, "normal save refusal notice");
      same((await snapshot()).items[webItem.id].currentVersionId, stacked.currentVersionId, "refused save kept stored version");
      same(await b.ev(`document.querySelector('.cm-content').textContent`), laterDraft, "refused save kept draft");
      if (!await b.ev(`!!document.querySelector('.stage-editor-dirty')`)) throw new Error("refused save cleaned the draft");
      return { screenshot, seededFindings: webCodes, selectedSource: selected, repairVersions: 1, savedVersion, undo: true, staleRefused: true, draftPreserved: true, normalSaveKeepsTyping: true, refusedNormalSaveKeepsDraft: true };
    },
  },
  {
    name: "idle-at-rest",
    /**
     * **The bug this exists for cost two days and two firefights.**
     *
     * `useCommands` returned a fresh array on every call; `useCanvasTools` had
     * it in an effect's dependency list, and the effect ended in `setTools`.
     * Render → new array → deps look changed → effect → setState → render,
     * forever, on **every open canvas from the moment it loaded** (6 Sep 2026,
     * `lessons.md` #36). Every isocan tab sat at 76-117% CPU for two days. The
     * whole suite was green throughout, because nothing anywhere asked the one
     * question a person would: *is it doing anything?*
     *
     * A canvas nobody is touching should be doing nothing. That is the number,
     * and it is the journeys persona's first standing one.
     *
     * ## It proves its own instrument, every run
     *
     * The measurement is only meaningful if it can say no, and a profiler that
     * reports "quiet" because it is broken looks exactly like a quiet page —
     * `lessons.md` #8 and #14, twice paid for. So this measures a second time
     * with a spinner deliberately burning the main thread, and fails if THAT
     * reads quiet too. A run that passes has shown the instrument working on
     * the machine it just ran on.
     */
    what: "a canvas nobody is touching burns no CPU — and the profiler can tell",
    async run(rig) {
      await makeCanvas(rig, "A quiet canvas");

      const busy = async (seconds) => {
        await rig.b.send("Profiler.enable");
        await rig.b.send("Profiler.setSamplingInterval", { interval: 200 });
        await rig.b.send("Profiler.start");
        await new Promise((r) => setTimeout(r, seconds * 1000));
        const profile = (await rig.b.send("Profiler.stop"))?.profile;
        if (!profile) throw new Error("the profiler handed back nothing — the instrument is broken");
        let idle = 0;
        let total = 0;
        for (const node of profile.nodes) {
          const hits = node.hitCount || 0;
          total += hits;
          if (node.callFrame.functionName === "(idle)") idle += hits;
        }
        if (total === 0) throw new Error("the profiler took no samples — the instrument is broken");
        return Math.round(((total - idle) / total) * 100);
      };

      const atRest = await busy(4);
      if (atRest > IDLE_BOUND) {
        throw new Error(
          `a canvas with nobody touching it spent ${atRest}% of 4s working, past ${IDLE_BOUND}%.\n` +
            `  Something is rendering in a loop. Profile it: the 6 Sep cause was a hook returning\n` +
            `  a fresh array into an effect's dependency list (lessons.md #36), and the profile\n` +
            `  named React's render loop with no app function above 2%.`,
        );
      }

      // Now make it busy on purpose. If this reads quiet, the reading above
      // meant nothing — which is the failure mode that let the real loop run
      // for two days behind a green suite.
      await rig.b.ev(`(() => {
        window.__spin = true;
        const burn = () => {
          const until = performance.now() + 8;
          while (performance.now() < until) { /* hold the thread */ }
          if (window.__spin) requestAnimationFrame(burn);
        };
        requestAnimationFrame(burn);
        return true;
      })()`);
      const spinning = await busy(3);
      await rig.b.ev(`(() => { window.__spin = false; return true; })()`);
      if (spinning <= IDLE_BOUND) {
        throw new Error(
          `the profiler read ${spinning}% while the page was deliberately burning the main thread.\n` +
            `  The instrument cannot see, so the ${atRest}% above is not evidence of anything.`,
        );
      }
    },
  },
  {
    name: "make-a-canvas",
    /** The bug: `Create` looked like a button that did nothing, because the
     *  list sorted oldest-first and the new card landed off the bottom. */
    what: "a new canvas appears, is marked, and the field clears",
    async run(rig) {
      await makeCanvas(rig, "A journey canvas");
      await rig.go("/");
      const seen = await rig.b.ev(`(() => ({
        titled: [...document.querySelectorAll(".canvas-card h3")].map(h => h.textContent),
        field: document.querySelector(".canvas-card.create input").value,
      }))()`);
      if (!seen.titled.includes("A journey canvas")) throw new Error("the canvas is not listed");
      if (seen.field !== "") throw new Error("the Create field kept its text");
    },
  },
  {
    name: "card-says-what-happened",
    /** The bug: the card showed a date that only moved on a RENAME, so a
     *  canvas worked on all week reported when it was last retitled. */
    what: "the home screen names the last act, not just a date",
    async run(rig) {
      const id = await makeCanvas(rig, "Says what happened");
      await addText(rig, "hello from a journey");
      await rig.go("/");
      const meta = await rig.b.ev(`(() => {
        const h = [...document.querySelectorAll(".canvas-card h3")].find(h => h.textContent === "Says what happened");
        return h.closest(".canvas-card").querySelector(".meta")?.innerText ?? "";
      })()`);
      if (/did something/.test(meta)) throw new Error(`the card cannot name the act: ${meta}`);
      if (!/added something|edited something/.test(meta)) {
        throw new Error(`the card does not say what happened: ${meta}`);
      }
      void id;
    },
  },
  {
    name: "text-tool",
    /**
     * The bug: ⌘Enter appeared to add nothing, because the write had no
     * local echo and the socket was dead.
     *
     * And the tool's two endings, which this journey got wrong for three
     * nights. `4a758df6` (8 Sep 2026) gave T's two gestures two endings on
     * purpose — "when you click away it switches to the select tool UNLESS
     * the user was holding down the T key": a CLICKED T puts one node down and
     * hands itself back to Select, a HELD T means "several" and stays. The
     * journey still asserted the old ending, so it failed 9, 10 and 11 Sep
     * with "the Text tool did not stay selected" — reporting the requested
     * behaviour as a bug, under a workflow that stayed green. Both endings
     * are asserted now, each with a real gesture.
     */
    what: "⌘Enter puts typed text on the canvas; a clicked T places one, a held T keeps going",
    async run(rig) {
      await makeCanvas(rig, "Text journey");
      const items = () => rig.b.ev(`document.querySelectorAll(".item").length`);
      const armed = (label) =>
        rig.b.ev(
          `[...document.querySelectorAll(".tool-btn")].some(b => b.getAttribute("aria-label") === ${JSON.stringify(label)} && /active|on/.test(b.className))`,
        );

      // Clicked: one note, then the tool hands itself back.
      const before = await items();
      await addText(rig, "a typed note");
      if ((await items()) <= before) throw new Error("⌘Enter added nothing to the canvas");
      if (await armed("Text")) throw new Error("a clicked Text tool stayed selected after placing one note");
      if (!(await armed("Select"))) throw new Error("a clicked Text tool did not hand back to Select");

      // Held: T down, a real press on empty canvas, T up — the intent is read
      // at the press, so the release can come before the typing, as it does
      // for a person (nobody types with T held down).
      const release = await rig.hold("t");
      try {
        await until(
          rig.b,
          `/active|on/.test(document.querySelector('.tool-btn[aria-label="Text"]')?.className ?? "")`,
          "holding T to arm the Text tool",
          4000,
        );
        await sleep(400); // past HOLD_MS (250), so the release reads as a hold
        await rig.stroke([[460, 380]]);
        await until(rig.b, `!!document.querySelector(".text-composer textarea")`, "the composer, opened with T held");
      } finally {
        await release();
      }
      const mid = await items();
      await rig.type("and another");
      await until(
        rig.b,
        `document.querySelector(".text-composer textarea")?.value === "and another"`,
        "the typed words to reach the composer",
      );
      await rig.press("Enter", { meta: true });
      await sleep(900);
      if ((await items()) <= mid) throw new Error("⌘Enter with T held added nothing to the canvas");
      if (!(await armed("Text"))) throw new Error("a held Text tool did not stay selected after placing a note");
    },
  },
  {
    name: "pen",
    /**
     * Reported as "pressing on the Pen tool crashes the system". A crash in a
     * React tree is not a failed assertion anywhere — the page simply stops —
     * so this watches for a thrown exception and for the canvas still being
     * on screen, which is what "crashed" actually looks like from outside.
     */
    what: "the Pen tool selects, draws, and throws nothing",
    async run(rig) {
      await makeCanvas(rig, "Pen journey");
      rig.b.takeErrors();
      await rig.clickTool("Pen");
      const armed = await rig.b.ev(
        `[...document.querySelectorAll(".tool-btn")].some(b => b.getAttribute("aria-label") === "Pen" && /active|on/.test(b.className))`,
      );
      if (!armed) throw new Error("the Pen tool did not arm");
      /**
       * **Real input, not synthesised events.**
       *
       * A hand-made `new PointerEvent(...)` is untrusted and creates no active
       * pointer, so the app's `setPointerCapture` throws `NotFoundError` — and
       * that is the HARNESS, not the Pen. A journeys runner that cannot tell
       * its own limits from a defect generates confident nonsense, so it
       * drives the browser's own input pipeline instead and gets a genuine
       * pointer, genuine capture, and a genuine answer.
       */
      await rig.stroke([
        [300, 300],
        [336, 318],
        [372, 336],
        [400, 350],
      ]);
      await sleep(900);
      const errors = rig.b.takeErrors();
      if (errors.length > 0) throw new Error(`the Pen threw: ${errors[0]}`);
      const alive = await rig.b.ev(`!!document.querySelector(".world") && !!document.querySelector(".tool-rail")`);
      if (!alive) throw new Error("the canvas is gone — the page stopped rendering");
    },
  },
  {
    name: "bench-join",
    /**
     * **The bench, phase 1 — journey 2, walked.**
     *
     * The phase's proof is a sentence no source-scanning guard can check:
     * *join an agent from the panel on a canvas whose rc is not running, and
     * read the roster back from the CLI.* Nothing is parked anywhere in this
     * journey — that is the point. Naming an agent you already own is not the
     * same act as introducing a stranger, and until this phase the app made
     * them the same act ("no rc, no button"), which is why bringing an agent
     * to its fifth canvas was as hard as bringing it to its first.
     *
     * Both halves are here because the claim spans both surfaces: the click
     * happens in the panel, and the terminal is asked afterwards what it can
     * see. A person at the browser and a person in the terminal have to be
     * the same person for a bench to mean anything, so the CLI is given the
     * identity the door handed the page.
     */
    what: "an agent joins from the agents panel with no rc parked, and the terminal reads it back",
    async run(rig) {
      const runCli = (...args) =>
        execFileSync(process.execPath, [cli, ...args], {
          cwd: rig.home,
          encoding: "utf8",
          env: { ...process.env, ISOCAN_HOME: rig.home, ISOCAN_PORT: new URL(rig.origin).port },
        });

      /**
       * **One person, two surfaces** — and the terminal goes first.
       *
       * A bench belongs to an actor, so the panel is only showing anything if
       * the page is the same person who benched. The honest way to make that
       * true is the product's own: the terminal holds the identity, mints a
       * pass, and the browser redeems it and arrives BEING them. Claiming the
       * page's actor from the terminal instead is refused, correctly — a
       * badge may not speak for somebody another surface still speaks as.
       */
      writeFileSync(
        path.join(rig.home, "identity.json"),
        JSON.stringify({ id: "usr_bench_theo", name: "Theo", createdAt: new Date().toISOString() }),
      );

      // Percy is a RECORD: an actor this machine has never run, benched by
      // name. Nothing is enrolled and nothing is parked.
      runCli("bench", "add", "Percy", "--actor", "usr_journey_percy", "--harness", "pi");
      const id = JSON.parse(runCli("--json", "canvas", "create", "Bench journey")).canvasId;
      const { address } = JSON.parse(runCli("--json", "--canvas", id, "pass"));

      await rig.b.ev(`(() => { localStorage.clear(); return true; })()`);
      await rig.b.send("Page.navigate", { url: address });
      await sleep(2500);
      await until(rig.b, `!!document.querySelector(".world")`, "the canvas to open for Theo");
      const who = await rig.b.ev(`(JSON.parse(localStorage.getItem("isocan.identity") ?? "{}")).id ?? ""`);
      if (who !== "usr_bench_theo") throw new Error(`the pass did not land the page as Theo (it is ${who || "nobody"})`);

      await rig.click('button[aria-label="More"]', "the ··· menu");
      await until(
        rig.b,
        `[...document.querySelectorAll(".menu-entry,[role=menuitem],.ctx-entry")].some(e => e.textContent.trim().startsWith("Agents"))`,
        "the ··· menu to offer Agents",
      );
      await rig.clickText(".menu-entry,[role=menuitem],.ctx-entry", "Agents", "the Agents entry");
      await until(rig.b, `!!document.querySelector(".tray-bench .bench-row")`, "your bench in the agents panel");

      // The refusal that matters, before the click: the row says whether
      // anything could answer, in the words the terminal uses. An enrolment
      // that cannot answer yet is legitimate; one that pretends it can is the
      // bug, so this sentence has to be on the row rather than in a
      // disappointment afterwards.
      const said = await rig.b.ev(`(document.querySelector(".tray-bench .bench-reach")?.textContent ?? "").trim()`);
      if (!said) throw new Error("the bench row says nothing about whether anything could answer");

      // And it is above Add an agent… — which is absent entirely here,
      // because no rc is parked. That absence is the whole phase: the Join
      // must not inherit the stranger gate.
      const order = await rig.b.ev(`(() => {
        const panel = document.querySelector(".agents-panel");
        const bench = panel?.querySelector(".tray-bench");
        const add = panel?.querySelector(".add-agent");
        if (!bench) return { missing: true };
        return { above: !add || (bench.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
                 addShown: !!add };
      })()`);
      if (order.missing) throw new Error("the agents panel has no bench section");
      if (!order.above) throw new Error("your bench is below Add an agent…, not above it");

      await rig.click(".tray-bench .tray-bench-join", "Percy's Join");
      await until(
        rig.b,
        `[...document.querySelectorAll(".agents-body")].some(b => b.textContent.includes("Percy"))`,
        "Percy to appear in the roster on this canvas",
      );

      // Read back from the terminal — the other surface, asked independently.
      const roster = JSON.parse(runCli("--json", "--canvas", id, "who"));
      const standing = (roster.standing ?? []).map((row) => row.actor.name);
      if (!standing.includes("Percy")) {
        throw new Error(`the terminal does not see Percy standing here: ${JSON.stringify(roster.standing)}`);
      }

      // And joining conferred nothing else: nothing is parked (no rc was ever
      // started), and no turn was started — the canvas has no conversation.
      const bench = JSON.parse(runCli("--json", "bench"));
      const row = bench.bench.find((one) => one.name === "Percy");
      if (!row) throw new Error("Percy fell off the bench");
      if (row.reach === "ready") throw new Error("nothing is parked, yet the bench reads ready");
      if (!row.standing.some((one) => one.canvasId === id)) {
        throw new Error("the bench does not show Percy standing on the canvas just joined");
      }
      const errors = rig.b.takeErrors();
      if (errors.length > 0) throw new Error(`the panel threw on Join: ${errors[0]}`);
    },
  },
  {
    name: "panels",
    /** The bug: the Personas panel's header collapsed to `display: block` and
     *  its icon sat on its own title, while every test passed. */
    what: "every dock panel opens with a laid-out header",
    async run(rig) {
      await makeCanvas(rig, "Panel journey");
      for (const name of ["Chat", "Files", "Agents", "Context", "Personas"]) {
        await rig.click('button[aria-label="More"]', "the ··· menu");
        await rig.clickText(".menu-entry,[role=menuitem],.ctx-entry", name, `the ${name} entry`);
        await sleep(600);
        const head = await rig.b.ev(`(() => {
          const h = document.querySelector(".panel-head");
          if (!h) return null;
          const c = getComputedStyle(h);
          const g = h.querySelector(".panel-glyph"), t = h.querySelector("b");
          if (!g || !t) return { display: c.display, gap: c.gap, missing: true };
          return { display: c.display, gap: c.gap, padding: c.padding,
                   between: Math.round(t.getBoundingClientRect().left - g.getBoundingClientRect().right),
                   title: t.textContent };
        })()`);
        if (!head) throw new Error(`${name} opened without a panel header`);
        if (head.missing) throw new Error(`${name}'s header has no glyph or no name`);
        if (head.display !== "flex") throw new Error(`${name}'s header is ${head.display}, not a flex row`);
        if (!(head.between > 0)) {
          throw new Error(`${name}'s glyph and title are touching (${head.between}px apart)`);
        }
      }
    },
  },
  {
    name: "delete-is-immediate",
    /**
     * Reported as: "I selected a screen, hit delete, nothing happened. I did
     * it again. Then I reloaded and it was gone."
     *
     * The cause was a write with no local echo, so the item stayed until the
     * home's broadcast arrived — invisible on a fast connection, which is why
     * it shipped. So this journey does not test delete; it tests delete WITH
     * THE POST STALLED, because a gesture that only works when the network is
     * quick is the bug wearing a disguise.
     */
    what: "a delete leaves the screen at once, even when the home is slow",
    async run(rig) {
      await makeCanvas(rig, "Delete journey");
      await addText(rig, "about to be deleted");
      await until(rig.b, `document.querySelectorAll(".item").length === 1`, "one item to delete");
      /* The small note's centre belongs to its Read / select text button.
         Press its exposed lower-left frame instead: selecting and entering
         are different gestures. The old centre click entered the note and
         failed before it ever tested deletion (13 Sep 2026). */
      await rig.type("v");
      await until(rig.b, `!!document.querySelector('.tool-btn.active[aria-label="Select"]')`, "the Select tool");
      await rig.click(".item", "the item's lower-left frame", { x: 0.03, y: 0.9 });
      await until(rig.b, `document.querySelectorAll(".item.selected").length === 1`, "a selection");
      // Hold the op POST for longer than anybody would wait.
      await rig.b.ev(`(() => {
        const real = window.fetch;
        window.__realFetch = real;
        window.__heldOpPosts = 0;
        window.fetch = async (...a) => {
          const url = typeof a[0] === "string" ? a[0] : a[0]?.url;
          if (String(url).endsWith("/api/ops") && a[1]?.method === "POST") {
            window.__heldOpPosts++;
            await new Promise(r => setTimeout(r, 9000));
            window.__heldOpPosts--;
          }
          return real(...a);
        };
        return true;
      })()`);
      try {
        await rig.press("Delete");
        await until(rig.b, `window.__heldOpPosts > 0`, "the delete POST to stall", 1500);
        const left = await rig.b.ev(`document.querySelectorAll(".item").length`);
        if (left !== 0) {
          throw new Error("the item is still on screen after Delete while its POST is stalled — the write has no echo");
        }
      } finally {
        await rig.b.ev(`(() => { window.fetch = window.__realFetch; return true; })()`);
      }
    },
  },
  {
    name: "launcher",
    /** ⌘K stopped being a third composer and became the way to reach
     *  everything. A launcher that opens but does nothing is the worst version
     *  of it, so this presses a real chord and runs a real action. */
    what: "Cmd-K opens, filters, and actually does the thing",
    async run(rig) {
      await makeCanvas(rig, "Launcher journey");
      await rig.press("k", { meta: true });
      await until(rig.b, `!!document.querySelector(".palette")`, "the launcher to open");
      const groups = await rig.b.ev(
        `[...document.querySelectorAll(".palette-group")].map(g => g.textContent)`,
      );
      /* Both vocabularies: things the app DOES, and messages it can hand to an
         agent. A palette showing only one has lost half the point. */
      if (!groups.includes("View")) throw new Error(`no actions in the launcher: ${groups}`);
      if (!groups.includes("Ask an agent")) {
        throw new Error(`no agent commands in the launcher: ${groups}`);
      }
      await rig.type("actual size");
      await until(
        rig.b,
        `document.querySelectorAll(".palette-row").length === 1`,
        "the list to narrow to one row",
      );
      await rig.press("Enter");
      const done = await rig.b.ev(`(() => ({
        closed: !document.querySelector(".palette"),
        zoom: (document.body.innerText.match(/(\\d+)%/) || [])[1] ?? null,
      }))()`);
      if (!done.closed) throw new Error("the launcher stayed open after running something");
      if (done.zoom !== "100") throw new Error(`Actual size did not zoom to 100% (got ${done.zoom})`);
    },
  },
  {
    name: "switcher",
    /** The launcher's second face. Three doors open one window that leads
     *  with the canvas you were on lately; a few letters find one; Enter
     *  moves you there. The move is an animation and is NOT asserted on —
     *  what is asserted is the state after it: the other canvas's name in
     *  the bar, and a world under it. */
    what: "⌘O, the ··· row and ⌘K all open the switcher; recents lead; fuzzy letters find a canvas; Enter goes",
    async run(rig) {
      await makeCanvas(rig, "Lake House");
      await makeCanvas(rig, "Roadmap");
      // Door 1: ⌘O, from Roadmap. Lake House was the canvas before this one,
      // so it is the first row, under "Recent".
      await rig.press("o", { meta: true });
      await until(rig.b, `!!document.querySelector(".palette.palette-canvases")`, "the switcher to open");
      const first = await rig.b.ev(`(() => ({
        group: document.querySelector(".palette-group")?.textContent ?? null,
        title: document.querySelector(".palette-row .palette-canvas-title")?.textContent ?? null,
        self: [...document.querySelectorAll(".palette-canvas-title")].some(t => t.textContent === "Roadmap"),
      }))()`);
      if (first.group !== "Recent") throw new Error(`the switcher does not lead with Recent: ${first.group}`);
      if (first.title !== "Lake House") throw new Error(`the first row is not the last canvas: ${first.title}`);
      if (first.self) throw new Error("the switcher offers the canvas you are on");
      // Fuzzy: three letters that are not a word, and the letters light up.
      await rig.type("lkh");
      await until(
        rig.b,
        `document.querySelectorAll(".palette-row").length === 1 && document.querySelectorAll(".palette-canvas-title mark").length === 3`,
        "lkh to find Lake House, with three lit letters",
      );
      await rig.press("Enter");
      await until(
        rig.b,
        `!document.querySelector(".palette") && document.querySelector(".canvas-name .title")?.textContent === "Lake House" && !!document.querySelector(".world")`,
        "Enter to land on Lake House",
      );
      // Door 2: the ··· menu's row, back the other way. This was the caret
      // beside the name until 6 Sep 2026 — removed because it and the ···
      // were two adjacent glyphs meaning different things, and the row that
      // replaced it carries a word and ⌘O (`menuentries.tsx`).
      await rig.click('button[aria-label="More"]', "the ··· menu");
      // The menu is mounted by a click that has just followed a navigation,
      // so wait for it rather than assuming the frame after the click has it.
      await until(
        rig.b,
        `[...document.querySelectorAll(".menu-entry,[role=menuitem],.ctx-entry")].some(e => e.textContent.trim().startsWith("Switch canvas…"))`,
        "the ··· menu to hold the Switch canvas row",
      );
      await rig.clickText(".menu-entry,[role=menuitem],.ctx-entry", "Switch canvas…", "the Switch canvas row");
      await until(rig.b, `!!document.querySelector(".palette.palette-canvases")`, "the row to open the switcher");
      await rig.type("rdm");
      await until(rig.b, `document.querySelectorAll(".palette-row").length === 1`, "rdm to find Roadmap");
      await rig.press("Enter");
      await until(
        rig.b,
        `!document.querySelector(".palette") && document.querySelector(".canvas-name .title")?.textContent === "Roadmap"`,
        "Enter to land on Roadmap",
      );
      // Door 3: ⌘K's own field finds a canvas under the actions, no mode needed.
      await rig.press("k", { meta: true });
      await until(rig.b, `!!document.querySelector(".palette:not(.palette-canvases)")`, "the launcher to open");
      await rig.type("lake");
      await until(
        rig.b,
        `[...document.querySelectorAll(".palette-group")].some(g => g.textContent === "Switch to") && [...document.querySelectorAll(".palette-canvas-title")].some(t => t.textContent === "Lake House")`,
        "the launcher to list Lake House under the actions",
      );
    },
  },
  {
    name: "history-and-lens",
    /** Both read across canvases; both were built the same day and neither
     *  had ever been opened by anything but a person. */
    what: "the lens lists what somebody made, and every row links somewhere real",
    async run(rig) {
      await makeCanvas(rig, "Lens journey");
      await addText(rig, "made for the lens");
      await rig.go("/lens");
      await until(rig.b, `document.querySelectorAll(".lens-subject").length > 0`, "a lens roster");
      await rig.click(".lens-subject", "the first lens subject");
      await sleep(1200);
      const seen = await rig.b.ev(`(() => ({
        rows: document.querySelectorAll(".lens-tile").length,
        hrefs: [...document.querySelectorAll(".lens-tile")].map(a => a.getAttribute("href")),
        note: document.querySelector(".lens-note")?.textContent ?? "",
        /* The point of the redesign: tiles show the WORK. A tile with no
           thumbnail in it is the old list of titles wearing a card. */
        shots: document.querySelectorAll(".lens-tile .item-thumb").length,
      }))()`);
      if (seen.rows === 0) throw new Error("the lens shows nothing for somebody who made something");
      if (seen.shots === 0) throw new Error("the lens tiles draw no thumbnails — it is a list again");
      if (!seen.hrefs.every((h) => /^\/p\/[^/]+\/i\/[^/]+$/.test(h ?? ""))) {
        throw new Error("a lens row does not link to where the thing lives");
      }
      if (!/own canvases/.test(seen.note)) throw new Error("the lens does not say things live elsewhere");
    },
  },
];

/** Put a text node on the open canvas the way a person does. */
async function addText(rig, words) {
  await rig.clickTool("Text");
  /* A real press on empty canvas — the gesture that opens a composer. */
  await rig.stroke([[240, 240]]);
  await until(rig.b, `!!document.querySelector(".text-composer textarea")`, "the text composer");
  /* Typed key by key through the browser, then a real ⌘Enter. Setting
     `.value` would skip whatever the composer does per keystroke, which is
     where its measuring and growing live. */
  await rig.type(words);
  await until(
    rig.b,
    `document.querySelector(".text-composer textarea")?.value === ${JSON.stringify(words)}`,
    "the typed words to reach the composer",
  );
  await rig.press("Enter", { meta: true });
  await sleep(900);
}

async function main() {
  const only = arg("--only");
  const selftest = argv.includes("--selftest");
  const chosen = only ? JOURNEYS.filter((j) => j.name === only) : JOURNEYS;
  if (only && chosen.length === 0) {
    console.error(`no journey called "${only}" — ${JOURNEYS.map((j) => j.name).join(", ")}`);
    process.exit(2);
  }
  /**
   * **A checker that cannot fail proves nothing**, and this one drives a
   * browser through a daemon, which is a great deal of machinery to be
   * silently broken. `--selftest` runs a journey whose assertion cannot hold
   * and insists it is reported as a failure.
   */
  const list = selftest
    ? [
        {
          name: "selftest",
          what: "a journey that must fail",
          async run(rig) {
            const n = await rig.b.ev(`document.querySelectorAll("nothing-like-this").length`);
            if (n === 0) throw new Error("deliberate: this journey exists to fail");
          },
        },
      ]
    : chosen;

  const r = await rig();
  const results = [];
  try {
    for (const journey of list) {
      const started = Date.now();
      try {
        const proof = await journey.run(r);
        results.push({ name: journey.name, what: journey.what, ok: true, ms: Date.now() - started, ...(proof ? { proof } : {}) });
      } catch (err) {
        results.push({
          name: journey.name,
          what: journey.what,
          ok: false,
          ms: Date.now() - started,
          why: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    await r.close();
  }

  const failed = results.filter((x) => !x.ok);
  // One integer and nothing else, which is what a persona's goal can compare
  // against — `--json` carries the detail a person reads afterwards.
  if (argv.includes("--failing")) {
    console.log(String(failed.length));
    process.exit(0);
  }
  if (asJson) {
    console.log(JSON.stringify({ failing: failed.length, results }, null, 2));
  } else {
    for (const x of results) {
      console.log(`${x.ok ? "  ok  " : "FAIL  "}${x.name.padEnd(22)} ${x.what}`);
      if (!x.ok) console.log(`        ${x.why}`);
    }
    console.log(
      `\n${results.length - failed.length}/${results.length} journeys walked` +
        (failed.length ? ` — ${failed.length} failing` : ""),
    );
  }
  if (selftest) {
    if (failed.length === 1) {
      console.log("the selftest journey failed, as it must — this runner can report a failure");
      process.exit(0);
    }
    console.error("SILENT: the selftest journey did not fail — this runner cannot report one");
    process.exit(1);
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

await main();

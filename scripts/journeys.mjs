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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
      /* Waited for, not looked up once: the ··· menu draws its rows after a
         lazy chunk (`menuentries.tsx`) arrives, and on a cold fetch that is
         later than the press's own 250ms settle. Three journeys pressed
         "Agents" straight after opening it and failed whenever the fetch ran
         long — found 8 Oct 2026, 1 run in 3. */
      const deadline = Date.now() + 4000;
      let mark = null;
      for (;;) {
        mark = await b.ev(`(() => {
          const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
            .find(e => e.textContent.trim().startsWith(${JSON.stringify(text)}));
          if (!el) return null;
          el.setAttribute("data-journey-target", "1");
          return true;
        })()`);
        if (mark || Date.now() > deadline) break;
        await sleep(100);
      }
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
        Escape: { windowsVirtualKeyCode: 27, key: "Escape", code: "Escape" },
        j: { windowsVirtualKeyCode: 74, key: "j", code: "KeyJ" },
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
      await rig.click('button[title^="Undo ("]', "governing document Undo");
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
      await rig.click('button[title^="Undo ("]', "canvas version Undo");
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
        const at = await openSpot(rig);
        await rig.stroke([[at.x, at.y]]);
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
      const before = await rig.b.ev(`document.querySelectorAll(".item").length`);
      const at = await openSpot(rig, 100, 50);
      await rig.stroke([
        [at.x, at.y],
        [at.x + 36, at.y + 18],
        [at.x + 72, at.y + 36],
        [at.x + 100, at.y + 50],
      ]);
      await sleep(900);
      const errors = rig.b.takeErrors();
      if (errors.length > 0) throw new Error(`the Pen threw: ${errors[0]}`);
      const alive = await rig.b.ev(`!!document.querySelector(".world") && !!document.querySelector(".tool-rail")`);
      if (!alive) throw new Error("the canvas is gone — the page stopped rendering");
      /* "Draws" is the promise, so it is asserted: the ink settles into an item
         after INK_SETTLE_MS (1.5s). Until 26 Sep this journey stopped at "threw
         nothing", which is how it stayed green for a stroke that landed on
         the Chat panel and drew nothing at all. */
      await until(rig.b, `document.querySelectorAll(".item").length > ${before}`, "the stroke to settle into an item on the canvas");
    },
  },
  {
    name: "lift",
    /**
     * **The lift** (groups-by-hand phase 1): what the hand holds wears
     * `--shadow-lift` once the press has become a drag, and settles back to
     * the card's shadow on release. Depth only — nothing grows, nothing
     * fades, nothing leaves the hand — and a dragged group lifts its FRAME,
     * not each of its members.
     *
     * Asserted as STATE: the computed `box-shadow` is polled until it equals
     * the token (a probe element resolves `var(--shadow-lift)` and
     * `var(--shadow-card)` in this page's theme, so the comparison is
     * theme-proof), never caught mid-transition.
     */
    what: "a dragged card wears the lift and settles back; a dragged group lifts its frame, not its members",
    async run(rig) {
      const { b } = rig;
      const id = await makeCanvas(rig, "Acme lift");
      const runCli = (...args) => {
        const out = execFileSync(process.execPath, [cli, "--json", ...args], {
          cwd: rig.home, encoding: "utf8",
          env: { ...process.env, ISOCAN_HOME: rig.home, ISOCAN_PORT: new URL(rig.origin).port, ISOCAN_SESSION_ID: "acme-lift-journey", ISOCAN_HARNESS: "test" },
        });
        return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out;
      };
      runCli("identity", "--session", "--name", "Acme Lift CLI");
      const md = path.join(rig.home, "acme-lift.md");
      writeFileSync(md, "# Acme\n\nA card to pick up.\n");
      // Somewhere bare and on screen (the panels take part of a small
      // window), with room above for the title bar and to the right for the
      // drag — converted from screen to world through the world's own box.
      const spot = await openSpot(rig, 340, 260);
      const world = await b.ev(`(() => {
        const w = document.querySelector(".world"), r = w.getBoundingClientRect();
        const scale = parseFloat(getComputedStyle(w).getPropertyValue("--scale")) || 1;
        return { left: r.left, top: r.top, scale };
      })()`);
      const wx = Math.round((spot.x + 20 - world.left) / world.scale), wy = Math.round((spot.y + 50 - world.top) / world.scale);
      const card = runCli("--canvas", id, "add", md, "--title", "Acme card", "--at", `${wx},${wy}`, "--size", "240x160").itemId;
      const sel = (itemId) => JSON.stringify(`.item[data-item-id="${itemId}"]`);
      await until(b, `!!document.querySelector(${sel(card)})`, "the card to arrive on the canvas");
      await rig.type("v");

      // The two shadows, resolved in this page's own theme.
      const tokens = await b.ev(`(() => {
        const probe = document.createElement("div");
        document.querySelector(".item").parentElement.appendChild(probe);
        probe.style.boxShadow = "var(--shadow-lift)";
        const lift = getComputedStyle(probe).boxShadow;
        probe.style.boxShadow = "var(--shadow-card)";
        const card = getComputedStyle(probe).boxShadow;
        probe.remove();
        return { lift, card };
      })()`);
      if (!tokens.lift || tokens.lift === "none" || tokens.lift === tokens.card) throw new Error(`--shadow-lift does not resolve to its own shadow (${tokens.lift})`);
      const look = (itemId) => b.ev(`(() => {
        const el = document.querySelector(${sel(itemId)});
        if (!el) return null;
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        // An identity matrix is no transform: the arrival animation's
        // filled end state reads either way depending on when it is asked.
        const transform = cs.transform === "matrix(1, 0, 0, 1, 0, 0)" ? "none" : cs.transform;
        return { shadow: cs.boxShadow, transform, opacity: cs.opacity, scale: cs.scale, translate: cs.translate,
                 lifted: el.classList.contains("lifted"), x: r.left, y: r.top, w: r.width, h: r.height };
      })()`);
      const shadowIs = (itemId, want, what) =>
        until(b, `getComputedStyle(document.querySelector(${sel(itemId)})).boxShadow === ${JSON.stringify(want)}`, what, 3000);

      /** A real press on a point of the item a person would grab, then a
       *  move of 40px in steps — returns the release. */
      const grab = async (selector, what) => {
        const at = await b.ev(`(() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + Math.min(r.height / 2, 12));
          const top = document.elementFromPoint(x, y);
          return { x, y, hit: !!top && (el === top || el.contains(top)), over: top ? (top.className?.toString?.() || top.tagName) : "nothing" };
        })()`);
        if (!at) throw new Error(`no ${what} on screen`);
        if (!at.hit) throw new Error(`${what} is covered by ${at.over} — a person could not grab it (${JSON.stringify(at)}; ${await b.ev(`JSON.stringify(document.querySelector(".canvas-viewport").getBoundingClientRect())`)}; ${await b.ev(`document.querySelector(${JSON.stringify(selector)}).closest(".item").outerHTML.slice(0,300)`)})`);
        await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: at.x, y: at.y, button: "left", buttons: 1, clickCount: 1 });
        return {
          at,
          move: async (dx) => {
            for (let s = 1; s <= 4; s++) {
              await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x + (dx * s) / 4, y: at.y, button: "left", buttons: 1 });
              await sleep(40);
            }
          },
          release: (dx) => b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: at.x + dx, y: at.y, button: "left", buttons: 0, clickCount: 1 }),
        };
      };

      // 1. A card. At rest: the card's shadow.
      // The card arrived from another actor (the CLI), so it plays the
      // arrival motion, which a headless page throttles: wait for the STATE
      // it ends in (no transform) rather than read its scale as the lift's.
      await until(b, `/^(none|matrix\\(1, 0, 0, 1, 0, 0\\))$/.test(getComputedStyle(document.querySelector(${sel(card)})).transform)`, "the card to come to rest at its own size");
      await shadowIs(card, tokens.card, "the card to rest in --shadow-card");
      const rest = await look(card);
      const hand = await grab(`.item[data-item-id="${card}"] .item-titlebar`, "the card's title bar");
      // A press that has not moved is a click, and a click never lifts.
      await sleep(250);
      const pressed = await look(card);
      if (pressed.lifted || pressed.shadow !== tokens.card) {
        await hand.release(0);
        throw new Error(`a press that never moved already lifted the card (${pressed.shadow})`);
      }
      await hand.move(40);
      try {
        await shadowIs(card, tokens.lift, "the dragged card to wear --shadow-lift");
      } catch (err) {
        const now = await look(card);
        await hand.release(40);
        throw new Error(`${err.message} — it wears ${now.shadow}, lifted class ${now.lifted}`);
      }
      const mid = await look(card);
      await hand.release(40);
      if (mid.transform !== "none" || mid.scale !== "none" || mid.translate !== "none") throw new Error(`the lift moved or scaled the card (transform ${mid.transform}, scale ${mid.scale}, translate ${mid.translate})`);
      if (mid.opacity !== "1") throw new Error(`a dragged card is translucent (opacity ${mid.opacity}) — the lift says moving, not a fade`);
      if (Math.abs(mid.w - rest.w) > 0.5 || Math.abs(mid.h - rest.h) > 0.5) throw new Error(`the lifted card changed size (${rest.w}×${rest.h} → ${mid.w}×${mid.h})`);
      if (Math.abs(mid.x - rest.x - 40) > 8) throw new Error(`the card is not under the hand: moved ${mid.x - rest.x}px for a 40px drag`);
      await shadowIs(card, tokens.card, "the released card to settle back to --shadow-card");
      const settled = await look(card);
      if (settled.lifted) throw new Error("the released card still wears .lifted");

      // 2. A group: its frame lifts, its member does not.
      // A new canvas may be legacy (areas) or groups; the card above went
      // through whichever drag path it has, and the proof says which.
      let wrapped, migrated = false;
      try {
        wrapped = runCli("--canvas", id, "canvas", "group", "wrap", card, "--title", "Acme group");
      } catch {
        const preview = runCli("--canvas", id, "canvas", "group", "migrate", "--dry-run");
        runCli("--canvas", id, "canvas", "group", "migrate", "--revision", String(preview.revision));
        migrated = true;
        wrapped = runCli("--canvas", id, "canvas", "group", "wrap", card, "--title", "Acme group");
      }
      const group = wrapped.groupId ?? wrapped.itemId ?? wrapped.group?.id ?? wrapped.id;
      if (!group) throw new Error(`wrap returned no group id: ${JSON.stringify(wrapped).slice(0, 200)}`);
      await until(b, `!!document.querySelector(${JSON.stringify(`.item.area[data-item-id="${group}"] .area-title`)})`, "the group's frame and title strip");
      await until(b, `/^(none|matrix\\(1, 0, 0, 1, 0, 0\\))$/.test(getComputedStyle(document.querySelector(${sel(group)})).transform)`, "the frame to come to rest at its own size");
      const frameRest = await look(group);
      const handle = await grab(`.item[data-item-id="${group}"] .area-title`, "the group's title strip");
      await handle.move(40);
      try {
        await shadowIs(group, tokens.lift, "the dragged group's frame to wear --shadow-lift");
      } catch (err) {
        const now = await look(group);
        await handle.release(40);
        throw new Error(`${err.message} — it wears ${now.shadow}, lifted class ${now.lifted}`);
      }
      const frameMid = await look(group);
      const memberMid = await look(card);
      await handle.release(40);
      if (memberMid.lifted || memberMid.shadow !== tokens.card) throw new Error(`a member of the dragged group lifted too (${memberMid.shadow}) — the frame lifts, its members ride flat`);
      if (Math.abs(frameMid.x - frameRest.x - 40) > 8) throw new Error(`the group is not under the hand: moved ${frameMid.x - frameRest.x}px for a 40px drag`);
      if (frameMid.transform !== "none" || Math.abs(frameMid.w - frameRest.w) > 0.5) throw new Error(`the lifted frame was transformed or resized (${frameRest.w}×${frameRest.h}, ${frameRest.transform} → ${frameMid.w}×${frameMid.h}, ${frameMid.transform})`);
      await shadowIs(group, "none", "the released group's frame to lie flat again");
      return { cardDragMode: migrated ? "legacy" : "groups", lift: tokens.lift, card: tokens.card, memberDuringGroupDrag: memberMid.shadow };
    },
  },
  {
    name: "group-reach",
    /**
     * **⌘ takes one item** (groups-by-hand phase 2), driven with real CDP
     * mouse and key events carrying the modifier. Hover says what a press
     * would take — the group, over a member AND over the space between
     * members — and ⌘ moves the outline to the member, live as the key goes
     * down under a still pointer. A ⌘-drag carries a member out onto the open
     * canvas under an *Out of …* label, as one act that one ⌘Z undoes; a plain
     * drag past the frame keeps the member and grows the frame.
     *
     * ⌘ on a Mac, Ctrl elsewhere: the browser runs on this machine, so this
     * machine's platform is the page's (`reachHeld` in core). Asserted as
     * STATE — classes in the DOM, membership and boxes the server holds.
     */
    what: "hover outlines what a press takes; ⌘ reaches one member and drags it out (one undo back); a plain drag keeps it and grows the frame",
    async run(rig) {
      const { b } = rig;
      await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      const id = await makeCanvas(rig, "Acme reach");
      const runCli = (...args) => {
        const out = execFileSync(process.execPath, [cli, "--json", ...args], {
          cwd: rig.home, encoding: "utf8",
          env: { ...process.env, ISOCAN_HOME: rig.home, ISOCAN_PORT: new URL(rig.origin).port, ISOCAN_SESSION_ID: "acme-reach-journey", ISOCAN_HARNESS: "test" },
        });
        return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out;
      };
      /** Poll the home until it says so — the op lands after the release. */
      const home = async (read, want, what, ms = 8000) => {
        const deadline = Date.now() + ms;
        for (;;) {
          const got = read();
          if (want(got)) return got;
          if (Date.now() > deadline) throw new Error(`never became true: ${what} (the home says ${JSON.stringify(got)})`);
          await sleep(200);
        }
      };
      runCli("identity", "--session", "--name", "Acme Reach CLI");
      const MOD = process.platform === "darwin" ? 4 : 2;
      const MOD_KEY = process.platform === "darwin"
        ? { key: "Meta", code: "MetaLeft", windowsVirtualKeyCode: 91 }
        : { key: "Control", code: "ControlLeft", windowsVirtualKeyCode: 17 };

      // Two cards with a clear gap between them, wrapped in one group, with
      // open canvas to the right to drag a member out onto.
      const spot = await openSpot(rig, 620, 300);
      const world = await b.ev(`(() => {
        const w = document.querySelector(".world"), r = w.getBoundingClientRect();
        return { left: r.left, top: r.top, scale: parseFloat(getComputedStyle(w).getPropertyValue("--scale")) || 1 };
      })()`);
      const wx = Math.round((spot.x + 40 - world.left) / world.scale), wy = Math.round((spot.y + 110 - world.top) / world.scale);
      const one = runCli("--canvas", id, "text", "Acme one", "--at", `${wx},${wy}`, "--size", "120x80").itemId;
      const two = runCli("--canvas", id, "text", "Acme two", "--at", `${wx + 240},${wy}`, "--size", "120x80").itemId;
      let wrapped;
      try { wrapped = runCli("--canvas", id, "canvas", "group", "wrap", one, two, "--title", "Acme group"); }
      catch {
        const preview = runCli("--canvas", id, "canvas", "group", "migrate", "--dry-run");
        runCli("--canvas", id, "canvas", "group", "migrate", "--revision", String(preview.revision));
        wrapped = runCli("--canvas", id, "canvas", "group", "wrap", one, two, "--title", "Acme group");
      }
      const group = wrapped.itemId ?? wrapped.groupId;
      if (!group) throw new Error(`wrap returned no group id: ${JSON.stringify(wrapped).slice(0, 200)}`);
      const sel = (itemId) => JSON.stringify(`.item[data-item-id="${itemId}"]`);
      for (const itemId of [group, one, two]) {
        await until(b, `!!document.querySelector(${sel(itemId)})`, `${itemId} to arrive on the canvas`);
        await until(b, `/^(none|matrix\\(1, 0, 0, 1, 0, 0\\))$/.test(getComputedStyle(document.querySelector(${sel(itemId)})).transform)`, `${itemId} to come to rest`);
      }
      await rig.type("v");
      const rect = (itemId) => b.ev(`(() => { const r = document.querySelector(${sel(itemId)}).getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height, cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2) }; })()`);
      const mouse = (type, x, y, { buttons = 0, modifiers = 0 } = {}) => b.send("Input.dispatchMouseEvent", {
        type, x, y, modifiers, buttons, button: type === "mouseMoved" && !buttons ? "none" : "left", clickCount: type === "mouseMoved" ? 0 : 1,
      });
      const has = (itemId, cls, what) => until(b, `!!document.querySelector(${sel(itemId)})?.classList.contains(${JSON.stringify(cls)})`, what, 3000);
      const lacks = async (itemId, cls, what) => {
        if (await b.ev(`!!document.querySelector(${sel(itemId)})?.classList.contains(${JSON.stringify(cls)})`)) throw new Error(what);
      };
      const parentOf = (itemId) => runCli("--canvas", id, "show", itemId).containerId ?? null;
      const members = () => runCli("--canvas", id, "ls", "--in", group).map((row) => row.id ?? row.itemId).sort();

      // 1. At the canvas level, pointing at a member outlines the GROUP.
      const r1 = await rect(one), r2 = await rect(two);
      await mouse("mouseMoved", r1.cx, r1.cy);
      await has(group, "hover-target", "pointing at a member at the canvas level to outline its group");
      await lacks(one, "hover-target", "pointing at a member outlined the member, while a press takes the group");

      // 2. …and so does the open space between the members, which takes the
      // pointer there now.
      const gap = { x: Math.round((r1.right + r2.left) / 2), y: r1.cy };
      const under = await b.ev(`document.elementFromPoint(${gap.x}, ${gap.y})?.closest("[data-item-id]")?.getAttribute("data-item-id") ?? null`);
      if (under !== group) throw new Error(`the space between members does not take the pointer for the group (under it: ${under})`);
      await mouse("mouseMoved", gap.x, gap.y);
      await mouse("mouseMoved", gap.x + 2, gap.y);
      await has(group, "hover-target", "pointing at the space between members to outline the group");

      // 3. ⌘ moves the outline to the member, and the group reads "inside this".
      await mouse("mouseMoved", r1.cx, r1.cy, { modifiers: MOD });
      await has(one, "hover-target", "⌘ over a member to outline the member");
      await has(group, "reach-inside", "⌘ over a member to draw its group faint, as the thing it is inside");
      await lacks(group, "hover-target", "⌘ over a member still outlined the group");
      // Live: ⌘ going up and down under a pointer that does not move.
      await mouse("mouseMoved", r1.cx + 1, r1.cy);
      await has(group, "hover-target", "letting go of ⌘ to put the outline back on the group");
      await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", modifiers: MOD, ...MOD_KEY });
      await has(one, "hover-target", "pressing ⌘ under a still pointer to move the outline to the member");
      await b.send("Input.dispatchKeyEvent", { type: "keyUp", modifiers: 0, ...MOD_KEY });
      await has(group, "hover-target", "releasing ⌘ under a still pointer to move the outline back");
      // ⌘ over the space between members: the members, dimly; a press there
      // is a selection box among them, not a grab of the group.
      await mouse("mouseMoved", gap.x, gap.y, { modifiers: MOD });
      await has(two, "reach-among", "⌘ over the space between members to show the members a selection box would reach");
      await mouse("mousePressed", gap.x, gap.y, { buttons: 1, modifiers: MOD });
      for (let s = 1; s <= 4; s++) { await mouse("mouseMoved", gap.x + Math.round(((r2.cx - gap.x) * s) / 4), gap.y + Math.round(((r2.bottom + 6 - gap.y) * s) / 4), { buttons: 1, modifiers: MOD }); await sleep(30); }
      await mouse("mouseReleased", r2.cx, r2.bottom + 6, { modifiers: MOD });
      await has(two, "selected", "a ⌘ selection box from the space between members to select the member it crosses");
      await lacks(group, "selected", "a ⌘ press on the space between members took the group instead of starting a selection box");
      await lacks(one, "selected", "the ⌘ selection box selected a member it never crossed");

      // 4. ⌘-drag the member out onto open canvas: the label says so first.
      const frame0 = runCli("--canvas", id, "show", group);
      const at0 = runCli("--canvas", id, "show", one);
      const fr = await rect(group);
      const out = { x: Math.round(fr.right + 140), y: r1.cy };
      await mouse("mousePressed", r1.cx, r1.cy, { buttons: 1, modifiers: MOD });
      for (let s = 1; s <= 8; s++) {
        await mouse("mouseMoved", Math.round(r1.cx + ((out.x - r1.cx) * s) / 8), out.y, { buttons: 1, modifiers: MOD });
        await sleep(40);
      }
      try {
        await until(b, `document.querySelector(${JSON.stringify(`.item[data-item-id="${group}"] .group-drop-label.out`)})?.textContent === "Out of Acme group"`, "the Out of Acme group label before letting go", 3000);
      } catch (err) {
        await mouse("mouseReleased", out.x, out.y, { modifiers: MOD });
        throw err;
      }
      await mouse("mouseReleased", out.x, out.y, { modifiers: MOD });
      await home(() => parentOf(one), (parent) => parent === null, "the ⌘-dragged member to be on the canvas, out of its group");
      const left = members();
      if (left.length !== 1 || left[0] !== two) throw new Error(`the group should hold one item fewer, just ${two}; it holds ${JSON.stringify(left)}`);
      const landed = runCli("--canvas", id, "show", one);
      if (landed.x <= frame0.x + frame0.width) throw new Error(`the member did not land where the pointer was, out past the frame (x ${landed.x}, frame ends ${frame0.x + frame0.width})`);

      // …and one ⌘Z puts it back: in the group, where it was.
      await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", modifiers: MOD, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90 });
      await b.send("Input.dispatchKeyEvent", { type: "keyUp", modifiers: MOD, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90 });
      const back = await home(() => runCli("--canvas", id, "show", one), (item) => item.containerId === group, "one undo to put the member back in its group");
      if (back.x !== at0.x || back.y !== at0.y) throw new Error(`undo restored membership but not the place (${back.x},${back.y}, was ${at0.x},${at0.y})`);

      // 5. A plain drag never detaches. ⌘-click steps into the group (a plain
      // press at the canvas level takes the group), then a plain drag of the
      // member past the frame's left edge keeps it a member and grows the frame.
      await until(b, `/^(none|matrix\\(1, 0, 0, 1, 0, 0\\))$/.test(getComputedStyle(document.querySelector(${sel(one)})).transform)`, "the member to come to rest after the undo");
      const r3 = await rect(one);
      await mouse("mousePressed", r3.cx, r3.cy, { buttons: 1, modifiers: MOD });
      await mouse("mouseReleased", r3.cx, r3.cy, { modifiers: MOD });
      await has(one, "selected", "⌘-click to select just the member");
      await lacks(group, "selected", "⌘-click selected the group");
      const frame1 = runCli("--canvas", id, "show", group);
      const past = { x: Math.round((await rect(group)).left - 90), y: r3.cy };
      await mouse("mousePressed", r3.cx, r3.cy, { buttons: 1 });
      for (let s = 1; s <= 8; s++) {
        await mouse("mouseMoved", Math.round(r3.cx + ((past.x - r3.cx) * s) / 8), past.y, { buttons: 1 });
        await sleep(40);
      }
      const outLabel = await b.ev(`!!document.querySelector(".group-drop-label.out")`);
      await mouse("mouseReleased", past.x, past.y);
      if (outLabel) throw new Error("a plain drag past the frame offered to take the member out");
      const grown = await home(() => runCli("--canvas", id, "show", group), (frame) => frame.x < frame1.x, "the frame to grow to keep the plainly dragged member");
      if (parentOf(one) !== group) throw new Error("a plain drag past the frame detached the member");
      return { modifier: MOD === 4 ? "meta" : "ctrl", frameBefore: { x: frame1.x, width: frame1.width }, frameAfter: { x: grown.x, width: grown.width }, outAt: { x: landed.x, y: landed.y } };
    },
  },
  {
    name: "live-drag",
    /**
     * **Others see the drag** (groups-by-hand phase 3), with TWO browsers on
     * one canvas: a second Chrome — its own cookie, so its own person — drags
     * a card with real CDP mouse events and holds it mid-air, and this page
     * (the viewer) must already be drawing the card offset by about the same
     * world distance, lifted and edged in the mover's colour. After the
     * release the card stands at the mover's final spot on both screens with
     * no ghost left behind: no translate, no ghost classes.
     *
     * Asserted as STATE on the viewer's DOM — the computed `translate` and
     * the item's `left`/`top` — polled until it holds, never an animation
     * caught mid-frame.
     */
    what: "a second person's drag shows on this screen as it happens, and lands with no ghost left",
    async run(rig) {
      const { b } = rig;
      const id = await makeCanvas(rig, "Acme live drag");
      const runCli = (...args) => {
        const out = execFileSync(process.execPath, [cli, "--json", ...args], {
          cwd: rig.home, encoding: "utf8",
          env: { ...process.env, ISOCAN_HOME: rig.home, ISOCAN_PORT: new URL(rig.origin).port, ISOCAN_SESSION_ID: "acme-live-drag-journey", ISOCAN_HARNESS: "test" },
        });
        return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out;
      };
      runCli("identity", "--session", "--name", "Acme Live Drag CLI");
      const md = path.join(rig.home, "acme-live-drag.md");
      writeFileSync(md, "# Acme\n\nA card somebody else will carry.\n");
      const spot = await openSpot(rig, 340, 260);
      const world = await b.ev(`(() => {
        const w = document.querySelector(".world"), r = w.getBoundingClientRect();
        const scale = parseFloat(getComputedStyle(w).getPropertyValue("--scale")) || 1;
        return { left: r.left, top: r.top, scale };
      })()`);
      const wx = Math.round((spot.x + 20 - world.left) / world.scale), wy = Math.round((spot.y + 50 - world.top) / world.scale);
      const card = runCli("--canvas", id, "add", md, "--title", "Acme carried card", "--at", `${wx},${wy}`, "--size", "240x160").itemId;
      const sel = JSON.stringify(`.item[data-item-id="${card}"]`);
      const look = (page) => page.ev(`(() => {
        const el = document.querySelector(${sel});
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { left: parseFloat(el.style.left), top: parseFloat(el.style.top), translate: cs.translate,
                 lifted: el.classList.contains("lifted"), root: el.classList.contains("ghost-root"),
                 ghosted: !!document.querySelector(".ghosted, .ghost-root, .ghost-into, .ghost-box"),
                 edge: cs.outlineStyle + " " + cs.outlineColor };
      })()`);
      await until(b, `!!document.querySelector(${sel})`, "the card to arrive on the viewer's canvas");
      const rest = await look(b);

      // The second person: a browser of its own, through the door as somebody else.
      const m = await browser();
      try {
        const loaded = m.once("Page.loadEventFired");
        await m.send("Page.navigate", { url: rig.origin });
        await Promise.race([loaded, sleep(15_000)]);
        await throughTheDoor(m, rig.origin, "Acme Mover", "journeys-mover");
        await m.send("Page.navigate", { url: `${rig.origin}/p/${id}` });
        await until(m, `!!document.querySelector(${sel})`, "the card to render for the mover", 30_000);
        await until(m, `/^(none|matrix\\(1, 0, 0, 1, 0, 0\\))$/.test(getComputedStyle(document.querySelector(${sel})).transform)`, "the card to come to rest for the mover");
        const at = await m.ev(`(() => {
          const el = document.querySelector(${JSON.stringify(`.item[data-item-id="${card}"] .item-titlebar`)});
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + Math.min(r.height / 2, 12));
          const top = document.elementFromPoint(x, y);
          const w = document.querySelector(".world");
          return { x, y, hit: !!top && (el === top || el.contains(top)), over: top ? String(top.className) : "nothing",
                   scale: parseFloat(getComputedStyle(w).getPropertyValue("--scale")) || 1 };
        })()`);
        if (!at) throw new Error("the mover has no title bar to grab");
        if (!at.hit) throw new Error(`the mover's grab point is covered by ${at.over}`);
        const DX = 180, DY = 60;
        const mouse = (type, x, y) => m.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1 });
        await mouse("mousePressed", at.x, at.y);
        for (let s = 1; s <= 12; s++) { await mouse("mouseMoved", at.x + (DX * s) / 12, at.y + (DY * s) / 12); await sleep(40); }
        // Held mid-air: nothing has landed, so the viewer can only know
        // where the card is from the mover's presence.
        const wantX = DX / at.scale, wantY = DY / at.scale;
        let mid;
        try {
          await until(b, `(() => {
            const el = document.querySelector(${sel});
            const t = getComputedStyle(el).translate.split(" ").map(parseFloat);
            return Math.abs((t[0] || 0) - ${wantX}) < 14 && Math.abs((t[1] || 0) - ${wantY}) < 14;
          })()`, "the viewer to draw the card under the mover's hand", 6000);
          mid = await look(b);
        } catch (err) {
          const now = await look(b);
          await mouse("mouseReleased", at.x + DX, at.y + DY);
          throw new Error(`${err.message} — the viewer shows ${JSON.stringify(now)}`);
        }
        const landedBefore = await look(b);
        if (landedBefore.left !== rest.left || landedBefore.top !== rest.top) {
          await mouse("mouseReleased", at.x + DX, at.y + DY);
          throw new Error(`the card's own position moved before the release (${rest.left},${rest.top} → ${landedBefore.left},${landedBefore.top}) — the ghost is meant to be presence, not an op`);
        }
        await mouse("mouseReleased", at.x + DX, at.y + DY);
        if (!mid.lifted || !mid.root) throw new Error(`the carried card was offset but not lifted and edged (${JSON.stringify(mid)})`);
        if (!/solid/.test(mid.edge)) throw new Error(`the carried card wears no solid edge in the mover's colour (${mid.edge})`);

        // Released: the op lands, and the ghost goes with it.
        const final = await (async () => {
          await until(m, `(() => { const el = document.querySelector(${sel}); return !!el && !el.classList.contains("lifted"); })()`, "the mover's card to settle");
          return look(m);
        })();
        if (Math.abs(final.left - rest.left - wantX) > 14) throw new Error(`the mover's drop landed ${final.left - rest.left} world px across for a ${wantX} drag`);
        await until(b, `(() => {
          const el = document.querySelector(${sel});
          return parseFloat(el.style.left) === ${final.left} && parseFloat(el.style.top) === ${final.top}
            && getComputedStyle(el).translate === "none"
            && !document.querySelector(".ghosted, .ghost-root, .ghost-into, .ghost-box");
        })()`, "the viewer to show the card at the mover's final spot with no ghost left", 6000).catch(async (err) => {
          throw new Error(`${err.message} — it shows ${JSON.stringify(await look(b))}, the mover dropped it at ${final.left},${final.top}`);
        });
        const after = await look(b);
        if (after.lifted) throw new Error("the viewer's card still wears .lifted after the drop");
        return { rest: [rest.left, rest.top], midTranslate: mid.translate, edge: mid.edge, landed: [after.left, after.top] };
      } finally {
        await m.close();
      }
    },
  },
  {
    name: "stack",
    /**
     * **Stacks** (groups-by-hand phase 4): *Stack* on a group's title band
     * draws it as a pile of cards — shared and stored, so it survives a
     * reload — while every member keeps its x/y. Pointing fans the pile, a
     * click opens it into a grid in front of the canvas, Esc closes the grid
     * (and the stack is still a stack, because opening is never stored), and
     * *Spread* puts every member back exactly where it was.
     *
     * Asserted as STATE — classes in the DOM, what the home holds, and the
     * members' boxes before and after — never an animation having run.
     */
    what: "Stack draws a pile of pictures that survives reload; hover fans, a click selects and a second opens, Esc closes; Spread puts every member back where it was; ⇧S stacks and spreads it again; ⌘-drag takes a card out of the opened stack",
    async run(rig) {
      const { b } = rig;
      await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      const id = await makeCanvas(rig, "Acme stack");
      const runCli = (...args) => {
        const out = execFileSync(process.execPath, [cli, "--json", ...args], {
          cwd: rig.home, encoding: "utf8",
          env: { ...process.env, ISOCAN_HOME: rig.home, ISOCAN_PORT: new URL(rig.origin).port, ISOCAN_SESSION_ID: "acme-stack-journey", ISOCAN_HARNESS: "test" },
        });
        return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out;
      };
      const home = async (read, want, what, ms = 8000) => {
        const deadline = Date.now() + ms;
        for (;;) {
          const got = read();
          if (want(got)) return got;
          if (Date.now() > deadline) throw new Error(`never became true: ${what} (the home says ${JSON.stringify(got)})`);
          await sleep(200);
        }
      };
      runCli("identity", "--session", "--name", "Acme Stack CLI");

      // Three cards in a row, wrapped in one group, on bare canvas.
      const spot = await openSpot(rig, 560, 300);
      const world = await b.ev(`(() => {
        const w = document.querySelector(".world"), r = w.getBoundingClientRect();
        return { left: r.left, top: r.top, scale: parseFloat(getComputedStyle(w).getPropertyValue("--scale")) || 1 };
      })()`);
      const wx = Math.round((spot.x + 40 - world.left) / world.scale), wy = Math.round((spot.y + 110 - world.top) / world.scale);
      const cards = ["Acme one", "Acme two", "Acme three"].map((words, n) => runCli("--canvas", id, "text", words, "--at", `${wx + n * 170},${wy}`, "--size", "120x80").itemId);
      let wrapped;
      try { wrapped = runCli("--canvas", id, "canvas", "group", "wrap", ...cards, "--title", "Acme archive"); }
      catch {
        const preview = runCli("--canvas", id, "canvas", "group", "migrate", "--dry-run");
        runCli("--canvas", id, "canvas", "group", "migrate", "--revision", String(preview.revision));
        wrapped = runCli("--canvas", id, "canvas", "group", "wrap", ...cards, "--title", "Acme archive");
      }
      const group = wrapped.itemId ?? wrapped.groupId;
      if (!group) throw new Error(`wrap returned no group id: ${JSON.stringify(wrapped).slice(0, 200)}`);
      const sel = (itemId) => JSON.stringify(`.item[data-item-id="${itemId}"]`);
      for (const itemId of [group, ...cards]) {
        await until(b, `!!document.querySelector(${sel(itemId)})`, `${itemId} to arrive on the canvas`);
        await until(b, `/^(none|matrix\\(1, 0, 0, 1, 0, 0\\))$/.test(getComputedStyle(document.querySelector(${sel(itemId)})).transform)`, `${itemId} to come to rest`);
      }
      await rig.type("v");
      const saved = () => cards.map((itemId) => { const item = runCli("--canvas", id, "show", itemId); return { id: itemId, x: item.x, y: item.y, width: item.width, height: item.height, in: item.containerId ?? null }; });
      const drawn = () => b.ev(`JSON.stringify(${JSON.stringify(cards)}.map((id) => { const r = document.querySelector('.item[data-item-id="' + id + '"]')?.getBoundingClientRect(); return r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null; }))`);
      const before = saved();
      const drawnBefore = await drawn();
      const stacked = () => runCli("--canvas", id, "canvas", "group", "show", group).stacked;
      const mouse = (type, x, y, { buttons = 0 } = {}) => b.send("Input.dispatchMouseEvent", {
        type, x, y, buttons, button: type === "mouseMoved" && !buttons ? "none" : "left", clickCount: type === "mouseMoved" ? 0 : 1,
      });

      // 1. Stack, from the title band.
      await rig.click(`.item[data-item-id="${group}"] .group-stack-toggle.band`, "the group's Stack button");
      await until(b, `!!document.querySelector(${JSON.stringify(`.item.stacked[data-item-id="${group}"] .stack-card.top`)})`, "the group to draw as a pile");
      await home(stacked, (on) => on === true, "the home to hold the group as stacked");
      if (JSON.stringify(saved()) !== JSON.stringify(before)) throw new Error(`stacking moved a member: ${JSON.stringify(saved())} (was ${JSON.stringify(before)})`);
      for (const itemId of cards) if (await b.ev(`!!document.querySelector(${sel(itemId)})`)) throw new Error(`${itemId} is still drawn at its spread position under a stack`);

      // 2. Reload: still a stack — the stored part.
      await rig.go(`/p/${id}`);
      await until(b, `!!document.querySelector(${JSON.stringify(`.item.stacked[data-item-id="${group}"] .stack-card.top`)})`, "the pile to come back after a reload", 12000);
      const layers = await b.ev(`document.querySelectorAll(${JSON.stringify(`.item[data-item-id="${group}"] .stack-card`)}).length`);
      if (layers !== 3) throw new Error(`the pile should show three cards, it shows ${layers}`);
      const turns = await b.ev(`JSON.stringify([...document.querySelectorAll(${JSON.stringify(`.item[data-item-id="${group}"] .stack-card:not(.top)`)})].map((el) => el.style.transform))`);
      if (!/rotate\(-?[3-9]/.test(turns)) throw new Error(`the cards behind the top are not turned: ${turns}`);
      // Every card in the pile shows its own picture, not only the top one (8 Oct 2026).
      const faces = await b.ev(`document.querySelectorAll(${JSON.stringify(`.item[data-item-id="${group}"] .stack-card .stack-card-face .item-thumb`)}).length`);
      if (faces !== layers) throw new Error(`only ${faces} of the pile's ${layers} cards show their picture`);
      await rig.type("v");

      // 3. Point at it: it fans.
      const pile = await b.ev(`(() => { const r = document.querySelector(${JSON.stringify(`.item[data-item-id="${group}"] .stack-pile`)}).getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
      const under = await b.ev(`document.elementFromPoint(${pile.x}, ${pile.y})?.closest("[data-item-id]")?.getAttribute("data-item-id") ?? null`);
      if (under !== group) throw new Error(`the pile does not take the pointer (under it: ${under})`);
      await mouse("mouseMoved", pile.x - 30, pile.y);
      await mouse("mouseMoved", pile.x, pile.y);
      await until(b, `!!document.querySelector(${JSON.stringify(`.item[data-item-id="${group}"] .stack-pile.fanned`)})`, "pointing at the pile to fan it", 3000);
      if (stacked() !== true) throw new Error("fanning changed what the home holds");

      // 4. The first click selects the stack (so ⇧S and the menu act on it); a
      //    click on the selected stack opens it into a grid of every member.
      await mouse("mousePressed", pile.x, pile.y, { buttons: 1 });
      await mouse("mouseReleased", pile.x, pile.y);
      await until(b, `!!document.querySelector(${JSON.stringify(`.item.selected[data-item-id="${group}"]`)})`, "the first click to select the stack", 3000);
      await sleep(400);
      if (await b.ev(`!!document.querySelector(".stack-open")`)) throw new Error("the first click on an unselected stack opened it; it should only select it");
      await mouse("mousePressed", pile.x, pile.y, { buttons: 1 });
      await mouse("mouseReleased", pile.x, pile.y);
      await until(b, `document.querySelectorAll(".stack-open .stack-open-card").length === 3`, "a click on the selected stack to open it into a grid of its three cards", 3000);

      // 5. Esc closes it — and the stack is still a stack.
      await rig.press("Escape");
      await until(b, `!document.querySelector(".stack-open")`, "Esc to close the opened stack", 3000);
      if (!(await b.ev(`!!document.querySelector(${JSON.stringify(`.item.stacked[data-item-id="${group}"]`)})`))) throw new Error("closing the opened stack spread the group");
      if (stacked() !== true) throw new Error("opening or closing the stack changed what the home holds");

      // 6. Spread: every member where it was.
      await mouse("mouseMoved", 5, 5);
      await rig.click(`.item[data-item-id="${group}"] .stack-band .group-stack-toggle`, "the stack's Spread button");
      await home(stacked, (on) => on === false, "the home to hold the group as spread");
      for (const itemId of cards) await until(b, `!!document.querySelector(${sel(itemId)})`, `${itemId} to be drawn again after Spread`);
      const after = saved();
      if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error(`Spread did not put every member back: ${JSON.stringify(after)} (was ${JSON.stringify(before)})`);
      const drawnAfter = await drawn();

      // 6b. ⇧S: a card selected stands for its group — stack it, then ⇧S again spreads it.
      const shiftS = async () => {
        const k = { windowsVirtualKeyCode: 83, key: "S", code: "KeyS" };
        await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", modifiers: 8, ...k });
        await b.send("Input.dispatchKeyEvent", { type: "keyUp", modifiers: 8, ...k });
      };
      await rig.click(`.item[data-item-id="${cards[0]}"]`, "a card of the group");
      await shiftS();
      await home(stacked, (on) => on === true, "⇧S to stack the group");
      await until(b, `!!document.querySelector(${JSON.stringify(`.item.stacked[data-item-id="${group}"] .stack-card.top`)})`, "⇧S's stack to draw as a pile");
      await shiftS();
      await home(stacked, (on) => on === false, "⇧S again to spread the group");
      for (const itemId of cards) await until(b, `!!document.querySelector(${sel(itemId)})`, `${itemId} to be drawn again after ⇧S spread it`);
      if (JSON.stringify(saved()) !== JSON.stringify(before)) throw new Error(`⇧S stack-and-spread moved a member: ${JSON.stringify(saved())} (was ${JSON.stringify(before)})`);

      // 7. ⌘-drag a card out of the opened stack: it leaves the group, in one act.
      runCli("--canvas", id, "canvas", "group", "stack", group);
      await until(b, `!!document.querySelector(${JSON.stringify(`.item.stacked[data-item-id="${group}"] .stack-card.top`)})`, "the group to stack again from the terminal");
      const pile2 = await b.ev(`(() => { const r = document.querySelector(${JSON.stringify(`.item[data-item-id="${group}"] .stack-pile`)}).getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), right: Math.round(r.right) }; })()`);
      // Opening takes a selected stack: one click selects it if it is not already.
      if (!(await b.ev(`!!document.querySelector(${JSON.stringify(`.item.selected[data-item-id="${group}"]`)})`))) {
        await mouse("mousePressed", pile2.x, pile2.y, { buttons: 1 });
        await mouse("mouseReleased", pile2.x, pile2.y);
        await until(b, `!!document.querySelector(${JSON.stringify(`.item.selected[data-item-id="${group}"]`)})`, "a click to select the stack again", 3000);
        await sleep(400);
      }
      await mouse("mousePressed", pile2.x, pile2.y, { buttons: 1 });
      await mouse("mouseReleased", pile2.x, pile2.y);
      const taken = cards[2];
      await until(b, `!!document.querySelector(${JSON.stringify(`.stack-open .stack-open-card[data-member-id="${taken}"]`)})`, "the stack to open again", 3000);
      const c = await b.ev(`(() => { const r = document.querySelector(${JSON.stringify(`.stack-open-card[data-member-id="${taken}"]`)}).getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
      const MOD = process.platform === "darwin" ? 4 : 2;
      const outAt = { x: Math.min(1200, pile2.right + 200), y: 820 };
      await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: c.x, y: c.y, modifiers: MOD, buttons: 1, button: "left", clickCount: 1 });
      for (let s = 1; s <= 8; s++) {
        await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: Math.round(c.x + ((outAt.x - c.x) * s) / 8), y: Math.round(c.y + ((outAt.y - c.y) * s) / 8), modifiers: MOD, buttons: 1, button: "left" });
        await sleep(40);
      }
      const inHand = await b.ev(`!!document.querySelector(${JSON.stringify(`.item.lifted[data-item-id="${taken}"]`)}) && !document.querySelector(".stack-open")`);
      await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: outAt.x, y: outAt.y, modifiers: MOD, buttons: 0, button: "left", clickCount: 1 });
      if (!inHand) throw new Error("⌘-dragging a card out of the opened stack did not close the grid and put the card in the hand");
      await home(() => runCli("--canvas", id, "show", taken).containerId ?? null, (parent) => parent === null, "the ⌘-dragged card to leave the stacked group");
      await until(b, `!!document.querySelector(${sel(taken)})`, "the card taken out to be drawn on the canvas");
      return { members: before.length, saved: after, drawnBefore: JSON.parse(drawnBefore), drawnAfter: JSON.parse(drawnAfter), takenOut: taken };
    },
  },
  {
    name: "submenu-diagonal",
    /**
     * **A submenu forgives a diagonal** (1 Oct 2026). Dion: right-click, hover
     * Style ›, move toward its children — and they vanished, because the
     * shortest path crosses the row below. Now a pointer heading into the open
     * submenu keeps it (`lib/menuaim.ts`): this walks that diagonal in small
     * real mouse steps, crossing the row below Align, and chooses the far item;
     * then walks straight DOWN from Align and insists the menu does let go.
     */
    what: "a diagonal from Align › across the row below keeps the submenu and chooses its far item; straight down lets it go",
    async run(rig) {
      const { b } = rig;
      await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      const id = await makeCanvas(rig, "Acme menus");
      const runCli = (...args) => {
        const out = execFileSync(process.execPath, [cli, "--json", ...args], {
          cwd: rig.home, encoding: "utf8",
          env: { ...process.env, ISOCAN_HOME: rig.home, ISOCAN_PORT: new URL(rig.origin).port, ISOCAN_SESSION_ID: "acme-menu-journey", ISOCAN_HARNESS: "test" },
        });
        return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out;
      };
      runCli("identity", "--session", "--name", "Acme Menu CLI");
      const spot = await openSpot(rig, 400, 260);
      const world = await b.ev(`(() => {
        const w = document.querySelector(".world"), r = w.getBoundingClientRect();
        return { left: r.left, top: r.top, scale: parseFloat(getComputedStyle(w).getPropertyValue("--scale")) || 1 };
      })()`);
      const wx = Math.round((spot.x + 20 - world.left) / world.scale), wy = Math.round((spot.y + 20 - world.top) / world.scale);
      const cards = [["Acme left", `${wx},${wy}`, "120x80"], ["Acme right", `${wx + 200},${wy + 40}`, "120x120"]]
        .map(([words, at, size]) => runCli("--canvas", id, "text", words, "--at", at, "--size", size).itemId);
      const sel = (itemId) => JSON.stringify(`.item[data-item-id="${itemId}"]`);
      for (const itemId of cards) await until(b, `!!document.querySelector(${sel(itemId)})`, `${itemId} to arrive on the canvas`);
      const centre = (selector) => b.ev(`(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r && { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
      const mouse = (type, x, y, { button = "none", modifiers = 0 } = {}) => b.send("Input.dispatchMouseEvent", {
        type, x, y, modifiers, button: type === "mouseMoved" ? "none" : button,
        buttons: type === "mousePressed" ? (button === "right" ? 2 : 1) : 0, clickCount: type === "mouseMoved" ? 0 : 1,
      });
      const press = async (at, opts) => { await mouse("mousePressed", at.x, at.y, opts); await mouse("mouseReleased", at.x, at.y, opts); };
      const walk = async (from, to, steps, each, pace = 16) => {
        for (let s = 1; s <= steps; s++) {
          const at = { x: Math.round(from.x + ((to.x - from.x) * s) / steps), y: Math.round(from.y + ((to.y - from.y) * s) / steps) };
          await mouse("mouseMoved", at.x, at.y);
          await sleep(pace);
          if (each) await each(at);
        }
      };
      // Both cards selected, so Align is offered; then the menu, by a real right-click.
      const a = await centre(`.item[data-item-id="${cards[0]}"]`), c = await centre(`.item[data-item-id="${cards[1]}"]`);
      await press(a, { button: "left" });
      await press(c, { button: "left", modifiers: 8 });
      const ROOT = `.context-menu:not(.context-submenu)`;
      const ALIGN = `${ROOT} > .context-sub > button[aria-haspopup="menu"]`;
      const findAlign = `[...document.querySelectorAll(${JSON.stringify(ALIGN)})].find((el) => el.textContent.trim().startsWith("Align"))`;
      const openMenu = async () => {
        await mouse("mouseMoved", c.x, c.y);
        await press(c, { button: "right" });
        await until(b, `!!${findAlign} && !${findAlign}.disabled`, "the item menu, with Align offered for two cards", 4000);
        const row = await b.ev(`(() => { const r = ${findAlign}.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), left: Math.round(r.left), h: Math.round(r.height) }; })()`);
        // Onto Align from its left, the way a hand arrives, and wait out the beat.
        await walk({ x: row.left + 4, y: row.y }, row, 4);
        await until(b, `${findAlign}.getAttribute("aria-expanded") === "true" && !!document.querySelector(".context-submenu")`, "hovering Align to open its submenu", 2000);
        return row;
      };
      const subOpen = `${findAlign}?.getAttribute("aria-expanded") === "true" && !!document.querySelector(".context-submenu")`;

      // 1. The diagonal: Align's centre to the submenu's LAST row, crossing the rows below Align.
      const row = await openMenu();
      const far = await b.ev(`(() => { const all = [...document.querySelectorAll(".context-submenu button")]; const el = all[all.length - 1]; el.setAttribute("data-journey-far", ""); const r = el.getBoundingClientRect(); return { x: Math.round(r.left + 12), y: Math.round(r.top + r.height / 2), label: el.textContent.trim() }; })()`);
      const crossed = new Set();
      const diagonalAt = Date.now();
      await walk(row, far, 24, async (at) => {
        const over = await b.ev(`(() => { const el = document.elementFromPoint(${at.x}, ${at.y})?.closest("button"); return el && !el.closest(".context-submenu") && el !== ${findAlign} ? el.textContent.trim() : null; })()`);
        if (over) crossed.add(over);
        if (!(await b.ev(subOpen))) throw new Error(`the submenu closed on the way to "${far.label}", at ${at.x},${at.y}${over ? ` over "${over}"` : ""}`);
      }, 50); // a hand's pace: ~1.3s, so the close grace (300ms) alone cannot carry it — only the aim can
      const diagonalMs = Date.now() - diagonalAt;
      if (crossed.size === 0) throw new Error("the diagonal never crossed another row — it proves nothing");
      await sleep(400); // past every grace and pause: arriving settles it, nothing pending reopens or closes
      if (!(await b.ev(subOpen))) throw new Error(`the submenu closed once the pointer reached "${far.label}"`);
      const hovered = await b.ev(`document.querySelector("[data-journey-far]")?.matches(":hover")`);
      if (!hovered) throw new Error(`"${far.label}" does not have the hover after the diagonal`);
      await press(far, { button: "left" });
      await until(b, `!document.querySelector(".context-menu")`, `choosing "${far.label}" to close the menu`, 2000);
      const edges = async () => cards.map((itemId) => { const it = runCli("--canvas", id, "show", itemId); return it.y + it.height; });
      const deadline = Date.now() + 6000;
      let bottoms = await edges();
      while (bottoms[0] !== bottoms[1] && Date.now() < deadline) { await sleep(200); bottoms = await edges(); }
      if (far.label !== "Bottom" || bottoms[0] !== bottoms[1]) throw new Error(`choosing "${far.label}" did not align the bottoms: ${JSON.stringify(bottoms)}`);

      // 2. Straight down from Align is choosing another row: the submenu lets go.
      await openMenu();
      const below = await b.ev(`(() => { const el = ${findAlign}.parentElement.nextElementSibling; const r = el.getBoundingClientRect(); return { x: ${row.x}, y: Math.round(r.top + r.height / 2), label: el.textContent.trim() }; })()`);
      const leftAt = Date.now();
      await walk(row, below, 4);
      await until(b, `!(${subOpen})`, `moving straight down onto "${below.label}" to close Align's submenu`, 1500);
      const letGoMs = Date.now() - leftAt;
      return { crossed: [...crossed], diagonalMs, chose: far.label, bottoms, straightDown: { onto: below.label, letGoMs } };
    },
  },
  {
    name: "copy-vary",
    /**
     * **Three voices for a screen, from the web** (copy-edit phase 2, journey
     * scene 1). Right-click a screen, *Vary the copy…*, ask for three: three
     * variations land under it, each `parent=` the screen and titled with its
     * stance, words only. This run's daemon holds no text model, so they are
     * placeholder voices and the notice bar says so — the path is the same.
     * Then *Choose this variation* on one: the screen now says that voice's
     * words, and the three are gone to the trash.
     */
    what: "Vary the copy… lands three parent= voices under a screen, and choosing one rewords the screen and clears the rest",
    async run(rig) {
      const { b } = rig;
      await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      const id = await makeCanvas(rig, "Acme copy vary");
      const runCli = (...args) => {
        const out = execFileSync(process.execPath, [cli, "--json", ...args], {
          cwd: rig.home, encoding: "utf8",
          env: { ...process.env, ISOCAN_HOME: rig.home, ISOCAN_PORT: new URL(rig.origin).port, ISOCAN_SESSION_ID: "acme-copy-journey", ISOCAN_HARNESS: "test", ISOCAN_TEXT_API_KEY: "" },
        });
        return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out;
      };
      runCli("identity", "--session", "--name", "Acme Copy CLI");
      const spot = await openSpot(rig, 300, 220);
      const world = await b.ev(`(() => {
        const w = document.querySelector(".world"), r = w.getBoundingClientRect();
        return { left: r.left, top: r.top, scale: parseFloat(getComputedStyle(w).getPropertyValue("--scale")) || 1 };
      })()`);
      const wx = Math.round((spot.x + 10 - world.left) / world.scale), wy = Math.round((spot.y + 10 - world.top) / world.scale);
      const file = path.join(rig.home, "acme-checkout.html");
      writeFileSync(file, `<!doctype html><html><head><title>Acme checkout</title></head><body><h1>Review your order</h1><p>Two items from Acme.</p><button>Pay now</button></body></html>`);
      const source = runCli("--canvas", id, "add", file, "--title", "Acme checkout", "--at", `${wx},${wy}`, "--size", "220x140").itemId;
      const sel = (itemId) => JSON.stringify(`.item[data-item-id="${itemId}"]`);
      await until(b, `!!document.querySelector(${sel(source)})`, "the screen to arrive on the canvas");

      const mouse = (type, x, y, button = "left") => b.send("Input.dispatchMouseEvent", { type, x, y, button, buttons: type === "mousePressed" ? (button === "right" ? 2 : 1) : 0, clickCount: 1 });
      /** A real right-click on a card's own frame (its lower-left edge: the middle is the page it shows), then a real press on a row by its words. */
      const fromMenu = async (itemId, label) => {
        const at = await b.ev(`(() => { const r = document.querySelector(${sel(itemId)}).getBoundingClientRect(); return { x: Math.round(r.left + 3), y: Math.round(r.bottom - 3) }; })()`);
        await mouse("mouseMoved", at.x, at.y, "none");
        await mouse("mousePressed", at.x, at.y, "right");
        await mouse("mouseReleased", at.x, at.y, "right");
        const row = `[...document.querySelectorAll(".context-menu button")].find((el) => el.textContent.trim().startsWith(${JSON.stringify(label)}))`;
        await until(b, `!!${row}`, `the item menu, offering "${label}"`, 4000);
        const r = await b.ev(`(() => { const r = ${row}.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
        await mouse("mousePressed", r.x, r.y);
        await mouse("mouseReleased", r.x, r.y);
      };
      const children = () => {
        const all = runCli("--canvas", id, "ls");
        return (Array.isArray(all) ? all : all.items ?? []).filter((i) => i.id !== source && String(i.title).startsWith("Acme checkout — "));
      };

      await fromMenu(source, "Vary the copy…");
      await until(b, `!!document.querySelector(".vary-copy input[type=number]")`, "the Vary the copy dialog");
      const asked = await b.ev(`document.querySelector(".vary-copy input[type=number]").value`);
      if (asked !== "3") throw new Error(`the dialog asks for ${asked} voices by default, not 3`);
      await rig.click(".vary-copy button[type=submit]", "the Write 3 voices button");
      await until(b, `!document.querySelector(".vary-copy")`, "the dialog to close once the voices land", 15000);
      let made = [];
      const deadline = Date.now() + 10000;
      while (made.length < 3 && Date.now() < deadline) { await sleep(200); made = children(); }
      if (made.length !== 3) throw new Error(`expected 3 voices under the screen, found ${made.length}: ${JSON.stringify(made.map((i) => i.title))}`);
      const shown = await b.ev(`document.querySelector(".notice, [role=status]")?.textContent ?? ""`);
      for (const v of made) {
        const item = runCli("--canvas", id, "show", v.id);
        if (item.properties?.parent !== source) throw new Error(`"${v.title}" is not parent=${source}: ${JSON.stringify(item.properties)}`);
        if (!item.properties?.copyStance) throw new Error(`"${v.title}" carries no stance`);
      }
      const original = runCli("--canvas", id, "words", source).strings.map((s) => s.text);
      const pick = made[0];
      const picked = runCli("--canvas", id, "words", pick.id).strings.map((s) => s.text);
      if (JSON.stringify(picked) === JSON.stringify(original)) throw new Error(`"${pick.title}" says the same words as the screen`);
      if (picked.length !== original.length) throw new Error(`"${pick.title}" has ${picked.length} strings, the screen ${original.length} — not words only`);

      await until(b, `!!document.querySelector(${sel(pick.id)})`, `"${pick.title}" to be drawn`);
      // The three arrive selected (a right-click inside a selection is a menu for all of it), so let them go first.
      await rig.press("Escape");
      await until(b, `document.querySelectorAll(".item.selected").length === 0`, "the new voices to be let go", 2000);
      await b.ev(`document.querySelector(${sel(pick.id)}).scrollIntoView?.({ block: "nearest" }), true`);
      await fromMenu(pick.id, "Choose this variation");
      let now = original;
      const folded = Date.now() + 10000;
      while (JSON.stringify(now) !== JSON.stringify(picked) && Date.now() < folded) { await sleep(200); now = runCli("--canvas", id, "words", source).strings.map((s) => s.text); }
      if (JSON.stringify(now) !== JSON.stringify(picked)) throw new Error(`choosing "${pick.title}" did not reword the screen: ${JSON.stringify(now)}`);
      const left = children();
      if (left.length !== 0) throw new Error(`the voices are still on the canvas after choosing: ${JSON.stringify(left.map((i) => i.title))}`);
      return { voices: made.map((v) => v.title), chose: pick.title, words: now, notice: shown };
    },
  },
  {
    name: "copy-mix",
    /**
     * **Side by side, then a mix** (copy-edit phase 3, journey scene 2). Vary
     * a screen into three voices from the web (placeholders: this run's
     * daemon holds no text model), open *Compare the copy…* from the screen's
     * menu — the screen and every voice, live, with a choice per string —
     * take the heading from the second voice and the button from the third,
     * and *Use this mix*: the screen says exactly those words as one new
     * version, and the voices are gone. One ⌘Z puts the words back and
     * brings all three voices back.
     */
    what: "Compare the copy… mixes the heading from one voice and the button from another into the screen, the voices cleared, and ⌘Z restores it all",
    async run(rig) {
      const { b } = rig;
      await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      const id = await makeCanvas(rig, "Acme copy mix");
      const runCli = (...args) => {
        const out = execFileSync(process.execPath, [cli, "--json", ...args], {
          cwd: rig.home, encoding: "utf8",
          env: { ...process.env, ISOCAN_HOME: rig.home, ISOCAN_PORT: new URL(rig.origin).port, ISOCAN_SESSION_ID: "acme-copy-mix-journey", ISOCAN_HARNESS: "test", ISOCAN_TEXT_API_KEY: "" },
        });
        return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out;
      };
      runCli("identity", "--session", "--name", "Acme Mix CLI");
      const spot = await openSpot(rig, 300, 220);
      const world = await b.ev(`(() => {
        const w = document.querySelector(".world"), r = w.getBoundingClientRect();
        return { left: r.left, top: r.top, scale: parseFloat(getComputedStyle(w).getPropertyValue("--scale")) || 1 };
      })()`);
      const wx = Math.round((spot.x + 10 - world.left) / world.scale), wy = Math.round((spot.y + 10 - world.top) / world.scale);
      const file = path.join(rig.home, "acme-mix.html");
      const HTML = `<!doctype html><html><head><title>Acme checkout</title></head><body><h1>Review your order</h1><p>Two items from Acme.</p><button>Pay now</button></body></html>`;
      writeFileSync(file, HTML);
      const source = runCli("--canvas", id, "add", file, "--title", "Acme mix", "--at", `${wx},${wy}`, "--size", "220x140").itemId;
      const sel = (itemId) => JSON.stringify(`.item[data-item-id="${itemId}"]`);
      await until(b, `!!document.querySelector(${sel(source)})`, "the screen to arrive on the canvas");

      const mouse = (type, x, y, button = "left") => b.send("Input.dispatchMouseEvent", { type, x, y, button, buttons: type === "mousePressed" ? (button === "right" ? 2 : 1) : 0, clickCount: 1 });
      /** A real right-click on a card's own frame, then a real press on a row by its words. */
      const fromMenu = async (itemId, label) => {
        const at = await b.ev(`(() => { const r = document.querySelector(${sel(itemId)}).getBoundingClientRect(); return { x: Math.round(r.left + 3), y: Math.round(r.bottom - 3) }; })()`);
        await mouse("mouseMoved", at.x, at.y, "none");
        await mouse("mousePressed", at.x, at.y, "right");
        await mouse("mouseReleased", at.x, at.y, "right");
        const row = `[...document.querySelectorAll(".context-menu button")].find((el) => el.textContent.trim().startsWith(${JSON.stringify(label)}))`;
        await until(b, `!!${row} && !${row}.disabled`, `the item menu, offering "${label}"`, 4000);
        const r = await b.ev(`(() => { const r = ${row}.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
        await mouse("mousePressed", r.x, r.y);
        await mouse("mouseReleased", r.x, r.y);
      };
      const voices = () => {
        const all = runCli("--canvas", id, "ls");
        return (Array.isArray(all) ? all : all.items ?? []).filter((i) => i.id !== source && String(i.title).startsWith("Acme mix — "));
      };
      const words = () => runCli("--canvas", id, "words", source).strings.map((s) => s.text);
      const original = words();

      // Three voices, from the web.
      await fromMenu(source, "Vary the copy…");
      await until(b, `!!document.querySelector(".vary-copy input[type=number]")`, "the Vary the copy dialog");
      await rig.click(".vary-copy button[type=submit]", "the Write 3 voices button");
      await until(b, `!document.querySelector(".vary-copy")`, "the dialog to close once the voices land", 15000);
      let made = [];
      const deadline = Date.now() + 10000;
      while (made.length < 3 && Date.now() < deadline) { await sleep(200); made = voices(); }
      if (made.length !== 3) throw new Error(`expected 3 voices under the screen, found ${made.length}`);
      await rig.press("Escape");
      await until(b, `document.querySelectorAll(".item.selected").length === 0`, "the new voices to be let go", 2000);

      // The compare: the screen and all three, live, side by side.
      await fromMenu(source, "Compare the copy…");
      await until(b, `document.querySelectorAll("[data-copy-compare] .cc-col iframe").length === 4`, "the screen and its three voices drawn side by side", 15000);
      const columns = await b.ev(`[...document.querySelectorAll("[data-copy-compare] .cc-col")].map((c) => ({ id: c.dataset.copyColumn, stance: c.querySelector("figcaption")?.textContent ?? "" }))`);
      if (columns[0].id !== source || columns.length !== 4) throw new Error(`the compare's columns are not the screen then its three voices: ${JSON.stringify(columns)}`);
      const rows = await b.ev(`[...document.querySelectorAll("[data-copy-compare] .cc-row[data-copy-address]")].map((r) => ({ address: r.dataset.copyAddress, role: r.querySelector(".cc-addr b").textContent }))`);
      const heading = rows.find((r) => r.role === "heading"), button = rows.find((r) => r.role === "button");
      if (!heading || !button) throw new Error(`the compare offers no heading and button rows: ${JSON.stringify(rows)}`);
      // The second and third voices (B and C): neither is the first column a default could fall into.
      const [, , second, third] = columns;
      const pick = async (address, itemId, what) => {
        const radio = `[data-copy-compare] .cc-row[data-copy-address="${address}"] input[value="${itemId}"]`;
        await b.ev(`document.querySelector(${JSON.stringify(radio)}).scrollIntoView({ block: "center" }), true`);
        await rig.click(radio, what);
        await until(b, `document.querySelector(${JSON.stringify(radio)}).checked`, `${what} to be picked`, 2000);
      };
      // What the mix should say: the screen's words, with the second voice's heading and the third's button.
      const said = (who, address) => runCli("--canvas", id, "words", who).strings.find((s) => s.address === address).text;
      const srcDeck = runCli("--canvas", id, "words", source).strings;
      const expected = srcDeck.map((s) => (s.address === heading.address ? said(second.id, heading.address) : s.address === button.address ? said(third.id, button.address) : s.text));
      const versionsBefore = runCli("--canvas", id, "show", source).versions.length;
      await pick(heading.address, second.id, `the heading from "${second.stance}"`);
      await pick(button.address, third.id, `the button from "${third.stance}"`);
      await rig.clickText("[data-copy-compare] .vc-bar button", "Use this mix", "the Use this mix button");
      await until(b, `!document.querySelector("[data-copy-compare]")`, "the compare to close once the mix lands", 15000);

      // The screen says exactly those words, as one new version; the voices are gone.
      let now = original;
      const settle = Date.now() + 10000;
      while (JSON.stringify(now) !== JSON.stringify(expected) && Date.now() < settle) { await sleep(200); now = words(); }
      if (JSON.stringify(now) !== JSON.stringify(expected)) throw new Error(`the mix did not land the picked words: ${JSON.stringify(now)}, wanted ${JSON.stringify(expected)}`);
      const versionsAfter = runCli("--canvas", id, "show", source).versions.length;
      if (versionsAfter !== versionsBefore + 1) throw new Error(`the mix is ${versionsAfter - versionsBefore} versions, not one`);
      if (voices().length !== 0) throw new Error(`the voices are still on the canvas after the mix: ${JSON.stringify(voices().map((i) => i.title))}`);
      const notice = await b.ev(`document.querySelector(".notice, [role=status]")?.textContent ?? ""`);

      // One ⌘Z: the screen's own words, and all three voices back.
      const MOD = process.platform === "darwin" ? 4 : 2;
      await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", modifiers: MOD, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90 });
      await b.send("Input.dispatchKeyEvent", { type: "keyUp", modifiers: MOD, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90 });
      let back = now;
      const undoBy = Date.now() + 10000;
      while ((JSON.stringify(back) !== JSON.stringify(original) || voices().length !== 3) && Date.now() < undoBy) { await sleep(200); back = words(); }
      if (JSON.stringify(back) !== JSON.stringify(original)) throw new Error(`⌘Z did not restore the screen's words: ${JSON.stringify(back)}`);
      if (voices().length !== 3) throw new Error(`⌘Z brought back ${voices().length} voices, not 3`);
      return { voices: columns.slice(1).map((c) => c.stance), heading: heading.address, button: button.address, mixed: now, notice, undone: back };
    },
  },
  {
    name: "copy-fit",
    /**
     * **The one that does not fit** (copy-edit phase 4, journey scene 3). A
     * narrow screen gets two voices written by an agent (`words vary --from`):
     * one keeps its words short, the other makes the heading a sentence. Open
     * *Compare the copy…* from the screen's menu: each frame measures its own
     * strings where it renders, core's rule judges them, and the long heading
     * is marked — in its row's cell for that voice, in the column's caption,
     * and outlined inside its frame — while the source's heading and the
     * short voice are not. The mark is a fact, not a refusal: the long
     * heading can still be picked.
     */
    what: "Compare the copy… marks a voice's heading that wraps past its two lines, in its row and inside its frame, and leaves the ones that fit alone",
    async run(rig) {
      const { b } = rig;
      await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      const id = await makeCanvas(rig, "Acme copy fit");
      const runCli = (...args) => {
        const out = execFileSync(process.execPath, [cli, "--json", ...args], {
          cwd: rig.home, encoding: "utf8",
          env: { ...process.env, ISOCAN_HOME: rig.home, ISOCAN_PORT: new URL(rig.origin).port, ISOCAN_SESSION_ID: "acme-copy-fit-journey", ISOCAN_HARNESS: "test", ISOCAN_TEXT_API_KEY: "" },
        });
        return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out;
      };
      runCli("identity", "--session", "--name", "Acme Fit CLI");
      const spot = await openSpot(rig, 300, 220);
      const world = await b.ev(`(() => {
        const w = document.querySelector(".world"), r = w.getBoundingClientRect();
        return { left: r.left, top: r.top, scale: parseFloat(getComputedStyle(w).getPropertyValue("--scale")) || 1 };
      })()`);
      const wx = Math.round((spot.x + 10 - world.left) / world.scale), wy = Math.round((spot.y + 10 - world.top) / world.scale);
      const file = path.join(rig.home, "acme-fit.html");
      const HTML = `<!doctype html><html><head><title>Acme checkout</title><style>body{margin:12px;font:16px/1.3 sans-serif}h1{font-size:24px;margin:0 0 8px}</style></head><body><h1>Review your order</h1><p>Two items from Acme.</p><button>Pay now</button></body></html>`;
      writeFileSync(file, HTML);
      const source = runCli("--canvas", id, "add", file, "--title", "Acme fit", "--at", `${wx},${wy}`, "--size", "240x160").itemId;
      const sel = (itemId) => JSON.stringify(`.item[data-item-id="${itemId}"]`);
      await until(b, `!!document.querySelector(${sel(source)})`, "the screen to arrive on the canvas");

      // Two voices by an agent: a short one, and one whose heading is a sentence.
      const deck = runCli("--canvas", id, "words", source).strings;
      const heading = deck.find((s) => s.role === "heading"), button = deck.find((s) => s.role === "button");
      const LONG = "Before you pay, take one more careful look at every item in your Acme order today";
      const voicesFile = path.join(rig.home, "acme-fit-voices.json");
      writeFileSync(voicesFile, JSON.stringify({ variants: [
        { stance: "Short", why: "Fewer words.", edits: [{ address: heading.address, to: "Your order" }, { address: button.address, to: "Pay" }] },
        { stance: "Thorough", why: "Asks for care.", edits: [{ address: heading.address, to: LONG }] },
      ] }));
      const made = runCli("--canvas", id, "words", "vary", source, "--from", voicesFile).variants;
      const [short, long] = made.map((v) => v.itemId);
      await until(b, `!!document.querySelector(${sel(long)})`, "the voices to arrive on the canvas");

      // Compare the copy…, from the screen's menu: a real right-click, a real press.
      const mouse = (type, x, y, button = "left") => b.send("Input.dispatchMouseEvent", { type, x, y, button, buttons: type === "mousePressed" ? (button === "right" ? 2 : 1) : 0, clickCount: 1 });
      const at = await b.ev(`(() => { const r = document.querySelector(${sel(source)}).getBoundingClientRect(); return { x: Math.round(r.left + 3), y: Math.round(r.bottom - 3) }; })()`);
      await mouse("mouseMoved", at.x, at.y, "none");
      await mouse("mousePressed", at.x, at.y, "right");
      await mouse("mouseReleased", at.x, at.y, "right");
      const row = `[...document.querySelectorAll(".context-menu button")].find((el) => el.textContent.trim().startsWith("Compare the copy…"))`;
      await until(b, `!!${row} && !${row}.disabled`, `the item menu, offering "Compare the copy…"`, 4000);
      const r = await b.ev(`(() => { const r = ${row}.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
      await mouse("mousePressed", r.x, r.y);
      await mouse("mouseReleased", r.x, r.y);
      await until(b, `document.querySelectorAll("[data-copy-compare] .cc-col iframe").length === 3`, "the screen and its two voices drawn side by side", 15000);

      // The long heading is marked in its row, in the long voice's cell — and nowhere else.
      const cell = (itemId) => `document.querySelector('[data-copy-compare] .cc-row[data-copy-address="${heading.address}"] input[value="${itemId}"]')?.closest("label")`;
      await until(b, `${cell(long)}?.dataset.fit === "over"`, "the long heading to be marked as not fitting", 15000);
      const marked = await b.ev(`(() => {
        const c = ${cell(long)};
        return { note: c.querySelector(".cc-fit")?.textContent ?? "", others: [...document.querySelectorAll('[data-copy-compare] [data-fit="over"]')].map((el) => el.querySelector("input")?.value), captions: [...document.querySelectorAll("[data-copy-compare] .cc-col figcaption")].map((f) => f.textContent) };
      })()`);
      if (!/^Does not fit: \w+ lines in a two-line heading/.test(marked.note)) throw new Error(`the long heading's cell does not say why it does not fit: ${JSON.stringify(marked.note)}`);
      if (JSON.stringify(marked.others) !== JSON.stringify([long])) throw new Error(`strings other than the long heading are marked: ${JSON.stringify(marked.others)}`);
      if (!marked.captions[2]?.includes("1 string does not fit") || marked.captions[0]?.includes("not fit") || marked.captions[1]?.includes("not fit")) throw new Error(`the captions do not say which voice has a string that does not fit: ${JSON.stringify(marked.captions)}`);
      if (await b.ev(`${cell(short)}?.dataset.fit ?? "fits"`) !== "fits") throw new Error("the short heading is marked as not fitting");

      // Inside the frame: the long voice's heading is outlined in place. The
      // compare's sandboxed srcdoc frames are out-of-process, so each is read
      // through its own target: attached, asked, detached.
      const { targetInfos } = await b.send("Target.getTargets");
      const srcdocs = targetInfos.filter((t) => t.type === "iframe" && t.url === "about:srcdoc");
      const inFrames = [];
      let mid = 0;
      for (const t of srcdocs) {
        const { sessionId } = await b.send("Target.attachToTarget", { targetId: t.targetId, flatten: false });
        const ask = ++mid;
        const answer = new Promise((resolve) => {
          const off = b.on("Target.receivedMessageFromTarget", (m) => {
            const msg = JSON.parse(m.message);
            if (m.sessionId === sessionId && msg.id === ask) { off(); resolve(msg.result?.result?.value ?? []); }
          });
        });
        await b.send("Target.sendMessageToTarget", { sessionId, message: JSON.stringify({ id: ask, method: "Runtime.evaluate", params: { returnByValue: true, expression: `[...document.querySelectorAll("[data-isocan-fit=over]")].map((el) => ({ tag: el.tagName, why: el.getAttribute("data-isocan-fit-why"), words: el.textContent.trim() }))` } }) });
        inFrames.push(...(await answer));
        await b.send("Target.detachFromTarget", { sessionId });
      }
      if (srcdocs.length < 3) throw new Error(`expected the compare's three frames as their own targets, found ${srcdocs.length}`);
      if (inFrames.length !== 1 || inFrames[0].words !== LONG || inFrames[0].tag !== "H1") throw new Error(`inside the frames, the marks are not the long heading alone: ${JSON.stringify(inFrames)}`);

      // A fact, not a refusal: the long heading can still be picked.
      const radio = `[data-copy-compare] .cc-row[data-copy-address="${heading.address}"] input[value="${long}"]`;
      await b.ev(`document.querySelector(${JSON.stringify(radio)}).scrollIntoView({ block: "center" }), true`);
      await rig.click(radio, "the long heading");
      await until(b, `document.querySelector(${JSON.stringify(radio)}).checked`, "the long heading to be picked", 2000);
      const screenshot = path.join(tmpdir(), `isocan-copy-fit-${Date.now()}.png`);
      writeFileSync(screenshot, Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
      return { screenshot, heading: heading.address, note: marked.note, captions: marked.captions, inFrame: inFrames[0], voices: { short, long } };
    },
  },
  {
    name: "copy-voice",
    /**
     * **A voice for the whole flow, from the web** (copy-edit phase 5,
     * journey scene 5). A stub flow, fleshed, with its prototype; right-click
     * a screen, *Choose a voice…*, write three (placeholders: this run's
     * daemon holds no text model), each previewed on the flow's first two
     * screens beside the flow as it reads now; *Use this voice* on the second:
     * every screen of the flow says that voice's words, landed as one group.
     * One ⌘Z puts every word back.
     */
    what: "Choose a voice… on a fleshed flow previews three voices on its first two screens, the second lands on every screen, and one ⌘Z restores every word",
    async run(rig) {
      const { b } = rig;
      await b.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
      const id = await makeCanvas(rig, "Acme copy voice");
      const runCli = (...args) => {
        const out = execFileSync(process.execPath, [cli, "--json", ...args], {
          cwd: rig.home, encoding: "utf8",
          env: { ...process.env, ISOCAN_HOME: rig.home, ISOCAN_PORT: new URL(rig.origin).port, ISOCAN_SESSION_ID: "acme-copy-voice-journey", ISOCAN_HARNESS: "test", ISOCAN_TEXT_API_KEY: "" },
        });
        return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out;
      };
      runCli("identity", "--session", "--name", "Acme Voice CLI");
      runCli("--canvas", id, "wire", "a delivery app for Acme couriers — sign in, see today's parcels, open one", "--answerer", "stub", "--seed", "4", "--no-ask");
      // The flow's screens with words, read the CLI's way without writing anything (a preview).
      const flow = runCli("--canvas", id, "wire", "voice", "--answerer", "stub", "--n", "1", "--save", path.join(rig.home, "acme-voice-probe.json"));
      const screens = flow.screens;
      if (!Array.isArray(screens) || screens.length < 2) throw new Error(`the stub flow has ${screens?.length} screens with words, not a flow: ${JSON.stringify(flow)}`);
      const words = () => Object.fromEntries(screens.map((s) => [s, runCli("--canvas", id, "words", s).strings.map((x) => x.text)]));
      const original = words();
      const sel = (itemId) => JSON.stringify(`.item[data-item-id="${itemId}"]`);
      await until(b, `${JSON.stringify(screens)}.every((s) => !!document.querySelector(\`.item[data-item-id="\${s}"]\`))`, "the flow's screens to arrive on the canvas", 15000);
      // Zoom to fit (⇧1), so the first screen is on screen to right-click.
      await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", modifiers: 8, key: "!", code: "Digit1", windowsVirtualKeyCode: 49 });
      await b.send("Input.dispatchKeyEvent", { type: "keyUp", modifiers: 8, key: "!", code: "Digit1", windowsVirtualKeyCode: 49 });
      await sleep(800);

      const mouse = (type, x, y, button = "left") => b.send("Input.dispatchMouseEvent", { type, x, y, button, buttons: type === "mousePressed" ? (button === "right" ? 2 : 1) : 0, clickCount: 1 });
      const fromMenu = async (itemId, label) => {
        const at = await b.ev(`(() => { const r = document.querySelector(${sel(itemId)}).getBoundingClientRect(); return { x: Math.round(r.left + 3), y: Math.round(r.bottom - 3) }; })()`);
        await mouse("mouseMoved", at.x, at.y, "none");
        await mouse("mousePressed", at.x, at.y, "right");
        await mouse("mouseReleased", at.x, at.y, "right");
        const row = `[...document.querySelectorAll(".context-menu button")].find((el) => el.textContent.trim().startsWith(${JSON.stringify(label)}))`;
        await until(b, `!!${row} && !${row}.disabled`, `the item menu, offering "${label}"`, 6000);
        const r = await b.ev(`(() => { const r = ${row}.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
        await mouse("mousePressed", r.x, r.y);
        await mouse("mouseReleased", r.x, r.y);
      };

      await fromMenu(screens[0], "Choose a voice…");
      await until(b, `!!document.querySelector("[data-choose-voice] .cv-bar input[type=number]")`, "the Choose a voice panel");
      const asked = await b.ev(`document.querySelector("[data-choose-voice] .cv-bar input[type=number]").value`);
      if (asked !== "3") throw new Error(`the panel asks for ${asked} voices by default, not 3`);
      await rig.click("[data-choose-voice] .cv-bar button[type=submit]", "the Write 3 voices button");
      // Three voices and the flow as it reads now, each two screens tall.
      await until(b, `document.querySelectorAll("[data-choose-voice] .cc-col").length === 4 && document.querySelectorAll("[data-choose-voice] .cc-col iframe").length === 8`, "the flow now and three voices, each on two screens", 15000);
      const columns = await b.ev(`[...document.querySelectorAll("[data-choose-voice] .cc-col")].map((c) => ({ k: c.dataset.voiceColumn, captions: [...c.querySelectorAll("figcaption")].map((f) => f.textContent), why: c.querySelector(".cc-why")?.textContent ?? "" }))`);
      if (columns[0].k !== "now") throw new Error(`the first column is not the flow now: ${JSON.stringify(columns)}`);
      for (const c of columns.slice(1)) if (!/^Placeholder [ABC] · /.test(c.captions[0] ?? "") || !c.why) throw new Error(`a voice's column does not say its stance and why: ${JSON.stringify(c)}`);
      const notice = await b.ev(`document.querySelector(".notice, [role=status]")?.textContent ?? ""`);
      const versionsBefore = Object.fromEntries(screens.map((s) => [s, runCli("--canvas", id, "show", s).versions.length]));

      await rig.click(`[data-choose-voice] [data-voice-column="2"] button`, "voice 2's Use this voice");
      await until(b, `!document.querySelector("[data-choose-voice]")`, "the panel to close once the voice lands", 15000);
      // Every screen of the flow says voice 2's words, one new version each.
      let now = original;
      const settle = Date.now() + 10000;
      const allChanged = (w) => screens.every((s) => JSON.stringify(w[s]) !== JSON.stringify(original[s]));
      while (!allChanged(now) && Date.now() < settle) { await sleep(200); now = words(); }
      const same = screens.filter((s) => JSON.stringify(now[s]) === JSON.stringify(original[s]));
      if (same.length) throw new Error(`${same.length} of ${screens.length} screens still say their old words after the voice landed: ${JSON.stringify(same)}`);
      for (const s of screens) if (!now[s].some((t) => /Placeholder .* B$/.test(t))) throw new Error(`screen ${s} does not say voice 2's words: ${JSON.stringify(now[s])}`);
      for (const s of screens) {
        const n = runCli("--canvas", id, "show", s).versions.length;
        if (n !== versionsBefore[s] + 1) throw new Error(`screen ${s} took ${n - versionsBefore[s]} versions, not one`);
      }

      // One ⌘Z: every word of every screen back.
      const MOD = process.platform === "darwin" ? 4 : 2;
      await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", modifiers: MOD, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90 });
      await b.send("Input.dispatchKeyEvent", { type: "keyUp", modifiers: MOD, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90 });
      let back = now;
      const undoBy = Date.now() + 10000;
      while (JSON.stringify(back) !== JSON.stringify(original) && Date.now() < undoBy) { await sleep(200); back = words(); }
      if (JSON.stringify(back) !== JSON.stringify(original)) throw new Error(`one ⌘Z did not restore every screen's words: ${JSON.stringify(back)}`);
      return { screens: screens.length, voices: columns.slice(1).map((c) => c.captions[0]), notice, chose: columns[2].captions[0] };
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
    name: "pet-follows",
    /**
     * **Pets follow — pets phase 2, scenes 2 to 4, walked.**
     *
     * A guard can prove `petsToBring` decides; only the running app proves an
     * ARRIVAL acts on it: the page, after the snapshot, once, sending the
     * invite and writing one line. So: Theo ticks *Follows me* on Scout in
     * the agents panel, opens a second canvas, and Scout stands there with
     * the thread saying so; a reload says nothing twice; a removal is
     * respected; and with following off, a third canvas stays Scout-free.
     * Every read-back is the terminal's — the other surface, asked
     * independently.
     */
    what: "a pet comes along to a canvas its owner opens, once, and stops when following is off",
    async run(rig) {
      const runCli = (...args) =>
        execFileSync(process.execPath, [cli, ...args], {
          cwd: rig.home,
          encoding: "utf8",
          env: { ...process.env, ISOCAN_HOME: rig.home, ISOCAN_PORT: new URL(rig.origin).port },
        });
      const poll = async (read, what, ms = 10_000) => {
        const deadline = Date.now() + ms;
        for (;;) {
          if (read()) return;
          if (Date.now() > deadline) throw new Error(`never became true: ${what}`);
          await sleep(250);
        }
      };
      const standing = (canvasId) =>
        (JSON.parse(runCli("--json", "--canvas", canvasId, "who")).standing ?? []).map((row) => row.actor.name);
      const lines = (canvasId) =>
        JSON.stringify(JSON.parse(runCli("--json", "--canvas", canvasId, "comment", "ls"))).split("Scout came with Theo").length - 1;
      const open = async (canvasId, what) => {
        await rig.b.send("Page.navigate", { url: `${rig.origin}/p/${canvasId}` });
        await sleep(1500);
        await until(rig.b, `!!document.querySelector(".world")`, what);
      };

      writeFileSync(
        path.join(rig.home, "identity.json"),
        JSON.stringify({ id: "usr_pet_theo", name: "Theo", createdAt: new Date().toISOString() }),
      );
      // Scout is a record — an actor nothing runs. A pet's arrival asks
      // nothing of any machine, so none is needed to watch one arrive.
      runCli("bench", "add", "Scout", "--actor", "usr_journey_scout", "--harness", "pi");
      const [one, two, three] = ["Acme pets one", "Acme pets two", "Acme pets three"].map(
        (title) => JSON.parse(runCli("--json", "canvas", "create", title)).canvasId,
      );
      const { address } = JSON.parse(runCli("--json", "--canvas", one, "pass"));
      await rig.b.ev(`(() => { localStorage.clear(); return true; })()`);
      await rig.b.send("Page.navigate", { url: address });
      await sleep(2500);
      await until(rig.b, `!!document.querySelector(".world")`, "the canvas to open for Theo");

      // Scene 2: Follows me, in the agents panel — one fact on one row.
      await rig.click('button[aria-label="More"]', "the ··· menu");
      await rig.clickText(".menu-entry,[role=menuitem],.ctx-entry", "Agents", "the Agents entry");
      await until(rig.b, `!!document.querySelector(".tray-bench .bench-follows input")`, "Follows me on Scout's row");
      await rig.click(".tray-bench .bench-follows input", "Follows me");
      await poll(() => JSON.parse(runCli("--json", "bench")).bench.find((row) => row.name === "Scout")?.follows === true, "the bench row to say Scout follows");
      // Ticking it invites Scout nowhere — not even here.
      if (standing(one).includes("Scout")) throw new Error("ticking Follows me brought Scout to the canvas it was ticked on");

      // Scene 3: it follows, and the thread says so — once.
      await open(two, "the second canvas to open");
      await poll(() => standing(two).includes("Scout"), "Scout to stand on the second canvas");
      await poll(() => lines(two) === 1, "the thread to say Scout came with Theo");
      await rig.b.send("Page.reload", {});
      await sleep(1500);
      await until(rig.b, `!!document.querySelector(".world")`, "the second canvas to reopen");
      await sleep(3000);
      if (lines(two) !== 1) throw new Error(`a reload said it again: ${lines(two)} lines`);

      // A removal is the room's word: withdrawn from the second canvas, Scout
      // does not walk back on when Theo reopens it.
      runCli("--canvas", two, "rc", "remove", "Scout");
      await open(one, "the first canvas to reopen");
      await open(two, "the second canvas, after the removal");
      await sleep(3000);
      if (standing(two).includes("Scout")) throw new Error("Scout came back onto a canvas it was removed from");

      // The first canvas was opened again with following on: Scout came there
      // too, which is the feature rather than a leak.
      await poll(() => standing(one).includes("Scout"), "Scout to follow Theo back to the first canvas");

      // Scene 4: off. A new canvas stays Scout-free, and where it stands it stays.
      runCli("bench", "follow", "Scout", "--off");
      await open(three, "the third canvas to open");
      await sleep(3000);
      if (standing(three).includes("Scout")) throw new Error("Scout followed with following off");
      if (lines(three) !== 0) throw new Error("the third canvas was told Scout came");
      if (!standing(one).includes("Scout")) throw new Error("turning following off sent Scout away");

      const errors = rig.b.takeErrors();
      if (errors.length > 0) throw new Error(`the page threw: ${errors[0]}`);
      return { lines: lines(two), standingOn: { one: standing(one), two: standing(two), three: standing(three) } };
    },
  },
  {
    name: "summons-receipt",
    /**
     * **A summons you can see — #197 phase 1, walked.**
     *
     * Naming an agent used to produce a reply or silence, and the thread under
     * the ask read "Nobody is parked" whether the agent was named or not. The
     * receipt is core's (`threadSummonses` → `summonsLine`), and a guard can
     * prove the words; only the running app proves they reach the thread,
     * and that they turn over when the answer lands.
     *
     * The agent's turn is the terminal speaking as Percy, not a model: what is
     * under test is the receipt, and a reply is a reply whoever typed it.
     * Nothing is parked, so nothing here may claim Percy picked it up.
     */
    what: "an ask that names an agent says 'asked', then 'answered' once the agent replies",
    async run(rig) {
      const env = { ...process.env, ISOCAN_HOME: rig.home, ISOCAN_PORT: new URL(rig.origin).port };
      const runCli = (args, extra = {}) =>
        execFileSync(process.execPath, [cli, ...args], { cwd: rig.home, encoding: "utf8", env: { ...env, ...extra } });

      writeFileSync(
        path.join(rig.home, "identity.json"),
        JSON.stringify({ id: "usr_receipt_theo", name: "Theo", createdAt: new Date().toISOString() }),
      );
      runCli(["bench", "add", "Percy", "--actor", "usr_receipt_percy", "--harness", "pi"]);
      const id = JSON.parse(runCli(["--json", "canvas", "create", "Receipt journey"])).canvasId;
      const { address } = JSON.parse(runCli(["--json", "--canvas", id, "pass"]));
      await rig.b.ev(`(() => { localStorage.clear(); return true; })()`);
      await rig.b.send("Page.navigate", { url: address });
      await sleep(2500);
      await until(rig.b, `!!document.querySelector(".world")`, "the canvas to open for Theo");

      // Percy stands here — the bench's Join, the same door bench-join walks.
      await rig.click('button[aria-label="More"]', "the ··· menu");
      await rig.clickText(".menu-entry,[role=menuitem],.ctx-entry", "Agents", "the Agents entry");
      await until(rig.b, `!!document.querySelector(".tray-bench .tray-bench-join")`, "Percy's Join");
      await rig.click(".tray-bench .tray-bench-join", "Percy's Join");
      await until(
        rig.b,
        `[...document.querySelectorAll(".agents-body")].some(b => b.textContent.includes("Percy"))`,
        "Percy to stand on this canvas",
      );

      // Theo asks, from the terminal, in the Chat.
      const ask = JSON.parse(runCli(["--json", "--canvas", id, "comment", "add", "@Percy tidy the header", "--at", "200,200"]));
      const threadId = ask.threadId ?? ask.thread?.id;
      if (!threadId) throw new Error(`comment add named no thread: ${JSON.stringify(ask)}`);
      runCli(["--canvas", id, "comment", "main", threadId]);
      await rig.click('button[aria-label="More"]', "the ··· menu");
      await rig.clickText(".menu-entry,[role=menuitem],.ctx-entry", "Chat", "the Chat entry");
      const receipt = `[...document.querySelectorAll(".onit-row")].map(r => r.textContent).join(" | ")`;
      await until(rig.b, `${receipt}.includes("asked Percy")`, "the receipt to say 'asked Percy' under the ask");
      const asked = await rig.b.ev(receipt);
      if (/picked it up|is on it|Nobody is parked/.test(asked)) {
        throw new Error(`the receipt claims more (or less) than was asked: ${asked}`);
      }

      // Percy answers — the terminal, speaking as the agent's own session.
      const percy = { ISOCAN_SESSION_ID: "journey-percy" };
      runCli(["identity", "--as", "usr_receipt_percy", "--name", "Percy"], percy);
      runCli(["--canvas", id, "comment", "reply", threadId, "Done — the header is tidy."], percy);
      await until(rig.b, `${receipt}.includes("Percy answered (")`, "the receipt to turn over to 'Percy answered'", 10_000);
      const errors = rig.b.takeErrors();
      if (errors.length > 0) throw new Error(`the thread threw: ${errors[0]}`);
    },
  },
  {
    name: "panels",
    /** The bug: the Personas panel's header collapsed to `display: block` and
     *  its icon sat on its own title, while every test passed. */
    what: "every dock panel opens with a laid-out header",
    /**
     * Two things changed under this journey and it failed on both (found 26
     * Sep 2026). The ··· menu awaits `menuentries.tsx` before it draws, and
     * `clickText` does not wait, so the rows are waited for first. And the
     * menu offers only panels that are CLOSED — a never-chosen canvas opens
     * with the Chat since 24 Sep, so there is no "Chat" row to press. That is
     * the design, not a gap: a panel that is not offered must be the one
     * already on screen, and its header is checked exactly like the others.
     * Neither side is let off — a panel neither offered nor open fails.
     */
    async run(rig) {
      await makeCanvas(rig, "Panel journey");
      const menuRows = `.context-menu [role=menuitem]`;
      for (const name of ["Chat", "Files", "Agents", "Context", "Personas"]) {
        await rig.click('button[aria-label="More"]', "the ··· menu");
        await until(rig.b, `document.querySelectorAll(${JSON.stringify(menuRows)}).length > 0`, "the ··· menu's rows");
        const offered = await rig.b.ev(
          `[...document.querySelectorAll(${JSON.stringify(menuRows)})].some(e => e.textContent.trim().startsWith(${JSON.stringify(name)}))`,
        );
        if (offered) {
          await rig.clickText(menuRows, name, `the ${name} entry`);
        } else {
          await rig.press("Escape");
          await until(rig.b, `!document.querySelector(".context-menu")`, "Escape to close the ··· menu");
        }
        await until(
          rig.b,
          `[...document.querySelectorAll(".panel-head b")].some(b => b.textContent.trim() === ${JSON.stringify(name)})`,
          offered ? `the ${name} panel to open` : `the ${name} panel — not offered, so it must already be open`,
        );
        const head = await rig.b.ev(`(() => {
          const h = [...document.querySelectorAll(".panel-head")].find(h => h.querySelector("b")?.textContent.trim() === ${JSON.stringify(name)});
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
    name: "chat-bottom",
    /**
     * **The Chat moved to the bottom, and back** (8 Oct 2026).
     *
     * Dion: grab the left bar's Chat, move it to the centre bottom, where it
     * pops its messages up above the input and minimizes to just the input.
     * Every half of that is a pointer and a layout, which no source guard can
     * see — so it is walked: a real drag by the header (CDP mouse events, with
     * the drop zones checked mid-drag), a real send read back from the
     * terminal, Esc and ⌘J, a reload, and a drag home that rail-pans as before.
     *
     * Screenshots of the three states land in `$CHAT_SHOTS` when it is set.
     */
    what: "drag the Chat to the bottom: a minimized bar that sends, expands above, survives reload, and drags home",
    async run(rig) {
      const { b } = rig;
      const shots = process.env.CHAT_SHOTS;
      const shot = async (name) => {
        if (!shots) return;
        await sleep(400);
        const png = await b.send("Page.captureScreenshot", { format: "png" });
        writeFileSync(path.join(shots, `chat-${name}.png`), Buffer.from(png.data, "base64"));
      };
      const env = { ...process.env, ISOCAN_HOME: rig.home, ISOCAN_PORT: new URL(rig.origin).port, ISOCAN_SESSION_ID: "chat-bottom-ada", ISOCAN_HARNESS: "test" };
      const runCli = (...args) => execFileSync(process.execPath, [cli, ...args], { cwd: rig.home, encoding: "utf8", env });
      const drag = async (from, to, check) => {
        await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: from.x, y: from.y, button: "left", buttons: 1, clickCount: 1 });
        // The drag module arrives on the press; give it the moment it takes.
        await sleep(300);
        for (let i = 1; i <= 12; i++) {
          const x = Math.round(from.x + ((to.x - from.x) * i) / 12), y = Math.round(from.y + ((to.y - from.y) * i) / 12);
          await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "left", buttons: 1 });
          await sleep(30);
        }
        await sleep(150);
        if (check) await check();
        await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: to.x, y: to.y, button: "left", buttons: 0, clickCount: 1 });
        await sleep(500);
      };
      // The docked Chat's header — the bar draws the same Chat, header hidden.
      const tx = () => b.ev(`(() => { const m = /translate\\(\\s*(-?[\\d.]+)px/.exec(document.querySelector(".world")?.style.transform ?? ""); return m ? Number(m[1]) : null; })()`);
      const center = (sel) => b.ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect(); return r ? { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } : null; })()`);

      await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
      try {
        await b.ev(`(() => { localStorage.removeItem("isocan.chatAt"); return true; })()`);
        const id = await makeCanvas(rig, "Chat bar journey");
        // Today's dock, exactly: a never-chosen canvas opens with the Chat on the left.
        await until(b, `[...document.querySelectorAll(".main-panel > .panel-head")].some(h => !h.closest(".chat-bar")) && !document.querySelector(".chat-bar")`, "the Chat docked on the left");
        await shot("left");
        const leftTx = await tx();

        // Drag it by its header to the bottom centre. The slots show, and the
        // bottom one is the hot one before the release.
        const head = await b.ev(`(() => { const r = document.querySelector(".main-panel > .panel-head b").getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
        const vw = await b.ev(`innerWidth`), vh = await b.ev(`innerHeight`);
        await drag(head, { x: Math.round(vw / 2), y: vh - 50 }, async () => {
          const zones = await b.ev(`[...document.querySelectorAll(".chat-zone")].map(z => z.dataset.at + (z.classList.contains("hot") ? ":hot" : ""))`);
          if (!zones.includes("left") || !zones.includes("bottom:hot")) throw new Error(`mid-drag the slots read ${JSON.stringify(zones)}, not the left dock and a hot bottom slot`);
        });
        await until(b, `!!document.querySelector(".chat-bar")`, "the Chat bar at the bottom");
        const bar = await b.ev(`(() => {
          const r = document.querySelector(".chat-bar").getBoundingClientRect();
          return { mid: r.left + r.width / 2, gap: innerHeight - r.bottom, width: r.width, vw: innerWidth,
                   list: !!document.querySelector(".chat-bar .main-scroll")?.getClientRects().length,
                   input: !!document.querySelector(".chat-bar form textarea"),
                   panels: document.querySelectorAll(".main-panel").length,
                   inBar: !!document.querySelector(".chat-bar > .main-panel"),
                   stored: localStorage.getItem("isocan.chatAt") };
        })()`);
        if (Math.abs(bar.mid - bar.vw / 2) > 2) throw new Error(`the bar is not centred: its middle is at ${bar.mid} of ${bar.vw}`);
        if (bar.gap < 8 || bar.gap > 40) throw new Error(`the bar is not at the bottom edge: ${bar.gap}px above it`);
        if (bar.width > 720) throw new Error(`the bar is ${bar.width}px wide, past its 720px`);
        if (bar.list) throw new Error("the bar opened with its message list showing — it should start minimized");
        if (!bar.input) throw new Error("the minimized bar has no input");
        if (bar.panels !== 1 || !bar.inBar) throw new Error("the left dock still holds a Chat beside the bar");
        if (bar.stored !== "bottom") throw new Error(`the placement was not remembered (${bar.stored})`);
        const bottomTx = await tx();
        if (!(bottomTx < leftTx - 100)) throw new Error(`the canvas did not pan back from under the dock (${leftTx} → ${bottomTx})`);
        await shot("bottom-minimized");

        // Type and send, from the bar. Focusing the input opens the list.
        await rig.click(".chat-bar form textarea", "the bar's input");
        await until(b, `!!document.querySelector(".chat-bar.open .main-scroll")`, "focusing the input to open the bar");
        await rig.type("Acme bar hello");
        await rig.press("Enter");
        await until(b, `[...document.querySelectorAll(".chat-bar .main-msgs .comment")].some(c => c.textContent.includes("Acme bar hello"))`, "the message in the bar's list");
        const order = await b.ev(`(() => { const l = document.querySelector(".chat-bar .main-scroll").getBoundingClientRect(), f = document.querySelector(".chat-bar form").getBoundingClientRect(); return l.bottom <= f.top + 1; })()`);
        if (!order) throw new Error("the message list is not above the input");
        // The terminal reads it back, as Ada — who speaks next.
        runCli("identity", "--session", "--name", "Ada");
        const posted = runCli("--json", "--canvas", id, "comment", "ls");
        if (!posted.includes("Acme bar hello")) throw new Error("the terminal does not see the message the bar sent");

        // Esc puts it down to the input alone.
        await rig.press("Escape");
        await until(b, `!document.querySelector(".chat-bar.open") && !document.querySelector(".chat-bar .main-scroll")?.getClientRects().length`, "Esc to minimize the bar");

        // Somebody else speaks while it is down: a count and one line of it.
        runCli("--canvas", id, "notify", "Acme header is ready to look at");
        await until(b, `/Acme header is ready/.test(document.querySelector(".chat-bar-news .chat-bar-preview")?.textContent ?? "") && document.querySelector(".chat-bar-unread")?.textContent === "1"`, "the minimized bar to show one unread and its line", 10_000);

        // ▴ opens it, above the input, showing both messages.
        await rig.click(`.chat-bar-controls button[aria-label="Show the Chat's messages"]`, "the ▴");
        await until(b, `!!document.querySelector(".chat-bar.open .main-scroll") && document.querySelector(".chat-bar .main-msgs")?.textContent.includes("Acme header is ready")`, "▴ to open the bar on the messages");
        await until(b, `!document.querySelector(".chat-bar-news")`, "opening to read the unread");
        // The messages run the bar's full width; only the composer row makes
        // room for the controls (8 Oct 2026: "a lot of blank space on the right").
        const span = await b.ev(`(() => {
          const bar = document.querySelector(".chat-bar").getBoundingClientRect();
          const list = document.querySelector(".chat-bar .main-scroll").getBoundingClientRect();
          const input = document.querySelector(".chat-bar form").getBoundingClientRect();
          const controls = document.querySelector(".chat-bar-controls").getBoundingClientRect();
          return { gap: Math.round(bar.right - list.right), overlap: Math.round(input.right - controls.left) };
        })()`);
        if (span.gap > 2) throw new Error(`the open bar's messages stop ${span.gap}px short of its right edge`);
        if (span.overlap > 0) throw new Error(`the composer runs ${span.overlap}px under the bar's controls`);
        await shot("bottom-expanded");
        await rig.click('.chat-bar-controls button[aria-label="Minimize the Chat"]', "the ▾");
        await until(b, `!document.querySelector(".chat-bar.open")`, "▾ to minimize the bar");

        // ⌘J opens and shuts the bar, not the dock.
        await rig.press("j", { meta: true });
        await until(b, `!!document.querySelector(".chat-bar.open") && !!document.activeElement?.closest(".chat-bar")`, "⌘J to open the bar with the caret in it");
        await rig.press("j", { meta: true });
        await until(b, `!document.querySelector(".chat-bar.open")`, "⌘J to shut the bar again");
        if (await b.ev(`[...document.querySelectorAll(".main-panel > .panel-head")].some(h => !h.closest(".chat-bar"))`)) throw new Error("⌘J opened the dock while the Chat lives at the bottom");

        // Reload: still at the bottom, still minimized.
        await rig.go(`/p/${id}`);
        await until(b, `!!document.querySelector(".chat-bar")`, "the bar to come back after a reload");
        if (await b.ev(`!!document.querySelector(".chat-bar.open") || [...document.querySelectorAll(".main-panel > .panel-head")].some(h => !h.closest(".chat-bar"))`)) {
          throw new Error("after a reload the bar came back open, or the dock came back with it");
        }

        // Home again by its grip: today's dock, and the canvas rail-pans for it.
        const before = await tx();
        const grip = await center(".chat-bar-grip");
        await drag(grip, { x: 160, y: 320 }, async () => {
          const hot = await b.ev(`document.querySelector(".chat-zone.hot")?.dataset.at ?? ""`);
          if (hot !== "left") throw new Error(`mid-drag home the hot slot is "${hot}", not the left dock`);
        });
        await until(b, `[...document.querySelectorAll(".main-panel > .panel-head")].some(h => !h.closest(".chat-bar")) && !document.querySelector(".chat-bar")`, "the Chat back in the left dock");
        const after = await tx();
        if (!(after > before + 100)) throw new Error(`the canvas did not rail-pan for the dock (${before} → ${after})`);
        if ((await b.ev(`localStorage.getItem("isocan.chatAt")`)) !== "left") throw new Error("going home was not remembered");

        // And the keyboard's way there and back: the header buttons.
        await rig.click('.main-panel > .panel-head button[aria-label="Move the Chat to the bottom"]', "Move to bottom");
        await until(b, `!!document.querySelector(".chat-bar") && ![...document.querySelectorAll(".main-panel > .panel-head")].some(h => !h.closest(".chat-bar"))`, "Move to bottom to move it");
        await rig.click('.chat-bar-controls button[aria-label="Dock the Chat on the left"]', "Dock on the left");
        await until(b, `[...document.querySelectorAll(".main-panel > .panel-head")].some(h => !h.closest(".chat-bar")) && !document.querySelector(".chat-bar")`, "Dock on the left to bring it home");
        const errors = b.takeErrors();
        if (errors.length > 0) throw new Error(`the Chat threw while moving: ${errors[0]}`);
      } finally {
        await b.ev(`(() => { localStorage.removeItem("isocan.chatAt"); return true; })()`);
        await b.send("Emulation.clearDeviceMetricsOverride", {});
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
    name: "model-keys",
    /**
     * **The settings area, walked** (keys phase 2). The proof the phase names
     * is a sentence about a screen: set a key from the identity menu, see it
     * as `…abcd`, and find the value nowhere in the page afterwards — the
     * password field emptied, nothing in the DOM — then remove it. The routes'
     * own refusals are `key-routes.test.ts`; this is that a person can reach
     * them, and that the page keeps the write-only promise the routes make.
     */
    what: "a model key set from the identity menu shows as …abcd, is nowhere in the page, shares on a tick, and removes",
    async run(rig) {
      const key = "sk-ant-fake-journey-abcd";
      await rig.go("/");
      await until(rig.b, `!!document.querySelector(".who-btn")`, "your face on the canvas list");
      await rig.click(".who-btn", "your face");
      await until(
        rig.b,
        `[...document.querySelectorAll(".identity-action")].some(e => e.textContent.trim().startsWith("Model keys"))`,
        "the identity menu to offer Model keys… under This machine",
      );
      // The menu scrolls inside its popover (it is taller than a laptop's
      // window); a person scrolls to the row, so the journey does too.
      const reach = (selector, text) =>
        rig.b.ev(`([...document.querySelectorAll(${JSON.stringify(selector)})].find(e => e.textContent.trim().startsWith(${JSON.stringify(text)}))?.scrollIntoView({ block: "center" }), true)`);
      await reach(".identity-action", "Model keys");
      await rig.clickText(".identity-action", "Model keys", "Model keys…");
      const row = '.keys-row[data-provider="anthropic"]';
      await until(rig.b, `!!document.querySelector(${JSON.stringify(row)})`, "the Anthropic row in the keys panel");
      const before = await rig.b.ev(`document.querySelector(${JSON.stringify(row + " .keys-state")})?.textContent ?? ""`);
      if (!/not set/.test(before)) throw new Error(`a fresh home's Anthropic key reads "${before}", not "not set"`);

      await reach(`${row} button`, "Set");
      await rig.clickText(`${row} button`, "Set", "Anthropic's Set");
      await until(rig.b, `document.activeElement?.type === "password"`, "a password field, focused");
      await rig.type(key);
      await reach(`${row} button`, "Save");
      await rig.clickText(`${row} button`, "Save", "Save");
      await until(
        rig.b,
        `(document.querySelector(${JSON.stringify(row + " .keys-state")})?.textContent ?? "").includes("…abcd")`,
        "the row to read set …abcd",
      );
      // The promise: the value is nowhere in the page — not in the markup, and
      // not in any field's live value (which innerHTML would not show).
      const leaked = await rig.b.ev(`document.body.innerHTML.includes(${JSON.stringify(key)}) ||
        [...document.querySelectorAll("input")].some(i => i.value.includes(${JSON.stringify(key)}))`);
      if (leaked) throw new Error("the key is still in the page after it was saved");
      const onDisk = JSON.parse(readFileSync(path.join(rig.home, "keys.json"), "utf8"));
      if (onDisk.anthropic?.key !== key) throw new Error("the panel said set, but this machine's keys.json does not hold the key");

      // Owner-only spend (keys phase 3): sharing starts off, and the box is
      // what turns it on — in keys.json, beside the key it governs.
      const shareBox = ".keys-share input[type=checkbox]";
      await until(rig.b, `!!document.querySelector(${JSON.stringify(shareBox)})`, "the sharing checkbox");
      if (await rig.b.ev(`document.querySelector(${JSON.stringify(shareBox)}).checked`)) throw new Error("sharing starts on; it should start off");
      await rig.b.ev(`(document.querySelector(${JSON.stringify(shareBox)}).scrollIntoView({ block: "center" }), true)`);
      await rig.click(shareBox, "the sharing checkbox");
      await until(
        rig.b,
        `document.querySelector(${JSON.stringify(shareBox)}).checked && /^On:/.test(document.querySelector(".keys-share .share-roster-kind")?.textContent ?? "")`,
        "the box to read On",
      );
      const shared = JSON.parse(readFileSync(path.join(rig.home, "keys.json"), "utf8"));
      if (shared.shareWithCollaborators !== true) throw new Error("the box says on, but keys.json does not share");
      if (shared.anthropic?.key !== key) throw new Error("turning sharing on lost the stored key");

      await reach(`${row} button`, "Remove…");
      await rig.clickText(`${row} button`, "Remove…", "Anthropic's Remove…");
      await reach(`${row} button`, "Remove it");
      await rig.clickText(`${row} button`, "Remove it", "Remove it");
      await until(
        rig.b,
        `/not set/.test(document.querySelector(${JSON.stringify(row + " .keys-state")})?.textContent ?? "")`,
        "the row to read not set again",
      );
      const errors = rig.b.takeErrors();
      if (errors.length > 0) throw new Error(`the keys panel threw: ${errors[0]}`);
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
  {
    name: "wire-text-edit",
    /** Copy-edit phase 1's open bug (2 Oct 2026): an in-place edit on a wire
     *  screen spliced its HTML and the next restyle — which redraws from the
     *  spec the file carries — silently took the words back. */
    what: "a wireframe's heading edited in place survives a restyle, and a row that joins several words is refused in words",
    async run(rig) {
      const { b } = rig;
      await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
      const id = await makeCanvas(rig, "Acme wire words");
      const runCli = (...args) => {
        const out = execFileSync(process.execPath, [cli, "--json", ...args], {
          cwd: rig.home, encoding: "utf8",
          env: { ...process.env, ISOCAN_HOME: rig.home, ISOCAN_PORT: new URL(rig.origin).port, ISOCAN_SESSION_ID: "acme-wire-words-journey", ISOCAN_HARNESS: "test" },
        });
        return /^[[{]/.test(out.trim()) ? JSON.parse(out) : out;
      };
      runCli("identity", "--session", "--name", "Acme Wire CLI");
      runCli("--canvas", id, "wire", "an orders app for Acme — a list of orders and one order's detail", "--answerer", "stub", "--seed", "4", "--no-ask");
      const snapshot = async () => (await b.ev(`fetch('/api/projects/${id}/canvas', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json())`)).canvas;
      const textOf = (item) => b.ev(`fetch('/api/projects/${id}/blobs/${item.versions.find((v) => v.id === item.currentVersionId).blobHash}').then(r => r.text())`);
      const specIn = (html) => JSON.parse(/<script type="application\/json" id="[^"]+">([\s\S]*?)<\/script>/.exec(html)[1]);
      // Two screens of the flow: one whose rows join three words on one line, and one whose
      // title is drawn as itself and said by no slot's words — so the node double-clicked IS the title.
      let rowScreen = null, screen = null;
      for (const item of Object.values((await snapshot()).items)) {
        if (item.properties?.fidelity !== "wireframe" || item.properties?.wirePrototype) continue;
        const html = await textOf(item);
        const spec = specIn(html);
        if (!spec.content) continue;
        const rows = spec.slots.find((s) => Array.isArray(s.fill?.items) && s.fill.items[0]?.status && s.fill.items[0]?.sub && s.fill.items[0]?.meta);
        if (!rowScreen && rows && html.includes(`>${rows.fill.items[0].sub} · ${rows.fill.items[0].status} · ${rows.fill.items[0].meta}<`)) rowScreen = { item, row: rows.fill.items[0] };
        const words = JSON.stringify(spec.slots.map((s) => s.fill ?? null));
        if (!screen && spec.content.title && html.includes(`>${spec.content.title}<`) && !words.includes(JSON.stringify(spec.content.title))) screen = { item, spec };
      }
      if (!rowScreen) throw new Error("the composed flow has no screen whose rows join several words");
      if (!screen) throw new Error("the composed flow has no screen whose title is drawn as itself");
      const title = screen.spec.content.title;
      const NEW = "Acme open orders";

      const openEditText = async (itemId) => {
        await rig.go(`/p/${id}/w/${itemId}`);
        await until(b, `[...document.querySelectorAll(".stage-editor-btn")].some((e) => e.textContent.trim() === "Edit text")`, "the Edit text button");
        await rig.clickText(".stage-editor-btn", "Edit text");
        await until(b, `!!document.querySelector(".text-edit-frame iframe")?.contentDocument?.querySelector("[data-sec]")`, "the wire screen in the frozen frame");
        await sleep(600); // the frame wires its listeners on load, and fetches the save half for a wire screen
      };

      /** Where, on the page, the frame's text node saying `words` is — a real double-click goes there. */
      const pointAt = (words, sec) => b.ev(`(() => {
        const frame = document.querySelector(".text-edit-frame iframe");
        const doc = frame.contentDocument;
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          if (walker.currentNode.data.trim() !== ${JSON.stringify(words)}) continue;
          if (${JSON.stringify(sec ?? null)} !== null && walker.currentNode.parentElement.closest("[data-sec]")?.dataset.sec !== ${JSON.stringify(sec ?? null)}) continue;
          walker.currentNode.parentElement.scrollIntoView({ block: "center" });
          const range = doc.createRange();
          range.selectNodeContents(walker.currentNode);
          const r = range.getBoundingClientRect(), f = frame.getBoundingClientRect();
          if (r.width === 0) continue;
          // The stage may scale the frame to fit; the frame's own pixels are not the page's.
          const sx = f.width / frame.offsetWidth, sy = f.height / frame.offsetHeight;
          const x = r.left + r.width / 2, y = r.top + r.height / 2;
          if (doc.elementFromPoint(x, y) !== walker.currentNode.parentElement) return { covered: doc.elementFromPoint(x, y)?.outerHTML?.slice(0, 120) ?? "nothing" };
          return { x: Math.round(f.left + x * sx), y: Math.round(f.top + y * sy) };
        }
        return null;
      })()`);
      /**
       * A real double-click on the words, aimed once: the first click selects
       * the element and fills the properties strip, and the strip's row is
       * always there, so nothing slides under the pointer before the second
       * click. The words are measured again between the clicks — a person's
       * gap, inside the double-click window — and must not have moved.
       */
      const doubleClickOn = async (words, what, sec) => {
        const press = async (at, clickCount) => {
          await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: at.x, y: at.y, button: "left", buttons: 1, clickCount });
          await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: at.x, y: at.y, button: "left", buttons: 0, clickCount });
        };
        const aim = async () => {
          const at = await pointAt(words, sec);
          if (!at || at.covered) throw new Error(`${what} is not drawn where a person could double-click it (${at?.covered ?? "not found"})`);
          return at;
        };
        const at = await aim();
        await press(at, 1);
        await sleep(150);
        const between = await pointAt(words, sec);
        if (between && !between.covered && (between.x !== at.x || between.y !== at.y)) {
          throw new Error(`${what} moved under the pointer between the clicks of a double-click: (${at.x},${at.y}) → (${between.x},${between.y})`);
        }
        await press(at, 2);
        await sleep(300);
      };

      // A row that draws sub · status · meta on one line is refused before anything is typed.
      await openEditText(rowScreen.item.id);
      const { row } = rowScreen;
      await doubleClickOn(`${row.sub} · ${row.status} · ${row.meta}`, "the row's joined line");
      await until(b, `/several of the screen's words/.test(document.querySelector(".text-edit-refusal")?.textContent ?? "")`, "the joined row refused in words");
      const refusal = await b.ev(`document.querySelector(".text-edit-refusal").textContent`);
      if (await b.ev(`!!document.querySelector(".text-edit-frame iframe").contentDocument.querySelector("[contenteditable]")`)) throw new Error("the joined row became editable anyway");

      // The heading: double-click, type over it, Enter, save.
      await openEditText(screen.item.id);
      await doubleClickOn(title, `the heading "${title}"`);
      await until(b, `!!document.querySelector(".text-edit-frame iframe").contentDocument.querySelector("[contenteditable]")`, "the heading to become editable");
      await b.send("Input.insertText", { text: NEW });
      await rig.press("Enter");
      await until(b, `/1 text/.test(document.querySelector(".stage-editor-dirty")?.textContent ?? "")`, "one pending text edit");
      const before = screen.item.currentVersionId;
      await rig.clickText(".stage-editor-btn", "Save version");
      await until(b, `fetch('/api/projects/${id}/canvas', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json()).then(r => r.canvas.items[${JSON.stringify(screen.item.id)}].currentVersionId !== ${JSON.stringify(before)})`, "the edit saved as a version", 12_000);
      const saved = await textOf((await snapshot()).items[screen.item.id]);
      if (specIn(saved).content.title !== NEW) throw new Error(`the save left the spec saying "${specIn(saved).content.title}" — the next re-render would take the edit back`);

      // The re-render that used to revert it: a style redraws every screen from its spec.
      runCli("--canvas", id, "wire", "style", "--preset", "material");
      const restyled = await textOf((await snapshot()).items[screen.item.id]);
      if (restyled === saved) throw new Error("the restyle did not redraw the screen — nothing was proved");
      if (!restyled.includes(`>${NEW}<`)) throw new Error("the restyle took the heading's words back");
      if (restyled.includes(`>${title}<`)) throw new Error(`the restyled screen still draws the old heading "${title}"`);
      return { screen: screen.item.id, from: title, to: NEW, refusedOn: rowScreen.item.id, refusal };
    },
  },
];

/**
 * **Where the canvas is actually showing, `w` × `h` of it, empty.**
 *
 * The journeys used to press at fixed points — (240, 240) for text, (300, 300)
 * for the Pen — chosen when the canvas was the only thing on screen. Since
 * 24 Sep 2026 a never-chosen canvas opens with the Chat docked on the left,
 * and in the runner's window it covers x 20–340, y 74–449: both points landed
 * in `.main-scroll`. Four journeys then failed with "never became true: the
 * text composer" — the press was real, it just pressed the Chat — and the Pen
 * journey kept passing while drawing nothing, because it only asserted that
 * nothing threw.
 *
 * So a journey asks, the way a person looks: a point is canvas when the
 * browser's own hit test says the top thing there is inside the viewport and
 * is not an item, a panel, a menu or a control. The whole box is checked, not
 * just its corner, because a stroke travels. Failing to find one is a failure
 * in its own words, not a press into whatever was there.
 */
async function openSpot(rig, w = 40, h = 40) {
  const spot = await rig.b.ev(`(() => {
    const bare = (x, y) => {
      const el = document.elementFromPoint(x, y);
      return !!el && !!el.closest(".canvas-viewport") &&
        !el.closest("[data-item-id], .dock-panel, .floats, aside, [role=menu], button, a, input, textarea, .text-composer");
    };
    const r = document.querySelector(".canvas-viewport")?.getBoundingClientRect();
    if (!r) return null;
    for (let y = r.top + 60; y + ${h} < r.bottom - 60; y += 20) {
      for (let x = r.left + 60; x + ${w} < r.right - 60; x += 20) {
        const box = [[x, y], [x + ${w}, y], [x, y + ${h}], [x + ${w}, y + ${h}], [x + ${w} / 2, y + ${h} / 2]];
        if (box.every(([px, py]) => bare(px, py))) return { x: Math.round(x), y: Math.round(y) };
      }
    }
    return null;
  })()`);
  if (!spot) throw new Error(`no ${w}×${h} of bare canvas is showing — everything is under a panel or an item`);
  return spot;
}

/** Put a text node on the open canvas the way a person does. */
async function addText(rig, words) {
  await rig.clickTool("Text");
  /* A real press on empty canvas — the gesture that opens a composer. */
  const at = await openSpot(rig);
  await rig.stroke([[at.x, at.y]]);
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

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
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browser, throughTheDoor } from "./lib/browser.mjs";
import { reapOnExit, startDaemon as ownDaemon } from "./lib/daemon.mjs";

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
 * **A daemon of this run's own, which the run takes with it.**
 *
 * This spawned `isocan serve`, which is a launcher: it starts a DETACHED
 * `serve --foreground` and exits, so the `proc.kill()` every teardown here
 * sent went to a process that was already gone, and the 3 s wait after it
 * waited for an exit that had already happened. Every rig, and every journey
 * with a daemon of its own, left one behind. By 14 Oct 2026 this Mac held
 * about 290 of them (≈8 GB) and a deep run reached load average 98.
 *
 * `lib/daemon.mjs` starts the daemon itself, in its own process group, picks
 * the port and retries only a lost race, and stops it by signalling the group
 * and waiting. It also takes every daemon down on an uncaught error, SIGINT,
 * SIGTERM or SIGHUP, and the daemon watches this pid (ISOCAN_DAEMON_GUARD_PID)
 * for the one ending nothing here can see, a SIGKILL.
 */
const startDaemon = (home, env = {}) => ownDaemon({ cli, home, env });

/**
 * **Chrome as it comes, on every machine, owned by the run.**
 *
 * `--disable-extensions`, because a managed Mac force-installs its policy
 * extensions into every new profile, headless ones included: eleven extension
 * targets in a profile that is a second old (14 Oct 2026). While they start,
 * the page's lazy chunks fail to load (`net::ERR_FAILED`, "Failed to fetch
 * dynamically imported module", a canvas that never opens), and now and then
 * the page stops answering altogether. One browser shared by the whole run
 * paid that start once. A browser per journey paid it fifty times: 10 fresh
 * rigs in 30 failed, and 0 in 30 with the flag, which leaves only Chrome's own
 * two component extensions. The journeys test isocan in the browser CI has,
 * not in whatever a machine's policy adds.
 *
 * Owned like the daemon: a run that is interrupted takes its Chrome with it,
 * and one that would not exit stays owned so the exit hook does.
 */
async function ownBrowser() {
  const b = await browser({ args: ["--disable-extensions"] });
  const unreap = reapOnExit(b.pid);
  const close = b.close;
  b.close = async () => {
    await close();
    unreap();
  };
  return b;
}

/**
 * **A fresh daemon, home and browser for every journey, through the door.**
 *
 * One rig used to serve the whole run, and a journey could leave it changed
 * in ways the next journey walked into:
 *
 * - a CLI identity name claimed in the shared home (`meadow-idle` claimed
 *   "Meadow Journey CLI", so `meadow`, `ground-motion` and `meadow-others`
 *   were refused it: "is taken here");
 * - the door's cookie, `isocan_badge`, which is scoped to the host and not
 *   the port: `critique` crossed its own daemon's door on 127.0.0.1, replacing
 *   the rig's badge, and every later journey's Create form was refused with
 *   "this badge does not speak for usr_… — claim that actor first";
 * - an `identity.json` rewritten in the shared home (`proactive-proposal`
 *   makes it Maya's), and emulated sizes and media nobody cleared.
 *
 * So eighteen journeys failed in a full run and passed alone. The cure is to
 * make the full run what `--only` already was, a rig of the journey's own,
 * rather than to teach the rig to undo every way it can be changed. That list
 * grows with each journey, and the first one nobody thought of is the next
 * failure. A daemon starts in under a second and Chrome in about one, so
 * isolation costs a few seconds a journey.
 *
 * The identity is claimed through the API and written to `localStorage` under
 * the key the app reads, because every journey starts signed in. The door has
 * its own journey and does not belong in the middle of the others.
 */
async function rig() {
  const home = mkdtempSync(path.join(tmpdir(), "isocan-journeys-"));
  let daemon = null;
  let b = null;
  try {
    daemon = await startDaemon(home);
    b = await ownBrowser();
    /**
     * **Arm the load listener BEFORE navigating**, and wait for the document
     * rather than for a duration. `Page.navigate` resolves when navigation
     * STARTS; evaluating against a page that is still `about:blank` makes a
     * relative `fetch("/api/door")` fail with "Failed to fetch" — which reads
     * as a daemon that is down and is nothing of the kind. `grade.mjs` learned
     * the same lesson and its `once` exists for exactly this.
     */
    const loaded = b.once("Page.loadEventFired");
    await b.send("Page.navigate", { url: daemon.origin });
    await Promise.race([loaded, sleep(15_000)]);
    // One door-crossing, shared with the canvas screenshot (`lib/browser.mjs`).
    await throughTheDoor(b, daemon.origin, "Journey", "journeys");
  } catch (err) {
    await b?.close().catch(() => {});
    await daemon?.stop().catch(() => {});
    rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    throw err;
  }
  const { origin } = daemon;

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
        z: { windowsVirtualKeyCode: 90, key: "z", code: "KeyZ" },
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
    /**
     * Browser, then daemon, then home. Each step runs even when the one
     * before it threw: a Chrome that would not exit is no reason to leave a
     * daemon serving a home about to be deleted. The first error is the one
     * reported.
     */
    close: async () => {
      let failure = null;
      try { await b.close(); } catch (err) { failure ??= err; }
      try { await daemon.stop(); } catch (err) { failure ??= err; }
      rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      if (failure) throw failure;
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
  await untilOrSay(
    rig.b,
    `[...document.querySelectorAll(".canvas-card h3")].some(h => h.textContent === ${JSON.stringify(title)})`,
    `the canvas "${title}" to appear in the list`,
  );
  const id = await rig.b.ev(`(() => {
    const h = [...document.querySelectorAll(".canvas-card h3")].find(h => h.textContent === ${JSON.stringify(title)});
    return h.closest("a").getAttribute("href").split("/").pop();
  })()`);
  await rig.go(`/p/${id}`);
  await untilOrSay(rig.b, `!!document.querySelector(".world")`, "the canvas to open");
  return id;
}

/**
 * `until`, and when it times out, where the page is and what it shows.
 *
 * "never became true: the canvas … to appear in the list" was the whole of
 * seven failures for days, and the Create form had printed the reason above
 * the list each time ("this badge does not speak for usr_…"). A wait that
 * fails should report what the page shows, or the next reader has to rebuild
 * the scene to find it.
 */
async function untilOrSay(b, expression, what, ms) {
  try {
    await until(b, expression, what, ms);
  } catch (err) {
    const page = await b.ev(`({ at: location.pathname, says: (document.body?.innerText ?? "").replace(/\\s+/g, " ").trim().slice(0, 300) })`).catch(() => null);
    const thrown = b.takeErrors();
    throw new Error(`${err.message} — the page is at ${page?.at ?? "?"} and shows: ${page?.says || "(nothing)"}${thrown.length ? `; it threw: ${thrown[0]}` : ""}`);
  }
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

/**
 * **What share of `seconds` the page's main thread spent working**, from a
 * CPU profile: every sample that is not `(idle)`. `idle-at-rest` proves this
 * instrument can say no on every run; `meadow-idle` borrows it.
 */
async function mainThreadBusy(rig, seconds) {
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
}

/** Run the CLI against the journey's own daemon, as a test agent. */
function journeyCli(rig, session, ...args) {
  const out = execFileSync(process.execPath, [cli, "--json", ...args], {
    cwd: rig.home, encoding: "utf8",
    env: { ...process.env, ISOCAN_HOME: rig.home, ISOCAN_PORT: new URL(rig.origin).port, ISOCAN_SESSION_ID: session, ISOCAN_HARNESS: "test" },
  });
  return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out;
}

/** The living ground's canvas, its state and its frame count, read off the page. */
const groundNow = (b) => b.ev(`(() => {
  const c = document.querySelector("canvas.ground-canvas");
  if (!c) return null;
  return { state: c.dataset.groundState ?? null, still: c.dataset.groundStill ?? null, frames: c.groundProbe ? c.groundProbe.frames() : null };
})()`);

/** Is there a WebGL2 context to be had in this browser at all? */
const hasWebGL2 = (b) => b.ev(`!!document.createElement("canvas").getContext("webgl2")`);

/** Put a canvas on Meadow from the CLI — the agent's half of scene 5 — and
 *  wait for the ground to arrive, living or still. */
async function wearMeadow(rig, id, session) {
  journeyCli(rig, session, "identity", "--session", "--name", "Meadow Journey CLI");
  journeyCli(rig, session, "--canvas", id, "canvas", "background", "meadow");
  await until(rig.b, `!!document.querySelector("canvas.ground-canvas, .canvas-theme-painted.canvas-theme-meadow")`, "the meadow to arrive", 10_000);
}

/** Put a canvas on Night from the CLI and wait for it, living or still. */
async function wearNight(rig, id, session) {
  journeyCli(rig, session, "identity", "--session", "--name", "Night Journey CLI");
  journeyCli(rig, session, "--canvas", id, "canvas", "background", "night");
  await until(rig.b, `!!document.querySelector("canvas.ground-canvas, .canvas-theme-painted.canvas-theme-night")`, "the night to arrive", 10_000);
}

/** Put a canvas on Galaxy — drawn by Orbit since living grounds phase 3 —
 *  from the CLI, and wait for the ground to arrive, living or still. */
async function wearGalaxy(rig, id, session) {
  journeyCli(rig, session, "identity", "--session", "--name", "Orbit Journey CLI");
  journeyCli(rig, session, "--canvas", id, "canvas", "background", "galaxy");
  await until(rig.b, `!!document.querySelector("canvas.ground-canvas, .canvas-theme-galaxy-still")`, "the galaxy to arrive", 10_000);
}

/** Put a canvas on any living ground from the CLI and wait for it, living or
 *  still (phase 4's Snow and Aurora). */
async function wearGround(rig, id, session, theme) {
  journeyCli(rig, session, "identity", "--session", "--name", `${theme} journey CLI`);
  journeyCli(rig, session, "--canvas", id, "canvas", "background", theme);
  await until(rig.b, `!!document.querySelector("canvas.ground-canvas, .canvas-theme-painted.canvas-theme-${theme}")`, `the ${theme} to arrive`, 10_000);
}

/** Under reduced motion a living ground is its still: the tile on the page,
 *  no WebGL canvas, and neither the living layer nor the ground's chunk
 *  fetched. Returns "still", or throws saying which half failed. */
async function stillUnderReducedMotion(rig, id, theme) {
  const { b } = rig;
  await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  try {
    await rig.go(`/p/${id}`);
    await until(b, `!!document.querySelector(".canvas-theme-painted.canvas-theme-${theme}")`, `the still ${theme} under reduced motion`, 10_000);
    const reduced = await b.ev(`({
      canvas: !!document.querySelector("canvas.ground-canvas"),
      tile: getComputedStyle(document.querySelector(".canvas-theme-${theme}")).backgroundImage,
      fetched: performance.getEntriesByType("resource").some((e) => /LivingGround|${theme}-[^/]*\\.js/.test(e.name)),
    })`);
    if (reduced.canvas) throw new Error("reduced motion still mounted the WebGL canvas");
    if (!new RegExp(`${theme}\\.jpg`).test(reduced.tile)) throw new Error(`reduced motion shows no still frame: ${reduced.tile}`);
    if (reduced.fetched) throw new Error("reduced motion downloaded the living layer anyway");
    return "still";
  } finally {
    await b.send("Emulation.setEmulatedMedia", { features: [] });
  }
}

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

      const busy = (seconds) => mainThreadBusy(rig, seconds);

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
    name: "meadow-idle",
    /**
     * **A living ground that cannot settle does not ship** (living grounds,
     * phases.md's first rule). The same instrument as `idle-at-rest`, on a
     * canvas wearing Meadow and left alone: the ground must fall asleep and
     * the page must spend no more than the same 15% working.
     */
    what: "a Meadow canvas nobody is touching settles and burns no CPU",
    async run(rig) {
      const id = await makeCanvas(rig, "A quiet meadow");
      await wearMeadow(rig, id, "meadow-idle-journey");
      if (await rig.b.ev(`!!document.querySelector("canvas.ground-canvas")`)) {
        await until(rig.b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the meadow to fall asleep", 6000);
      }
      const atRest = await mainThreadBusy(rig, 4);
      const ground = await groundNow(rig.b);
      if (atRest > IDLE_BOUND) {
        throw new Error(`a Meadow canvas with nobody touching it spent ${atRest}% of 4s working, past ${IDLE_BOUND}% (ground: ${JSON.stringify(ground)})`);
      }
      if (ground && ground.state !== "asleep") throw new Error(`the meadow is ${ground.state} after 4s untouched`);
      return { busy: atRest, ground };
    },
  },
  {
    name: "meadow",
    /**
     * **Grass that parts, and then holds still** (living grounds phase 1,
     * journey.md scenes 1 and 5).
     *
     * State, not animation — the runner's own rule. The ground's canvas says
     * which state the sleep policy is in (`data-ground-state`) and how many
     * frames it has drawn; the trail texture is read back from the GPU at a
     * world point the cursor crossed. Moving over bare canvas must wake it
     * and draw; stopping must put it to sleep within 3.5 s and then draw
     * nothing at all. Reduced motion and a browser with no WebGL2 must both
     * give the painted still, with no WebGL canvas on the page.
     */
    what: "the meadow wakes and parts under the cursor, sleeps within 3.5 s, and is a still picture under reduced motion or without WebGL2",
    async run(rig) {
      const { b } = rig;
      const id = await makeCanvas(rig, "Acme meadow");
      const session = "meadow-journey";
      await wearMeadow(rig, id, session);
      const proof = {};
      const gl2 = await hasWebGL2(b);
      proof.webgl2 = gl2;
      if (gl2) {
        await until(b, `!!document.querySelector("canvas.ground-canvas")?.groundProbe`, "the living ground to start", 10_000);
        const first = await groundNow(b);
        if (first.still) throw new Error(`the meadow fell back to its still with WebGL2 available: ${first.still}`);
        // A card standing on the grass, for the picture and for the flattening.
        const md = path.join(rig.home, "acme-meadow.md");
        writeFileSync(md, "# Acme\n\nA card standing in the grass.\n");
        const spot = await openSpot(rig, 300, 200);
        const world = await b.ev(`(() => {
          const w = document.querySelector(".world"), r = w.getBoundingClientRect();
          const scale = parseFloat(getComputedStyle(w).getPropertyValue("--scale")) || 1;
          return { left: r.left, top: r.top, scale };
        })()`);
        const toWorld = (x, y) => ({ x: (x - world.left) / world.scale, y: (y - world.top) / world.scale });
        const at = toWorld(spot.x + 200, spot.y + 20);
        journeyCli(rig, session, "--canvas", id, "add", md, "--title", "Acme card", "--at", `${Math.round(at.x)},${Math.round(at.y)}`, "--size", "90x70");
        await until(b, `!!document.querySelector(".item")`, "the card to arrive");
        await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the meadow to fall asleep before the walk", 6000);
        const before = (await groundNow(b)).frames;

        // Walk across bare canvas, left of the card, with no button held.
        const y = spot.y + 190;
        let awakeSeen = false;
        let shot = null;
        for (let i = 0; i <= 30; i++) {
          const x = spot.x + 10 + i * 6;
          await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y: y - i * 3, button: "none", buttons: 0 });
          await sleep(30);
          if (i === 15) awakeSeen = (await groundNow(b)).state === "awake";
          if (i === 24) {
            shot = path.join(tmpdir(), `isocan-meadow-${Date.now()}.png`);
            writeFileSync(shot, Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
          }
        }
        const stoppedAt = Date.now();
        const mid = toWorld(spot.x + 10 + 28 * 6, y - 28 * 3);
        const pressed = await b.ev(`document.querySelector("canvas.ground-canvas").groundProbe.trailAt(${mid.x}, ${mid.y})`);
        const moving = await groundNow(b);
        if (!awakeSeen) throw new Error("the meadow was not awake while the cursor walked over it");
        if (!(moving.frames > before)) throw new Error(`no frames were drawn while the cursor moved (${before} → ${moving.frames})`);
        if (!(pressed > 0.1)) throw new Error(`the trail holds ${pressed} at world (${mid.x.toFixed(0)}, ${mid.y.toFixed(0)}), where the cursor just walked`);
        const untouched = await b.ev(`document.querySelector("canvas.ground-canvas").groundProbe.trailAt(${mid.x + 4000}, ${mid.y + 4000})`);
        if (untouched !== 0) throw new Error(`the trail holds ${untouched} far from anywhere the cursor went`);

        // Stop. Asleep within 3.5 s, and then not one more frame.
        await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the meadow to fall asleep after the cursor stopped", 6000);
        const sleptAfter = Date.now() - stoppedAt;
        if (sleptAfter > 3500) throw new Error(`the meadow took ${sleptAfter}ms to fall asleep — the bound is 3500`);
        const asleep = (await groundNow(b)).frames;
        await sleep(1500);
        const later = await groundNow(b);
        if (later.frames !== asleep || later.state !== "asleep") {
          throw new Error(`the meadow drew ${later.frames - asleep} frames while asleep (state ${later.state})`);
        }
        Object.assign(proof, { awake: awakeSeen, frames: moving.frames - before, trail: pressed, sleptAfterMs: sleptAfter, framesAsleep: 0, screenshot: shot });
      }

      // Reduced motion: the still, and the living layer never fetched.
      await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      try {
        await rig.go(`/p/${id}`);
        await until(b, `!!document.querySelector(".canvas-theme-painted.canvas-theme-meadow")`, "the still meadow under reduced motion", 10_000);
        const reduced = await b.ev(`({
          canvas: !!document.querySelector("canvas.ground-canvas"),
          tile: getComputedStyle(document.querySelector(".canvas-theme-meadow")).backgroundImage,
          fetched: performance.getEntriesByType("resource").some((e) => /LivingGround|meadow-[^/]*\.js/.test(e.name)),
        })`);
        if (reduced.canvas) throw new Error("reduced motion still mounted the WebGL canvas");
        if (!/meadow\.jpg/.test(reduced.tile)) throw new Error(`reduced motion shows no still frame: ${reduced.tile}`);
        if (reduced.fetched) throw new Error("reduced motion downloaded the living layer anyway");
        proof.reducedMotion = "still";
      } finally {
        await b.send("Emulation.setEmulatedMedia", { features: [] });
      }

      // No WebGL2: the host gives up at once and hands over the still.
      const { identifier } = await b.send("Page.addScriptToEvaluateOnNewDocument", {
        source: `(() => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return type === "webgl2" ? null : get.call(this, type, ...rest); }; })();`,
      });
      try {
        await rig.go(`/p/${id}`);
        await until(b, `!!document.querySelector(".canvas-theme-painted.canvas-theme-meadow")`, "the still meadow without WebGL2", 10_000);
        const none = await b.ev(`({
          canvas: !!document.querySelector("canvas.ground-canvas"),
          tile: getComputedStyle(document.querySelector(".canvas-theme-meadow")).backgroundImage,
        })`);
        if (none.canvas) throw new Error("with no WebGL2 the ground canvas is still on the page");
        if (!/meadow\.jpg/.test(none.tile)) throw new Error(`with no WebGL2 there is no still frame: ${none.tile}`);
        proof.noWebGL2 = "still";
      } finally {
        await b.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
        await rig.go(`/p/${id}`);
      }
      return proof;
    },
  },
  {
    name: "ground-motion",
    /**
     * **Motion ▸ Calm, Still, and the menu that sets the ground** (living
     * grounds phase 4, journey.md scene 5).
     *
     * On a meadow, through the background menu a person uses: Full wakes at
     * mount and draws its settle (the contrast that proves the count can say
     * yes); Calm, untouched, draws at most the one paint a mounted ground
     * needs and never wakes — through the first seconds, and again after a
     * reload, which keeps the choice — and still wakes and parts under a
     * moving pointer; Still is the painted still with no WebGL canvas and no
     * meadow chunk fetched. Then choosing Night from the same menu is one
     * `project.update`, and one ⌘Z puts the meadow back.
     */
    what: "Calm draws nothing untouched and still wakes for a cursor, Still is the still with no WebGL, reload keeps the choice, and the menu's ground is one undo",
    async run(rig) {
      const { b } = rig;
      const MOD = process.platform === "darwin" ? 4 : 2;
      await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      const id = await makeCanvas(rig, "Acme calm meadow");
      const session = "ground-motion-journey";
      await wearMeadow(rig, id, session);
      const proof = {};
      const KEY = "isocan.groundMotion";
      const stored = () => b.ev(`localStorage.getItem(${JSON.stringify(KEY)})`);
      const openBackground = async () => {
        await rig.click(".drawer-handle", "the ··· handle");
        await rig.clickText(".context-menu .context-sub > button", "Background", "the Background row");
        await until(b, `!!document.querySelector(".context-submenu")`, "the Background submenu to open", 3000);
      };
      const choose = async (label) => {
        await openBackground();
        // The submenu scrolls on a short window, as a person would scroll it.
        const found = await b.ev(`(() => {
          const el = [...document.querySelectorAll(".context-submenu button")].find((e) => e.textContent.trim().startsWith(${JSON.stringify(label)}));
          if (!el) return false;
          el.scrollIntoView({ block: "nearest" });
          el.setAttribute("data-journey-pick", "");
          return true;
        })()`);
        if (!found) throw new Error(`no Background ▸ ${label} row`);
        await rig.click("[data-journey-pick]", `Background ▸ ${label}`);
        await until(b, `!document.querySelector(".context-menu")`, `choosing ${label} to close the menu`, 2000);
      };
      /** Watch an untouched ground for `ms`: the most frames it drew, and
       *  every state it was in. */
      const untouched = async (ms) => {
        await until(b, `!!document.querySelector("canvas.ground-canvas")?.groundProbe`, "the living ground to start", 10_000);
        const states = new Set();
        let frames = 0;
        const end = Date.now() + ms;
        while (Date.now() < end) {
          const g = await groundNow(b);
          if (g) {
            states.add(g.state);
            frames = Math.max(frames, g.frames ?? 0);
          }
          await sleep(100);
        }
        return { frames, states: [...states] };
      };
      try {
        const gl2 = await hasWebGL2(b);
        proof.webgl2 = gl2;
        if (gl2) {
          // 1. Full, the contrast: a meadow mounting wakes and draws its settle.
          await rig.go(`/p/${id}`);
          const full = await untouched(1500);
          if (!(full.frames > 2)) throw new Error(`under Full the meadow drew ${full.frames} frames as it mounted — the count cannot tell Calm from Full`);
          proof.full = full;

          // 2. Calm, from the menu: untouched, at most the one paint, never awake.
          await choose("Calm");
          if ((await stored()) !== "calm") throw new Error(`Calm was chosen and the setting holds ${await stored()}`);
          const calm = await untouched(3000);
          if (calm.frames > 1 || calm.states.some((s) => s !== "asleep")) {
            throw new Error(`untouched under Calm the meadow drew ${calm.frames} frames, states ${calm.states.join(", ")}`);
          }
          // …and a reload keeps it, and still draws nothing more.
          await rig.go(`/p/${id}`);
          const reloaded = await untouched(3000);
          if ((await stored()) !== "calm") throw new Error("a reload lost the Calm choice");
          if (reloaded.frames > 1 || reloaded.states.some((s) => s !== "asleep")) {
            throw new Error(`after a reload, untouched under Calm the meadow drew ${reloaded.frames} frames, states ${reloaded.states.join(", ")}`);
          }
          proof.calm = { menu: calm, reloaded };

          // 3. Calm still answers a cursor: a walk over bare canvas wakes it and parts the grass.
          const spot = await openSpot(rig, 220, 120);
          const world = await b.ev(`(() => {
            const w = document.querySelector(".world"), r = w.getBoundingClientRect();
            const scale = parseFloat(getComputedStyle(w).getPropertyValue("--scale")) || 1;
            return { left: r.left, top: r.top, scale };
          })()`);
          const before = (await groundNow(b)).frames;
          let awakeSeen = false;
          for (let i = 0; i <= 24; i++) {
            await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: spot.x + 10 + i * 8, y: spot.y + 60, button: "none", buttons: 0 });
            await sleep(30);
            if (i === 12) awakeSeen = (await groundNow(b)).state === "awake";
          }
          const mid = { x: (spot.x + 10 + 20 * 8 - world.left) / world.scale, y: (spot.y + 60 - world.top) / world.scale };
          const pressed = await b.ev(`document.querySelector("canvas.ground-canvas").groundProbe.trailAt(${mid.x}, ${mid.y})`);
          const walked = await groundNow(b);
          if (!awakeSeen) throw new Error("under Calm the meadow did not wake for a moving pointer");
          if (!(walked.frames > before + 5)) throw new Error(`under Calm a moving pointer drew ${walked.frames - before} frames`);
          if (!(pressed > 0.1)) throw new Error(`under Calm the trail holds ${pressed} where the pointer walked`);
          await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the Calm meadow to sleep after the walk", 6000);
          proof.calmWakes = { frames: walked.frames - before, trail: pressed };
          if (process.env.GROUND_SHOTS) {
            await openBackground();
            await sleep(400); // the previews are cached JPEGs; let them paint
            proof.menuShot = path.join(process.env.GROUND_SHOTS, "ground-motion-menu.png");
            writeFileSync(proof.menuShot, Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
            await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
            await until(b, `!document.querySelector(".context-menu")`, "Escape to close the menu", 2000);
          }
        }

        // 4. Still, from the menu: the painted still, no WebGL canvas — and after
        // a reload, the meadow's chunk is never fetched.
        await choose("Still");
        await until(b, `!!document.querySelector(".canvas-theme-painted.canvas-theme-meadow") && !document.querySelector("canvas.ground-canvas")`, "the still meadow once Still is chosen", 6000);
        await rig.go(`/p/${id}`);
        await until(b, `!!document.querySelector(".canvas-theme-painted.canvas-theme-meadow")`, "the still meadow after a reload", 10_000);
        await sleep(800);
        const still = await b.ev(`({
          canvas: !!document.querySelector("canvas.ground-canvas"),
          tile: getComputedStyle(document.querySelector(".canvas-theme-meadow")).backgroundImage,
          fetched: performance.getEntriesByType("resource").some((e) => /meadow-[^/]*\\.js/.test(e.name)),
          stored: localStorage.getItem(${JSON.stringify(KEY)}),
        })`);
        if (still.canvas) throw new Error("Still mounted the WebGL canvas");
        if (!/meadow\.jpg/.test(still.tile)) throw new Error(`Still shows no still frame: ${still.tile}`);
        if (still.fetched) throw new Error("Still downloaded the meadow's shaders anyway");
        if (still.stored !== "still") throw new Error(`a reload lost the Still choice (${still.stored})`);
        proof.still = { canvas: false, tile: "meadow.jpg", fetched: false };

        // 5. The ground itself is the canvas's: Night from the menu, then one ⌘Z.
        const worn = () => String(journeyCli(rig, session, "--canvas", id, "canvas", "background")).trim();
        await choose("Night");
        let deadline = Date.now() + 6000;
        while (!worn().startsWith("night") && Date.now() < deadline) await sleep(200);
        if (!worn().startsWith("night")) throw new Error(`choosing Night from the menu left the canvas on ${worn()}`);
        await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", modifiers: MOD, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90 });
        await b.send("Input.dispatchKeyEvent", { type: "keyUp", modifiers: MOD, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90 });
        deadline = Date.now() + 6000;
        while (!worn().startsWith("meadow") && Date.now() < deadline) await sleep(200);
        if (!worn().startsWith("meadow")) throw new Error(`one ⌘Z after choosing Night left the canvas on ${worn()}`);
        proof.undo = "night → ⌘Z → meadow";
      } finally {
        await b.ev(`(() => { localStorage.removeItem(${JSON.stringify(KEY)}); return true; })()`);
      }
      return proof;
    },
  },
  {
    name: "orbit-idle",
    /**
     * **Space at rest is still space at rest** (living grounds phase 3). The
     * `meadow-idle` instrument on a canvas wearing Galaxy — drawn by Orbit
     * since 9 Oct 2026 — with nobody touching it and the pointer never over
     * it: the eddy window is for a RESTING pointer, so an untouched galaxy
     * must fall asleep like any ground and the page spend no more than 15%.
     */
    what: "a Galaxy (Orbit) canvas nobody is touching settles and burns no CPU",
    async run(rig) {
      const id = await makeCanvas(rig, "A quiet galaxy");
      await wearGalaxy(rig, id, "orbit-idle-journey");
      if (await rig.b.ev(`!!document.querySelector("canvas.ground-canvas")`)) {
        await until(rig.b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the galaxy to fall asleep", 6000);
      }
      const atRest = await mainThreadBusy(rig, 4);
      const ground = await groundNow(rig.b);
      if (atRest > IDLE_BOUND) {
        throw new Error(`a Galaxy canvas with nobody touching it spent ${atRest}% of 4s working, past ${IDLE_BOUND}% (ground: ${JSON.stringify(ground)})`);
      }
      if (ground && ground.state !== "asleep") throw new Error(`the galaxy is ${ground.state} after 4s untouched`);
      return { busy: atRest, ground };
    },
  },
  {
    name: "orbit",
    /**
     * **Gravity in space** (living grounds phase 3, journey.md scene 2): Orbit
     * is how Galaxy is drawn now. State, not animation, read off the ground:
     *
     * - its stars are world-anchored — zoom out to a third and back, three
     *   times, and the star count round the centre is within 20% of before
     *   (the bench's stars gathered there);
     * - the pointer moving wakes it and draws;
     * - the pointer RESTING over it keeps it awake for the eddy window (~15 s
     *   after the last move), then it settles and sleeps and draws nothing;
     * - a held button reverses the pull: the stars near it move away (their
     *   mean radial speed, read back from the GPU, is outward);
     * - reduced motion gives the still tile, with no WebGL canvas and no
     *   living chunk fetched.
     */
    what: "Galaxy is Orbit: world-anchored stars, awake on a move, the eddy window under a resting pointer, a held button reverses the pull, and a still under reduced motion",
    async run(rig) {
      const { b } = rig;
      const id = await makeCanvas(rig, "Acme orbit");
      const session = "orbit-journey";
      await wearGalaxy(rig, id, session);
      const proof = {};
      const gl2 = await hasWebGL2(b);
      proof.webgl2 = gl2;
      const state = async () => (await groundNow(b)).state;
      const probe = (expr) => b.ev(`(() => { const p = document.querySelector("canvas.ground-canvas").groundProbe; return ${expr}; })()`);
      if (gl2) {
        await until(b, `!!document.querySelector("canvas.ground-canvas")?.groundProbe`, "the living ground to start", 10_000);
        const first = await groundNow(b);
        if (first.still) throw new Error(`the galaxy fell back to its still with WebGL2 available: ${first.still}`);
        await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the galaxy to fall asleep before anything moves", 6000);
        const cr = await b.ev(`(() => { const r = document.querySelector("canvas.ground-canvas").getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`);
        const near = (x, y, r) => probe(`p.near(${x - cr.left}, ${y - cr.top}, ${r})`);
        const scale = () => b.ev(`parseFloat(getComputedStyle(document.querySelector(".world")).getPropertyValue("--scale")) || 1`);

        // 1. World-anchored: zoom out to a third and back, three times, about
        //    a corner far from the centre (so no pointer pull reaches it).
        const centre = { x: cr.left + cr.width / 2, y: cr.top + cr.height / 2 };
        const before = await near(centre.x, centre.y, 220);
        const s0 = await scale();
        const corner = { x: cr.left + 12, y: cr.top + 12 };
        const wheel = (deltaY) => b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: corner.x, y: corner.y, deltaX: 0, deltaY, modifiers: 2 });
        const zooms = [];
        for (let round = 0; round < 3; round++) {
          let n = 0;
          while ((await scale()) > s0 / 3 && n < 60) {
            await wheel(60);
            await sleep(40);
            n++;
          }
          zooms.push(await scale());
          for (let i = 0; i < n; i++) {
            await wheel(-60);
            await sleep(40);
          }
        }
        const s1 = await scale();
        if (Math.abs(s1 / s0 - 1) > 0.02) throw new Error(`the zoom did not come back: ${s0} → ${s1}`);
        await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the galaxy to settle after the zooms", 6000);
        const after = await near(centre.x, centre.y, 220);
        if (!(before && before.count > 10)) throw new Error(`too few stars round the centre to measure: ${JSON.stringify(before)}`);
        const drift = after.count / before.count - 1;
        if (Math.abs(drift) > 0.2) throw new Error(`star density at the centre moved ${(drift * 100).toFixed(0)}% after zooming out ×3 and back (${before.count.toFixed(1)} → ${after.count.toFixed(1)})`);
        Object.assign(proof, { zoomedTo: zooms.map((z) => +z.toFixed(3)), centreStarsBefore: +before.count.toFixed(1), centreStarsAfter: +after.count.toFixed(1), densityDrift: +drift.toFixed(3) });

        // 2. The pointer moves over bare canvas: awake, drawing.
        const spot = await openSpot(rig, 300, 200);
        const framesBefore = (await groundNow(b)).frames;
        let awakeSeen = false;
        let shot = null;
        let last = null;
        for (let i = 0; i <= 30; i++) {
          last = { x: spot.x + 20 + i * 8, y: spot.y + 180 - i * 5 };
          await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: last.x, y: last.y, button: "none", buttons: 0 });
          await sleep(30);
          if (i === 15) awakeSeen = (await state()) === "awake";
        }
        const stoppedAt = Date.now();
        if (!awakeSeen) throw new Error("the galaxy was not awake while the pointer moved over it");
        const moved = await groundNow(b);
        if (!(moved.frames > framesBefore)) throw new Error(`no frames were drawn while the pointer moved (${framesBefore} → ${moved.frames})`);

        // 3. The pointer rests over it: the eddy window keeps it awake ~15 s.
        await sleep(1200);
        // A screenshot only when asked for ($GROUND_SHOTS), as chat-bottom does with $CHAT_SHOTS.
        if (process.env.GROUND_SHOTS) {
          shot = path.join(process.env.GROUND_SHOTS, "orbit.png");
          writeFileSync(shot, Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
        }
        const resting = await near(last.x, last.y, 200);
        if (!(await probe("p.resting()"))) throw new Error("the ground does not know the pointer is resting over it");
        await sleep(5000 - (Date.now() - stoppedAt));
        const at5 = await state();
        await sleep(12_000 - (Date.now() - stoppedAt));
        const at12 = await state();
        if (at5 !== "awake" || at12 !== "awake") throw new Error(`a resting pointer should keep the galaxy awake for the eddy window: ${at5} at 5 s, ${at12} at 12 s`);
        const framesAt12 = (await groundNow(b)).frames;
        await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the galaxy to fall asleep after the eddy window", 12_000);
        const sleptAfter = Date.now() - stoppedAt;
        if (sleptAfter < 14_000 || sleptAfter > 18_500) throw new Error(`under a resting pointer the galaxy slept ${sleptAfter}ms after the last move — the window is ~15 s, then a ≤3 s settle`);
        const asleep = (await groundNow(b)).frames;
        if (!(asleep > framesAt12)) throw new Error("the eddy drew nothing between 12 s and sleep");
        await sleep(1500);
        const later = await groundNow(b);
        if (later.frames !== asleep || later.state !== "asleep") throw new Error(`the galaxy drew ${later.frames - asleep} frames while asleep (state ${later.state})`);
        Object.assign(proof, { awake: awakeSeen, frames: moved.frames - framesBefore, restingAt5s: at5, restingAt12s: at12, sleptAfterRestMs: sleptAfter, framesAsleep: 0, radialWhileResting: +resting.radial.toFixed(1), screenshot: shot });

        // 4. Hold the button: the pull reverses and the stars move away.
        await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: last.x, y: last.y, button: "left", buttons: 1, clickCount: 1 });
        await sleep(700);
        const held = await probe("p.held()");
        const fleeing = await near(last.x, last.y, 200);
        const heldState = await state();
        await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: last.x, y: last.y, button: "left", buttons: 0, clickCount: 1 });
        if (!held) throw new Error("the ground did not see the held button");
        if (heldState !== "awake") throw new Error(`a press did not wake the galaxy (${heldState})`);
        if (!(fleeing.radial > 5)) throw new Error(`with the button held the stars near the pointer should flee: mean radial speed ${fleeing.radial.toFixed(1)} px/s`);
        if (!(fleeing.radial > resting.radial)) throw new Error(`holding did not reverse the pull: ${resting.radial.toFixed(1)} → ${fleeing.radial.toFixed(1)} px/s`);
        Object.assign(proof, { held, radialWhileHeld: +fleeing.radial.toFixed(1) });
        await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 0, y: 0, button: "none", buttons: 0 });
      }

      // 5. Reduced motion: the still, and the living layer never fetched.
      await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      try {
        await rig.go(`/p/${id}`);
        await until(b, `!!document.querySelector(".canvas-theme-galaxy-still")`, "the still galaxy under reduced motion", 10_000);
        const reduced = await b.ev(`({
          canvas: !!document.querySelector("canvas.ground-canvas"),
          tile: getComputedStyle(document.querySelector(".canvas-theme-galaxy-still")).backgroundImage,
          fetched: performance.getEntriesByType("resource").some((e) => /LivingGround|orbit-[^/]*\\.js/.test(e.name)),
        })`);
        if (reduced.canvas) throw new Error("reduced motion still mounted the WebGL canvas");
        if (!/galaxy\.jpg/.test(reduced.tile)) throw new Error(`reduced motion shows no still frame: ${reduced.tile}`);
        if (reduced.fetched) throw new Error("reduced motion downloaded the living layer anyway");
        proof.reducedMotion = "still";
      } finally {
        await b.send("Emulation.setEmulatedMedia", { features: [] });
      }
      return proof;
    },
  },
  {
    name: "meadow-others",
    /**
     * **Somebody else walks by** (living grounds phase 2, journey.md scene 3).
     *
     * Two identities on one Meadow canvas: this page, idle and asleep, and an
     * agent at the CLI moving its presence cursor with `isocan session move`.
     * This page's own pointer never moves. Its ground must wake for the other
     * cursor, its trail texture must hold the other cursor's path at the
     * world points it crossed — including a point between two hops, which
     * only the eased cursor CursorLayer draws ever passes through — and it
     * must fall asleep within 3.5 s of the other cursor's last move. Nothing
     * new is sent for any of it; `groundpresence.test.ts` reads the messages.
     */
    what: "another identity's cursor moving over a Meadow wakes this page's ground, leaves its path in the trail, and lets it sleep within 3.5 s — and a working agent's wander does not keep it awake",
    async run(rig) {
      const { b } = rig;
      const id = await makeCanvas(rig, "Acme shared meadow");
      const other = "meadow-others-journey";
      await wearMeadow(rig, id, other);
      if (!(await hasWebGL2(b))) return { webgl2: false };
      await until(b, `!!document.querySelector("canvas.ground-canvas")?.groundProbe`, "the living ground to start", 10_000);
      const first = await groundNow(b);
      if (first.still) throw new Error(`the meadow fell back to its still with WebGL2 available: ${first.still}`);

      const spot = await openSpot(rig, 300, 200);
      const world = await b.ev(`(() => {
        const w = document.querySelector(".world"), r = w.getBoundingClientRect();
        const scale = parseFloat(getComputedStyle(w).getPropertyValue("--scale")) || 1;
        return { left: r.left, top: r.top, scale };
      })()`);
      const toWorld = (x, y) => ({ x: Math.round((x - world.left) / world.scale), y: Math.round((y - world.top) / world.scale) });
      // The other identity arrives, parked at the walk's start.
      const path0 = Array.from({ length: 7 }, (_, i) => toWorld(spot.x + 20 + i * 40, spot.y + 30 + i * 22));
      journeyCli(rig, other, "--canvas", id, "session", "start", "--label", "Ravi's agent");
      journeyCli(rig, other, "--canvas", id, "session", "move", String(path0[0].x), String(path0[0].y));
      await until(b, `!!document.querySelector(".remote-cursor")`, "the other identity's cursor to appear", 10_000);
      await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "this page's meadow to fall asleep before the other cursor walks", 8000);
      const before = (await groundNow(b)).frames;

      // The walk: hops from the CLI, eased into a path by CursorLayer.
      let awakeSeen = false;
      for (const at of path0.slice(1)) {
        journeyCli(rig, other, "--canvas", id, "session", "move", String(at.x), String(at.y));
        if (!awakeSeen) awakeSeen = (await groundNow(b)).state === "awake";
      }
      const stoppedAt = Date.now();
      const last = path0[path0.length - 1];
      const prev = path0[path0.length - 2];
      const between = { x: (last.x + prev.x) / 2, y: (last.y + prev.y) / 2 };
      // Read the trail as the eased cursor arrives; keep the strongest reading.
      const read = (p) => b.ev(`document.querySelector("canvas.ground-canvas").groundProbe.trailAt(${p.x}, ${p.y})`);
      let atLast = 0;
      let atBetween = 0;
      let shot = null;
      while (Date.now() - stoppedAt < 1500) {
        if (!awakeSeen) awakeSeen = (await groundNow(b)).state === "awake";
        atLast = Math.max(atLast, await read(last));
        atBetween = Math.max(atBetween, await read(between));
        if (!shot && atLast > 0.1) {
          shot = path.join(tmpdir(), `isocan-meadow-others-${Date.now()}.png`);
          writeFileSync(shot, Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
        }
        await sleep(50);
      }
      const moving = await groundNow(b);
      if (!awakeSeen) throw new Error("this page's meadow never woke while the other cursor walked over it");
      if (!(moving.frames > before)) throw new Error(`no frames were drawn for the other cursor (${before} → ${moving.frames})`);
      if (!(atLast > 0.1)) throw new Error(`the trail holds ${atLast} at world (${last.x}, ${last.y}), where the other cursor stopped`);
      if (!(atBetween > 0.1)) throw new Error(`the trail holds ${atBetween} at world (${between.x}, ${between.y}), on the other cursor's path between two hops`);
      const untouched = await read({ x: last.x + 4000, y: last.y + 4000 });
      if (untouched !== 0) throw new Error(`the trail holds ${untouched} far from anywhere any cursor went`);

      // The other cursor has stopped: asleep within 3.5 s, then no frames.
      await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "this page's meadow to fall asleep after the other cursor stopped", 6000);
      const sleptAfter = Date.now() - stoppedAt;
      if (sleptAfter > 3500) throw new Error(`the meadow took ${sleptAfter}ms to fall asleep after the other cursor stopped — the bound is 3500`);
      const asleep = (await groundNow(b)).frames;
      await sleep(1500);
      const later = await groundNow(b);
      if (later.frames !== asleep || later.state !== "asleep") {
        throw new Error(`the meadow drew ${later.frames - asleep} frames while asleep (state ${later.state})`);
      }

      // Left working, the agent's cursor wanders on this screen for as long as
      // it works — CursorLayer's own animation, which nobody sent. It is drawn
      // and must not touch the grass: the page sleeps while the cursor wanders.
      // Starting work moves the agent's REAL cursor to the work point — one
      // honest press, and the ground may wake for it. Wait for that wake to
      // arrive, so the sleep below is the one after it and not the old one.
      const workAt = path0[3];
      const preWork = (await groundNow(b)).frames;
      journeyCli(rig, other, "--canvas", id, "session", "work", "--at", `${workAt.x},${workAt.y}`);
      const workedAt = Date.now();
      await until(b, `!!document.querySelector(".remote-cursor") && document.querySelector("canvas.ground-canvas").groundProbe.frames() > ${preWork}`, "the agent's move to its work point to reach this page", 4000);
      const cursorAt = () => b.ev(`(() => { const c = document.querySelector(".remote-cursor"); return c ? c.style.left + "," + c.style.top : null; })()`);
      await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "this page's meadow to fall asleep while the agent works", 6000);
      const workSleptAfter = Date.now() - workedAt;
      if (workSleptAfter > 3500) throw new Error(`with an agent working the meadow took ${workSleptAfter}ms to fall asleep — the bound is 3500`);
      const workAsleep = (await groundNow(b)).frames;
      // Watched for at least 1.5 s and until the cursor has visibly moved,
      // up to 8 s. It was exactly 15 samples a tenth of a second apart, but the
      // wander is CursorLayer's rAF animation, with random "thinking" pauses of
      // up to 1.4 s, on a page that throttles rAF. A pause at the start of a
      // fixed window left the cursor still for all of it, and the walk failed
      // alone on 14 Oct 2026 with a test run beside it ("did not wander").
      // Watching longer only lengthens the stretch in which the meadow must
      // draw nothing.
      const seen = new Set();
      const watchFrom = Date.now();
      while (Date.now() - watchFrom < 1500 || (seen.size < 2 && Date.now() - watchFrom < 8000)) {
        seen.add(await cursorAt());
        await sleep(100);
      }
      const watchedMs = Date.now() - watchFrom;
      const working = await groundNow(b);
      if (seen.size < 2) throw new Error(`the working agent's cursor did not wander in ${watchedMs}ms, so this proves nothing about the wander`);
      if (working.frames !== workAsleep || working.state !== "asleep") {
        throw new Error(`the meadow drew ${working.frames - workAsleep} frames while the agent's cursor only wandered (state ${working.state})`);
      }
      journeyCli(rig, other, "--canvas", id, "session", "end");
      return { webgl2: true, awake: awakeSeen, frames: moving.frames - before, trailAtStop: atLast, trailBetweenHops: atBetween, sleptAfterMs: sleptAfter, framesAsleep: 0, screenshot: shot, working: { sleptAfterMs: workSleptAfter, wanderPositions: seen.size, watchedMs, framesWhileWandering: 0 } };
    },
  },
  {
    name: "night-idle",
    /** `idle-at-rest` on a Night canvas: left alone it settles, sleeps, and
     *  the page spends no more than the same 15% working (phases.md rule 1). */
    what: "a Night canvas nobody is touching settles and burns no CPU",
    async run(rig) {
      const id = await makeCanvas(rig, "A quiet night");
      await wearNight(rig, id, "night-idle-journey");
      if (await rig.b.ev(`!!document.querySelector("canvas.ground-canvas")`)) {
        await until(rig.b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the night to fall asleep", 6000);
      }
      const atRest = await mainThreadBusy(rig, 4);
      const ground = await groundNow(rig.b);
      if (atRest > IDLE_BOUND) {
        throw new Error(`a Night canvas with nobody touching it spent ${atRest}% of 4s working, past ${IDLE_BOUND}% (ground: ${JSON.stringify(ground)})`);
      }
      if (ground && ground.state !== "asleep") throw new Error(`the night is ${ground.state} after 4s untouched`);
      return { busy: atRest, ground };
    },
  },
  {
    name: "night",
    /**
     * **Fireflies at night** (living grounds phase 3, journey.md scene 4).
     *
     * The pointer walks over bare ground toward a card: the ground is awake
     * and its path has woken fireflies; the card it walked up to carries a
     * nonzero `--ground-glow` and a card far across the screen carries none.
     * It stops: asleep within 3.5 s, then not one more frame, and the glow it
     * left is cleared. Under reduced motion it is the still, with no WebGL
     * canvas and no living chunk fetched.
     */
    what: "the pointer wakes fireflies and warms the card it nears, then the night sleeps within 3.5 s; still under reduced motion",
    async run(rig) {
      const { b } = rig;
      await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      const id = await makeCanvas(rig, "Acme night");
      const session = "night-journey";
      await wearNight(rig, id, session);
      const proof = {};
      const gl2 = await hasWebGL2(b);
      proof.webgl2 = gl2;
      if (gl2) {
        await until(b, `!!document.querySelector("canvas.ground-canvas")?.groundProbe`, "the living ground to start", 10_000);
        const first = await groundNow(b);
        if (first.still) throw new Error(`the night fell back to its still with WebGL2 available: ${first.still}`);
        const spot = await openSpot(rig, 300, 200);
        const world = await b.ev(`(() => {
          const w = document.querySelector(".world"), r = w.getBoundingClientRect();
          const v = document.querySelector(".canvas-viewport").getBoundingClientRect();
          const scale = parseFloat(getComputedStyle(w).getPropertyValue("--scale")) || 1;
          return { left: r.left, top: r.top, scale, right: v.right, bottom: v.bottom };
        })()`);
        const toWorld = (x, y) => ({ x: (x - world.left) / world.scale, y: (y - world.top) / world.scale });
        const far = { x: world.right - 180, y: world.bottom - 140 };
        if (Math.hypot(far.x - (spot.x + 190), far.y - (spot.y + 100)) < 500) {
          throw new Error(`the screen is too small to hold a card out of a firefly's reach (spot ${JSON.stringify(spot)})`);
        }
        const md = path.join(rig.home, "acme-night.md");
        writeFileSync(md, "# Acme\n\nA card in the dark field.\n");
        const near = toWorld(spot.x + 200, spot.y + 20);
        const away = toWorld(far.x, far.y);
        journeyCli(rig, session, "--canvas", id, "add", md, "--title", "Acme near", "--at", `${Math.round(near.x)},${Math.round(near.y)}`, "--size", "90x70");
        journeyCli(rig, session, "--canvas", id, "add", md, "--title", "Acme far", "--at", `${Math.round(away.x)},${Math.round(away.y)}`, "--size", "90x70");
        await until(b, `document.querySelectorAll(".item").length >= 2`, "both cards to arrive");
        await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the night to fall asleep before the walk", 6000);
        const before = (await groundNow(b)).frames;
        const glowAt = (sx, sy) => b.ev(`(() => {
          const el = [...document.querySelectorAll(".item")].find((e) => { const r = e.getBoundingClientRect(); return ${sx} >= r.left && ${sx} <= r.right && ${sy} >= r.top && ${sy} <= r.bottom; });
          return el ? el.style.getPropertyValue("--ground-glow") : null;
        })()`);

        const y = spot.y + 190;
        let awakeSeen = false;
        let shot = null;
        for (let i = 0; i <= 30; i++) {
          await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: spot.x + 10 + i * 6, y: y - i * 3, button: "none", buttons: 0 });
          await sleep(30);
          if (i === 15) awakeSeen = (await groundNow(b)).state === "awake";
          if (i === 26) {
            shot = process.env.NIGHT_SHOT || path.join(tmpdir(), `isocan-night-${Date.now()}.png`);
            writeFileSync(shot, Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
          }
        }
        const stoppedAt = Date.now();
        const flies = await b.ev(`document.querySelector("canvas.ground-canvas").groundProbe.fireflies()`);
        const nearGlow = await glowAt(spot.x + 245, spot.y + 55);
        const farGlow = await glowAt(far.x + 45, far.y + 35);
        const moving = await groundNow(b);
        if (!awakeSeen) throw new Error("the night was not awake while the cursor walked over it");
        if (!(moving.frames > before)) throw new Error(`no frames were drawn while the cursor moved (${before} → ${moving.frames})`);
        if (!(flies > 0)) throw new Error(`the cursor's path woke no fireflies (${flies})`);
        if (nearGlow === null || !(parseFloat(nearGlow) > 0)) throw new Error(`the card the firefly walked up to has no glow (${JSON.stringify(nearGlow)})`);
        if (farGlow === null) throw new Error("the far card is not on the page");
        if (farGlow !== "") throw new Error(`a card far from every firefly glows: ${farGlow}`);

        await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the night to fall asleep after the cursor stopped", 6000);
        const sleptAfter = Date.now() - stoppedAt;
        if (sleptAfter > 3500) throw new Error(`the night took ${sleptAfter}ms to fall asleep — the bound is 3500`);
        const asleep = (await groundNow(b)).frames;
        await sleep(1500);
        const later = await groundNow(b);
        if (later.frames !== asleep || later.state !== "asleep") {
          throw new Error(`the night drew ${later.frames - asleep} frames while asleep (state ${later.state})`);
        }
        const leftGlow = await glowAt(spot.x + 245, spot.y + 55);
        if (leftGlow !== "") throw new Error(`the card still glows after the night slept: ${leftGlow}`);
        Object.assign(proof, { awake: awakeSeen, frames: moving.frames - before, fireflies: flies, nearGlow: parseFloat(nearGlow), farGlow: "none", sleptAfterMs: sleptAfter, framesAsleep: 0, glowCleared: true, screenshot: shot });
      }

      await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      try {
        await rig.go(`/p/${id}`);
        await until(b, `!!document.querySelector(".canvas-theme-painted.canvas-theme-night")`, "the still night under reduced motion", 10_000);
        const reduced = await b.ev(`({
          canvas: !!document.querySelector("canvas.ground-canvas"),
          tile: getComputedStyle(document.querySelector(".canvas-theme-night")).backgroundImage,
          fetched: performance.getEntriesByType("resource").some((e) => /LivingGround|night-[^/]*\\.js/.test(e.name)),
        })`);
        if (reduced.canvas) throw new Error("reduced motion still mounted the WebGL canvas");
        if (!/night\.jpg/.test(reduced.tile)) throw new Error(`reduced motion shows no still frame: ${reduced.tile}`);
        if (reduced.fetched) throw new Error("reduced motion downloaded the living layer anyway");
        proof.reducedMotion = "still";
      } finally {
        await b.send("Emulation.setEmulatedMedia", { features: [] });
      }
      return proof;
    },
  },
  {
    name: "snow-idle",
    /** `idle-at-rest` on a Snow canvas: left alone it settles, sleeps, and
     *  the page spends no more than the same 15% working (phases.md rule 1). */
    what: "a Snow canvas nobody is touching settles and burns no CPU",
    async run(rig) {
      const id = await makeCanvas(rig, "A quiet snowfield");
      await wearGround(rig, id, "snow-idle-journey", "snow");
      if (await rig.b.ev(`!!document.querySelector("canvas.ground-canvas")`)) {
        await until(rig.b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the snow to fall asleep", 6000);
      }
      const atRest = await mainThreadBusy(rig, 4);
      const ground = await groundNow(rig.b);
      if (atRest > IDLE_BOUND) {
        throw new Error(`a Snow canvas with nobody touching it spent ${atRest}% of 4s working, past ${IDLE_BOUND}% (ground: ${JSON.stringify(ground)})`);
      }
      if (ground && ground.state !== "asleep") throw new Error(`the snow is ${ground.state} after 4s untouched`);
      return { busy: atRest, ground };
    },
  },
  {
    name: "snow",
    /**
     * **Footprints that stay** (living grounds phase 4).
     *
     * The pointer walks across bare snow: the ground is awake, and Snow's own
     * pack — read back from its texture — is trodden at a world point the
     * pointer crossed and untouched far away. It stops: asleep within 3.5 s,
     * then not one more frame. Then the difference from Meadow: once the
     * host's trail has faded to nothing, the snow still holds the print; and
     * after the pointer moves elsewhere for a while (awake time), the print
     * has partly filled back in. Under reduced motion it is the still, with
     * no WebGL canvas and no living chunk fetched.
     */
    what: "the pointer treads a trail into the snow that outlives the host's trail and fills back in only while awake; asleep within 3.5 s; still under reduced motion",
    async run(rig) {
      const { b } = rig;
      await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      const id = await makeCanvas(rig, "Acme snowfield");
      const session = "snow-journey";
      await wearGround(rig, id, session, "snow");
      const proof = {};
      const gl2 = await hasWebGL2(b);
      proof.webgl2 = gl2;
      if (gl2) {
        await until(b, `!!document.querySelector("canvas.ground-canvas")?.groundProbe`, "the living ground to start", 10_000);
        const first = await groundNow(b);
        if (first.still) throw new Error(`the snow fell back to its still with WebGL2 available: ${first.still}`);
        const md = path.join(rig.home, "acme-snow.md");
        writeFileSync(md, "# Acme\n\nA card standing in the snow.\n");
        const spot = await openSpot(rig, 300, 200);
        const world = await b.ev(`(() => {
          const w = document.querySelector(".world"), r = w.getBoundingClientRect();
          const v = document.querySelector(".canvas-viewport").getBoundingClientRect();
          const scale = parseFloat(getComputedStyle(w).getPropertyValue("--scale")) || 1;
          return { left: r.left, top: r.top, scale, right: v.right, bottom: v.bottom };
        })()`);
        const toWorld = (x, y) => ({ x: (x - world.left) / world.scale, y: (y - world.top) / world.scale });
        const at = toWorld(spot.x + 200, spot.y + 20);
        journeyCli(rig, session, "--canvas", id, "add", md, "--title", "Acme card", "--at", `${Math.round(at.x)},${Math.round(at.y)}`, "--size", "90x70");
        await until(b, `!!document.querySelector(".item")`, "the card to arrive");
        await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the snow to fall asleep before the walk", 6000);
        const before = (await groundNow(b)).frames;
        const probe = (expr) => b.ev(`document.querySelector("canvas.ground-canvas").groundProbe.${expr}`);

        const y = spot.y + 190;
        let awakeSeen = false;
        let shot = null;
        for (let i = 0; i <= 30; i++) {
          await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: spot.x + 10 + i * 6, y: y - i * 3, button: "none", buttons: 0 });
          await sleep(30);
          if (i === 15) awakeSeen = (await groundNow(b)).state === "awake";
          // A screenshot only when asked for ($GROUND_SHOTS), as orbit does.
          if (i === 24 && process.env.GROUND_SHOTS) {
            shot = path.join(process.env.GROUND_SHOTS, "snow.png");
            writeFileSync(shot, Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
          }
        }
        const stoppedAt = Date.now();
        const mid = toWorld(spot.x + 10 + 28 * 6, y - 28 * 3);
        const trodden = await probe(`trodden(${mid.x}, ${mid.y})`);
        const moving = await groundNow(b);
        if (!awakeSeen) throw new Error("the snow was not awake while the cursor walked over it");
        if (!(moving.frames > before)) throw new Error(`no frames were drawn while the cursor moved (${before} → ${moving.frames})`);
        if (!(trodden > 0.3)) throw new Error(`the snow is trodden ${trodden} at world (${mid.x.toFixed(0)}, ${mid.y.toFixed(0)}), where the cursor just walked`);
        const untouched = await probe(`trodden(${mid.x + 4000}, ${mid.y + 4000})`);
        if (untouched !== 0) throw new Error(`the snow is trodden ${untouched} far from anywhere the cursor went`);

        await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the snow to fall asleep after the cursor stopped", 6000);
        const sleptAfter = Date.now() - stoppedAt;
        if (sleptAfter > 3500) throw new Error(`the snow took ${sleptAfter}ms to fall asleep — the bound is 3500`);
        const asleep = (await groundNow(b)).frames;
        await sleep(1500);
        const later = await groundNow(b);
        if (later.frames !== asleep || later.state !== "asleep") {
          throw new Error(`the snow drew ${later.frames - asleep} frames while asleep (state ${later.state})`);
        }
        // The host's trail is long gone; the snow still holds the print.
        const hostTrail = await probe(`trailAt(${mid.x}, ${mid.y})`);
        const kept = await probe(`trodden(${mid.x}, ${mid.y})`);
        if (hostTrail > 0.05) throw new Error(`the host's trail still holds ${hostTrail} — the persistence check proves nothing yet`);
        if (!(kept > 0.3)) throw new Error(`asleep, the print has gone from the snow (${kept}) — it should outlive the host's trail`);

        // Awake time elsewhere: the print fills back in a little.
        const far = { x: world.right - 220, y: world.bottom - 160 };
        for (let i = 0; i < 80; i++) {
          await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: far.x + (i % 2) * 8, y: far.y + ((i >> 1) % 2) * 8, button: "none", buttons: 0 });
          await sleep(30);
        }
        await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the snow to fall asleep after the second walk", 6000);
        const filled = await probe(`trodden(${mid.x}, ${mid.y})`);
        if (!(filled < kept - 0.05)) throw new Error(`after awake time elsewhere the print did not fill back in (${kept} → ${filled})`);
        Object.assign(proof, { awake: awakeSeen, frames: moving.frames - before, trodden, untouched, sleptAfterMs: sleptAfter, framesAsleep: 0, afterHostTrailFaded: { hostTrail, trodden: kept }, afterAwakeElsewhere: filled, screenshot: shot });
      }
      proof.reducedMotion = await stillUnderReducedMotion(rig, id, "snow");
      return proof;
    },
  },
  {
    name: "aurora-idle",
    /** `idle-at-rest` on an Aurora canvas (phases.md rule 1). */
    what: "an Aurora canvas nobody is touching settles and burns no CPU",
    async run(rig) {
      const id = await makeCanvas(rig, "A quiet aurora");
      await wearGround(rig, id, "aurora-idle-journey", "aurora");
      if (await rig.b.ev(`!!document.querySelector("canvas.ground-canvas")`)) {
        await until(rig.b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the aurora to fall asleep", 6000);
      }
      const atRest = await mainThreadBusy(rig, 4);
      const ground = await groundNow(rig.b);
      if (atRest > IDLE_BOUND) {
        throw new Error(`an Aurora canvas with nobody touching it spent ${atRest}% of 4s working, past ${IDLE_BOUND}% (ground: ${JSON.stringify(ground)})`);
      }
      if (ground && ground.state !== "asleep") throw new Error(`the aurora is ${ground.state} after 4s untouched`);
      return { busy: atRest, ground };
    },
  },
  {
    name: "aurora",
    /**
     * **Ribbons that lean toward you** (living grounds phase 4).
     *
     * The pointer walks over bare ground: the ground is awake, the ribbons'
     * lean (the energy the shader reads) is high over the column it crossed
     * and nothing over a column far across the screen; the card under the
     * lit column carries a nonzero `--aurora-glow` and a card far across
     * carries none. It stops: asleep within 3.5 s, then not one more frame,
     * the lean gone and the light cleared. Under reduced motion it is the
     * still, with no WebGL canvas and no living chunk fetched.
     */
    what: "the pointer bends and brightens the ribbons over it and lights the card beneath, then the aurora sleeps within 3.5 s; still under reduced motion",
    async run(rig) {
      const { b } = rig;
      await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      const id = await makeCanvas(rig, "Acme aurora");
      const session = "aurora-journey";
      await wearGround(rig, id, session, "aurora");
      const proof = {};
      const gl2 = await hasWebGL2(b);
      proof.webgl2 = gl2;
      if (gl2) {
        await until(b, `!!document.querySelector("canvas.ground-canvas")?.groundProbe`, "the living ground to start", 10_000);
        const first = await groundNow(b);
        if (first.still) throw new Error(`the aurora fell back to its still with WebGL2 available: ${first.still}`);
        const spot = await openSpot(rig, 300, 200);
        const world = await b.ev(`(() => {
          const w = document.querySelector(".world"), r = w.getBoundingClientRect();
          const v = document.querySelector(".canvas-viewport").getBoundingClientRect();
          const c = document.querySelector("canvas.ground-canvas").getBoundingClientRect();
          const scale = parseFloat(getComputedStyle(w).getPropertyValue("--scale")) || 1;
          return { left: r.left, top: r.top, scale, right: v.right, bottom: v.bottom, canvasLeft: c.left };
        })()`);
        const toWorld = (x, y) => ({ x: (x - world.left) / world.scale, y: (y - world.top) / world.scale });
        const far = { x: world.right - 180, y: world.bottom - 140 };
        if (far.x - (spot.x + 190) < 540) {
          throw new Error(`the screen is too narrow to hold a card out of the ribbons' reach (spot ${JSON.stringify(spot)})`);
        }
        const md = path.join(rig.home, "acme-aurora.md");
        writeFileSync(md, "# Acme\n\nA card under the northern lights.\n");
        const near = toWorld(spot.x + 200, spot.y + 20);
        const away = toWorld(far.x, far.y);
        journeyCli(rig, session, "--canvas", id, "add", md, "--title", "Acme near", "--at", `${Math.round(near.x)},${Math.round(near.y)}`, "--size", "90x70");
        journeyCli(rig, session, "--canvas", id, "add", md, "--title", "Acme far", "--at", `${Math.round(away.x)},${Math.round(away.y)}`, "--size", "90x70");
        await until(b, `document.querySelectorAll(".item").length >= 2`, "both cards to arrive");
        await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the aurora to fall asleep before the walk", 6000);
        const before = (await groundNow(b)).frames;
        const lean = (sx) => b.ev(`document.querySelector("canvas.ground-canvas").groundProbe.lean(${sx - world.canvasLeft})`);
        const lightAt = (sx, sy) => b.ev(`(() => {
          const el = [...document.querySelectorAll(".item")].find((e) => { const r = e.getBoundingClientRect(); return ${sx} >= r.left && ${sx} <= r.right && ${sy} >= r.top && ${sy} <= r.bottom; });
          return el ? el.style.getPropertyValue("--aurora-glow") : null;
        })()`);

        const y = spot.y + 190;
        let awakeSeen = false;
        let shot = null;
        for (let i = 0; i <= 30; i++) {
          await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: spot.x + 10 + i * 6, y: y - i * 3, button: "none", buttons: 0 });
          await sleep(30);
          if (i === 15) awakeSeen = (await groundNow(b)).state === "awake";
          if (i === 26 && process.env.GROUND_SHOTS) {
            shot = path.join(process.env.GROUND_SHOTS, "aurora.png");
            writeFileSync(shot, Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
          }
        }
        const stoppedAt = Date.now();
        const over = await lean(spot.x + 190);
        const across = await lean(far.x + 45);
        const nearLight = await lightAt(spot.x + 245, spot.y + 55);
        const farLight = await lightAt(far.x + 45, far.y + 35);
        const moving = await groundNow(b);
        if (!awakeSeen) throw new Error("the aurora was not awake while the cursor walked under it");
        if (!(moving.frames > before)) throw new Error(`no frames were drawn while the cursor moved (${before} → ${moving.frames})`);
        if (!(over > 0.3)) throw new Error(`the ribbons over the cursor's column lean ${over}`);
        if (!(across < 0.02)) throw new Error(`the ribbons far across the screen lean ${across}`);
        if (nearLight === null || !(parseFloat(nearLight) > 0)) throw new Error(`the card under the lit ribbons has no light (${JSON.stringify(nearLight)})`);
        if (farLight === null) throw new Error("the far card is not on the page");
        if (farLight !== "") throw new Error(`a card far from every lit ribbon is lit: ${farLight}`);

        await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the aurora to fall asleep after the cursor stopped", 6000);
        const sleptAfter = Date.now() - stoppedAt;
        if (sleptAfter > 3500) throw new Error(`the aurora took ${sleptAfter}ms to fall asleep — the bound is 3500`);
        const asleep = (await groundNow(b)).frames;
        await sleep(1500);
        const later = await groundNow(b);
        if (later.frames !== asleep || later.state !== "asleep") {
          throw new Error(`the aurora drew ${later.frames - asleep} frames while asleep (state ${later.state})`);
        }
        const leftLean = await lean(spot.x + 190);
        const leftLight = await lightAt(spot.x + 245, spot.y + 55);
        if (leftLean !== 0) throw new Error(`the ribbons still lean ${leftLean} after the aurora slept`);
        if (leftLight !== "") throw new Error(`the card is still lit after the aurora slept: ${leftLight}`);
        Object.assign(proof, { awake: awakeSeen, frames: moving.frames - before, leanOver: over, leanAcross: across, nearLight: parseFloat(nearLight), farLight: "none", sleptAfterMs: sleptAfter, framesAsleep: 0, leanAfter: 0, lightCleared: true, screenshot: shot });
      }
      proof.reducedMotion = await stillUnderReducedMotion(rig, id, "aurora");
      return proof;
    },
  },
  {
    name: "pond-idle",
    /** `idle-at-rest` on a Pond canvas (phases.md rule 1). */
    what: "a Pond canvas nobody is touching settles and burns no CPU",
    async run(rig) {
      const id = await makeCanvas(rig, "A quiet pond");
      await wearGround(rig, id, "pond-idle-journey", "pond");
      if (await rig.b.ev(`!!document.querySelector("canvas.ground-canvas")`)) {
        await until(rig.b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the pond to fall asleep", 6000);
      }
      const atRest = await mainThreadBusy(rig, 4);
      const ground = await groundNow(rig.b);
      if (atRest > IDLE_BOUND) {
        throw new Error(`a Pond canvas with nobody touching it spent ${atRest}% of 4s working, past ${IDLE_BOUND}% (ground: ${JSON.stringify(ground)})`);
      }
      if (ground && ground.state !== "asleep") throw new Error(`the pond is ${ground.state} after 4s untouched`);
      return { busy: atRest, ground };
    },
  },
  {
    name: "pond",
    /**
     * **Ripples on still water** (living grounds phase 4).
     *
     * The water is flat. The pointer walks across it: the ground is awake,
     * and the Pond's own height field — read back from its texture — stands
     * off zero where the pointer just crossed and is flat far away. It stops:
     * asleep within 3.5 s, then not one more frame. Under reduced motion it
     * is the still, with no WebGL canvas and no living chunk fetched.
     */
    what: "the pointer drags ripples across the pond, which sleeps within 3.5 s; still under reduced motion",
    async run(rig) {
      const { b } = rig;
      await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      const id = await makeCanvas(rig, "Acme pond");
      const session = "pond-journey";
      await wearGround(rig, id, session, "pond");
      const proof = {};
      const gl2 = await hasWebGL2(b);
      proof.webgl2 = gl2;
      if (gl2) {
        await until(b, `!!document.querySelector("canvas.ground-canvas")?.groundProbe`, "the living ground to start", 10_000);
        const first = await groundNow(b);
        if (first.still) throw new Error(`the pond fell back to its still with WebGL2 available: ${first.still}`);
        const md = path.join(rig.home, "acme-pond.md");
        writeFileSync(md, "# Acme\n\nA stone standing in the pond.\n");
        const spot = await openSpot(rig, 300, 200);
        const world = await b.ev(`(() => {
          const w = document.querySelector(".world"), r = w.getBoundingClientRect();
          const scale = parseFloat(getComputedStyle(w).getPropertyValue("--scale")) || 1;
          return { left: r.left, top: r.top, scale };
        })()`);
        const at = { x: (spot.x + 200 - world.left) / world.scale, y: (spot.y + 20 - world.top) / world.scale };
        journeyCli(rig, session, "--canvas", id, "add", md, "--title", "Acme stone", "--at", `${Math.round(at.x)},${Math.round(at.y)}`, "--size", "90x70");
        await until(b, `!!document.querySelector(".item")`, "the card to arrive");
        await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the pond to fall asleep before the walk", 6000);
        const before = (await groundNow(b)).frames;
        // The ground's own readback near a page point: the tallest ripple there.
        const ripple = (x, y) => b.ev(`(() => {
          const c = document.querySelector("canvas.ground-canvas"), r = c.getBoundingClientRect();
          return c.groundProbe.near(${x} - r.left, ${y} - r.top, 24)?.count ?? null;
        })()`);
        const y = spot.y + 190;
        const end = { x: spot.x + 10 + 30 * 6, y: y - 30 * 3 };
        const flat = await ripple(end.x, end.y);
        if (flat !== 0) throw new Error(`the water is not flat before anything touched it (${flat})`);

        let awakeSeen = false;
        let shot = null;
        for (let i = 0; i <= 30; i++) {
          await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: spot.x + 10 + i * 6, y: y - i * 3, button: "none", buttons: 0 });
          await sleep(30);
          if (i === 15) awakeSeen = (await groundNow(b)).state === "awake";
          // A screenshot only when asked for ($GROUND_SHOTS), as orbit does.
          if (i === 26 && process.env.GROUND_SHOTS) {
            shot = path.join(process.env.GROUND_SHOTS, "pond.png");
            writeFileSync(shot, Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
          }
        }
        const stoppedAt = Date.now();
        const crossed = await ripple(end.x, end.y);
        const far = await ripple(end.x + 500, end.y + 420);
        const moving = await groundNow(b);
        if (!awakeSeen) throw new Error("the pond was not awake while the cursor walked over it");
        if (!(moving.frames > before)) throw new Error(`no frames were drawn while the cursor moved (${before} → ${moving.frames})`);
        if (!(crossed > 0.02)) throw new Error(`the water is flat (${crossed}) where the cursor just crossed it`);
        if (!(far < crossed / 4)) throw new Error(`the water far from the cursor stands ${far}, against ${crossed} under it`);

        await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the pond to fall asleep after the cursor stopped", 6000);
        const sleptAfter = Date.now() - stoppedAt;
        if (sleptAfter > 3500) throw new Error(`the pond took ${sleptAfter}ms to fall asleep — the bound is 3500`);
        const asleep = (await groundNow(b)).frames;
        await sleep(1500);
        const later = await groundNow(b);
        if (later.frames !== asleep || later.state !== "asleep") {
          throw new Error(`the pond drew ${later.frames - asleep} frames while asleep (state ${later.state})`);
        }
        Object.assign(proof, { awake: awakeSeen, frames: moving.frames - before, rippleBefore: flat, rippleAtCrossed: crossed, rippleFar: far, sleptAfterMs: sleptAfter, framesAsleep: 0, screenshot: shot });
      }
      proof.reducedMotion = await stillUnderReducedMotion(rig, id, "pond");
      return proof;
    },
  },
  {
    name: "zen-idle",
    /** `idle-at-rest` on a Zen garden canvas (phases.md rule 1). */
    what: "a Zen garden canvas nobody is touching settles and burns no CPU",
    async run(rig) {
      const id = await makeCanvas(rig, "A quiet garden");
      await wearGround(rig, id, "zen-idle-journey", "zen");
      if (await rig.b.ev(`!!document.querySelector("canvas.ground-canvas")`)) {
        await until(rig.b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the garden to fall asleep", 6000);
      }
      const atRest = await mainThreadBusy(rig, 4);
      const ground = await groundNow(rig.b);
      if (atRest > IDLE_BOUND) {
        throw new Error(`a Zen garden canvas with nobody touching it spent ${atRest}% of 4s working, past ${IDLE_BOUND}% (ground: ${JSON.stringify(ground)})`);
      }
      if (ground && ground.state !== "asleep") throw new Error(`the garden is ${ground.state} after 4s untouched`);
      return { busy: atRest, ground };
    },
  },
  {
    name: "zen",
    /**
     * **Raked sand that softens only while somebody is there** (living
     * grounds phase 4).
     *
     * The pointer walks across the sand: the ground is awake, and the
     * garden's own rake memory — read back from its texture — is freshly
     * raked where the pointer crossed and unraked far away. It stops: asleep
     * within 3.5 s, then not one more frame — and the line is still there, no
     * softer 1.5 s later, because softening is not a reason to stay awake.
     * Then the pointer moves elsewhere for a few seconds: the first line has
     * softened by that awake time and no more. Under reduced motion it is the
     * still, with no WebGL canvas and no living chunk fetched.
     */
    what: "the pointer rakes lines that hold while the garden sleeps (within 3.5 s) and soften only with awake time; still under reduced motion",
    async run(rig) {
      const { b } = rig;
      await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      const id = await makeCanvas(rig, "Acme garden");
      const session = "zen-journey";
      await wearGround(rig, id, session, "zen");
      const proof = {};
      const gl2 = await hasWebGL2(b);
      proof.webgl2 = gl2;
      if (gl2) {
        await until(b, `!!document.querySelector("canvas.ground-canvas")?.groundProbe`, "the living ground to start", 10_000);
        const first = await groundNow(b);
        if (first.still) throw new Error(`the garden fell back to its still with WebGL2 available: ${first.still}`);
        const md = path.join(rig.home, "acme-zen.md");
        writeFileSync(md, "# Acme\n\nA stone standing in the sand.\n");
        const spot = await openSpot(rig, 300, 200);
        const world = await b.ev(`(() => {
          const w = document.querySelector(".world"), r = w.getBoundingClientRect();
          const v = document.querySelector(".canvas-viewport").getBoundingClientRect();
          const scale = parseFloat(getComputedStyle(w).getPropertyValue("--scale")) || 1;
          return { left: r.left, top: r.top, scale, right: v.right, bottom: v.bottom };
        })()`);
        const at = { x: (spot.x + 200 - world.left) / world.scale, y: (spot.y + 20 - world.top) / world.scale };
        journeyCli(rig, session, "--canvas", id, "add", md, "--title", "Acme stone", "--at", `${Math.round(at.x)},${Math.round(at.y)}`, "--size", "90x70");
        await until(b, `!!document.querySelector(".item")`, "the card to arrive");
        await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the garden to fall asleep before the walk", 6000);
        const before = (await groundNow(b)).frames;
        // The ground's own readback near a page point: how raked (1 fresh → 0).
        const raked = (x, y) => b.ev(`(() => {
          const c = document.querySelector("canvas.ground-canvas"), r = c.getBoundingClientRect();
          return c.groundProbe.near(${x} - r.left, ${y} - r.top, 6)?.count ?? null;
        })()`);
        const y = spot.y + 190;
        const mid = { x: spot.x + 10 + 20 * 6, y: y - 20 * 3 };
        const unraked = await raked(mid.x, mid.y);
        if (unraked !== 0) throw new Error(`the sand is raked before anything touched it (${unraked})`);

        let awakeSeen = false;
        let shot = null;
        for (let i = 0; i <= 30; i++) {
          await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: spot.x + 10 + i * 6, y: y - i * 3, button: "none", buttons: 0 });
          await sleep(30);
          if (i === 15) awakeSeen = (await groundNow(b)).state === "awake";
          // A screenshot only when asked for ($GROUND_SHOTS), as orbit does.
          if (i === 26 && process.env.GROUND_SHOTS) {
            shot = path.join(process.env.GROUND_SHOTS, "zen.png");
            writeFileSync(shot, Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
          }
        }
        const stoppedAt = Date.now();
        const crossed = await raked(mid.x, mid.y);
        const far = { x: world.right - 220, y: world.bottom - 160 };
        const farRaked = await raked(far.x, far.y);
        const moving = await groundNow(b);
        if (!awakeSeen) throw new Error("the garden was not awake while the cursor walked over it");
        if (!(moving.frames > before)) throw new Error(`no frames were drawn while the cursor moved (${before} → ${moving.frames})`);
        if (!(crossed > 0.8)) throw new Error(`the sand is raked ${crossed} where the cursor just crossed it`);
        if (farRaked !== 0) throw new Error(`the sand is raked ${farRaked} far from anywhere the cursor went`);

        await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the garden to fall asleep after the cursor stopped", 6000);
        const sleptAfter = Date.now() - stoppedAt;
        if (sleptAfter > 3500) throw new Error(`the garden took ${sleptAfter}ms to fall asleep — the bound is 3500`);
        const asleep = (await groundNow(b)).frames;
        const held = await raked(mid.x, mid.y);
        await sleep(1500);
        const later = await groundNow(b);
        if (later.frames !== asleep || later.state !== "asleep") {
          throw new Error(`the garden drew ${later.frames - asleep} frames while asleep (state ${later.state})`);
        }
        const heldLater = await raked(mid.x, mid.y);
        if (!(held > 0.8)) throw new Error(`asleep ${sleptAfter}ms after the walk, the line has already softened to ${held}`);
        if (heldLater !== held) throw new Error(`the line softened while the garden slept (${held} → ${heldLater})`);

        // Awake time elsewhere: about 3 s of it softens the line by about 3/20.
        for (let i = 0; i < 100; i++) {
          await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: far.x + (i % 2) * 8, y: far.y + ((i >> 1) % 2) * 8, button: "none", buttons: 0 });
          await sleep(30);
        }
        await until(b, `document.querySelector("canvas.ground-canvas")?.dataset.groundState === "asleep"`, "the garden to fall asleep after the second walk", 6000);
        const softened = await raked(mid.x, mid.y);
        if (!(softened < held - 0.08 && softened > held - 0.4)) throw new Error(`after about 3 s awake elsewhere the line went ${held} → ${softened}; about ${(held - 0.17).toFixed(2)} was expected`);
        Object.assign(proof, { awake: awakeSeen, frames: moving.frames - before, rakedBefore: unraked, rakedAtCrossed: crossed, rakedFar: farRaked, sleptAfterMs: sleptAfter, framesAsleep: 0, heldAsleep: heldLater, afterAwakeElsewhere: softened, screenshot: shot });
      }
      proof.reducedMotion = await stillUnderReducedMotion(rig, id, "zen");
      return proof;
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
     * an item's resting shadow on release. Depth only — nothing grows, nothing
     * fades, nothing leaves the hand — and a dragged group lifts its FRAME,
     * not each of its members.
     *
     * Asserted as STATE: the computed `box-shadow` is polled until it equals
     * the token (a probe element resolves `var(--shadow-lift)` and
     * `var(--shadow-item)` in this page's theme, so the comparison is
     * theme-proof), never caught mid-transition.
     *
     * **The resting token moved on 8 Oct 2026, and this journey was not told.**
     * It was written on 1 Oct (3679d9086), when `.item` rested in
     * `--shadow-card`. bcc730381 gave items their own soft halo,
     * `--shadow-item`, on Dion's ask, and kept `--shadow-card` for the chrome.
     * It updated `lift.test.ts` and not this, so from then on the journey
     * failed at "the card to rest in --shadow-card" on a product working as
     * designed. The comparison is now against the token items actually rest
     * in, and the lift must still differ from it.
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
        probe.style.boxShadow = "var(--shadow-item)";
        const rest = getComputedStyle(probe).boxShadow;
        probe.remove();
        return { lift, rest };
      })()`);
      if (!tokens.rest || tokens.rest === "none") throw new Error(`--shadow-item does not resolve to a shadow (${tokens.rest})`);
      if (!tokens.lift || tokens.lift === "none" || tokens.lift === tokens.rest) throw new Error(`--shadow-lift does not resolve to its own shadow (${tokens.lift})`);
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
      await shadowIs(card, tokens.rest, "the card to rest in --shadow-item");
      const rest = await look(card);
      const hand = await grab(`.item[data-item-id="${card}"] .item-titlebar`, "the card's title bar");
      // A press that has not moved is a click, and a click never lifts.
      await sleep(250);
      const pressed = await look(card);
      if (pressed.lifted || pressed.shadow !== tokens.rest) {
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
      await shadowIs(card, tokens.rest, "the released card to settle back to --shadow-item");
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
      if (memberMid.lifted || memberMid.shadow !== tokens.rest) throw new Error(`a member of the dragged group lifted too (${memberMid.shadow}) — the frame lifts, its members ride flat`);
      if (Math.abs(frameMid.x - frameRest.x - 40) > 8) throw new Error(`the group is not under the hand: moved ${frameMid.x - frameRest.x}px for a 40px drag`);
      if (frameMid.transform !== "none" || Math.abs(frameMid.w - frameRest.w) > 0.5) throw new Error(`the lifted frame was transformed or resized (${frameRest.w}×${frameRest.h}, ${frameRest.transform} → ${frameMid.w}×${frameMid.h}, ${frameMid.transform})`);
      await shadowIs(group, "none", "the released group's frame to lie flat again");
      return { cardDragMode: migrated ? "legacy" : "groups", lift: tokens.lift, rest: tokens.rest, memberDuringGroupDrag: memberMid.shadow };
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
      const m = await ownBrowser();
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
    what: "Stack draws a pile of pictures that survives reload; hover fans, a click selects and a second opens, Esc closes, ← → flip the front card; Spread puts every member back where it was; ⇧S stacks and spreads it again; ⌘-drag takes a card out of the opened stack",
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

      // 5b. ← → on the selected stack flip which card is in front — this
      //     viewer's view only: the group does not move and nothing is stored.
      const topId = () => b.ev(`document.querySelector(${JSON.stringify(`.item[data-item-id="${group}"] .stack-card.top`)})?.getAttribute("data-member-id") ?? null`);
      const arrow = async (key, code, keyCode) => {
        await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code, windowsVirtualKeyCode: keyCode });
        await b.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode });
      };
      if (!(await b.ev(`!!document.querySelector(${JSON.stringify(`.item.selected[data-item-id="${group}"]`)})`))) {
        await mouse("mousePressed", pile.x, pile.y, { buttons: 1 });
        await mouse("mouseReleased", pile.x, pile.y);
        await until(b, `!!document.querySelector(${JSON.stringify(`.item.selected[data-item-id="${group}"]`)})`, "a click to select the stack for flipping", 3000);
      }
      const firstTop = await topId();
      const groupBox = () => runCli("--canvas", id, "show", group);
      const boxBefore = JSON.stringify((({ x, y }) => ({ x, y }))(groupBox()));
      await arrow("ArrowRight", "ArrowRight", 39);
      await until(b, `!!document.querySelector(${JSON.stringify(`.item[data-item-id="${group}"] .stack-card.leave-right`)})`, "→ to swing the front card out", 2000);
      await until(b, `(document.querySelector(${JSON.stringify(`.item[data-item-id="${group}"] .stack-card.top`)})?.getAttribute("data-member-id") ?? null) !== ${JSON.stringify(firstTop)}`, "→ to bring another card to the front", 2000);
      await sleep(500);
      await arrow("ArrowLeft", "ArrowLeft", 37);
      await until(b, `document.querySelector(${JSON.stringify(`.item[data-item-id="${group}"] .stack-card.top`)})?.getAttribute("data-member-id") === ${JSON.stringify(firstTop)}`, "← to bring the first card back to the front", 2000);
      await sleep(500);
      const boxAfter = JSON.stringify((({ x, y }) => ({ x, y }))(groupBox()));
      if (boxAfter !== boxBefore) throw new Error(`flipping moved the stack: ${boxAfter} (was ${boxBefore})`);
      if (JSON.stringify(saved()) !== JSON.stringify(before)) throw new Error("flipping changed a member's stored box");

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
     * real mouse steps, crossing the row below Arrange, and chooses Align
     * bottom, far down its submenu; then walks straight DOWN from Arrange and
     * insists the menu does let go. (Align was a root row until 14 Oct 2026;
     * it lives under Arrange › now.)
     */
    what: "a diagonal from Arrange › across the row below keeps the submenu and chooses Align bottom; straight down lets it go",
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
      // Both cards selected, so Arrange is offered; then the menu, by a real right-click.
      const a = await centre(`.item[data-item-id="${cards[0]}"]`), c = await centre(`.item[data-item-id="${cards[1]}"]`);
      await press(a, { button: "left" });
      await press(c, { button: "left", modifiers: 8 });
      const ROOT = `.context-menu:not(.context-submenu)`;
      const ARRANGE = `${ROOT} > .context-sub > button[aria-haspopup="menu"]`;
      const findArrange = `[...document.querySelectorAll(${JSON.stringify(ARRANGE)})].find((el) => el.textContent.trim().startsWith("Arrange"))`;
      const openMenu = async () => {
        await mouse("mouseMoved", c.x, c.y);
        await press(c, { button: "right" });
        await until(b, `!!${findArrange} && !${findArrange}.disabled`, "the item menu, with Arrange offered for two cards", 4000);
        const row = await b.ev(`(() => { const r = ${findArrange}.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), left: Math.round(r.left), h: Math.round(r.height) }; })()`);
        // Onto Arrange from its left, the way a hand arrives, and wait out the beat.
        await walk({ x: row.left + 4, y: row.y }, row, 4);
        await until(b, `${findArrange}.getAttribute("aria-expanded") === "true" && !!document.querySelector(".context-submenu")`, "hovering Arrange to open its submenu", 2000);
        return row;
      };
      const subOpen = `${findArrange}?.getAttribute("aria-expanded") === "true" && !!document.querySelector(".context-submenu")`;

      // 1. The diagonal: Arrange's centre to Align bottom, far down its submenu, crossing the rows below Arrange.
      const row = await openMenu();
      const far = await b.ev(`(() => { const el = [...document.querySelectorAll(".context-submenu button")].find((e) => e.textContent.trim() === "Align bottom"); el.setAttribute("data-journey-far", ""); const r = el.getBoundingClientRect(); return { x: Math.round(r.left + 12), y: Math.round(r.top + r.height / 2), label: el.textContent.trim() }; })()`);
      const crossed = new Set();
      const diagonalAt = Date.now();
      await walk(row, far, 24, async (at) => {
        const over = await b.ev(`(() => { const el = document.elementFromPoint(${at.x}, ${at.y})?.closest("button"); return el && !el.closest(".context-submenu") && el !== ${findArrange} ? el.textContent.trim() : null; })()`);
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
      if (far.label !== "Align bottom" || bottoms[0] !== bottoms[1]) throw new Error(`choosing "${far.label}" did not align the bottoms: ${JSON.stringify(bottoms)}`);

      // 2. Straight down from Arrange is choosing another row: the submenu lets go.
      await openMenu();
      const below = await b.ev(`(() => { let el = ${findArrange}.parentElement.nextElementSibling; while (el && el.classList.contains("context-sep")) el = el.nextElementSibling; const r = el.getBoundingClientRect(); return { x: ${row.x}, y: Math.round(r.top + r.height / 2), label: el.textContent.trim() }; })()`);
      const leftAt = Date.now();
      await walk(row, below, 4);
      await until(b, `!(${subOpen})`, `moving straight down onto "${below.label}" to close Arrange's submenu`, 1500);
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
    name: "critique",
    /**
     * **Critique, scene 3, in a browser** (critique phase 4,
     * `docs/projects/critique/journey.md`). Add two critics in the Critics
     * dialog, right-click a screen → *Critique with…* both, see their pins in
     * two colours, post the read, see its split, press *Build both*, and see
     * two variations each citing the note it answers.
     *
     * Its own home and daemon, because it writes a `config.json` naming the
     * scripted harness as the machine's default. **Nothing here runs a
     * model**: `packages/cli/test/fake-acp.mjs` is every harness, and its
     * `FAKE_ACP_ACT` hook runs the act below as the summoned agent — the
     * critics pin notes and say done through `isocan critique`, the builder
     * adds two variations through `isocan add`. Every write the browser makes
     * is the real request: the enrolment rings the parked rc through the ask
     * route, and nothing on the page is stubbed.
     *
     * When it fails: `CRITIQUE_SHOT=<file.png>` keeps the screen at a press
     * that could not land, and `CRITIQUE_RC_LOG=<file>` the parked rc's output.
     */
    what: "two critics added in the panel, asked from a screen's menu, pin in two colours; the read's split builds both",
    async run(rig) {
      const { b } = rig;
      /** A button in a scrolling list, scrolled to and pressed for real. */
      const pressButton = async (scope, text, what) => {
        await until(b, `[...document.querySelectorAll(${JSON.stringify(scope)})].some(e => e.textContent.trim().startsWith(${JSON.stringify(text)}))`, what, 15_000);
        await b.ev(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(scope)})].find(e => e.textContent.trim().startsWith(${JSON.stringify(text)})); el.scrollIntoView({ block: "center" }); el.setAttribute("data-journey-press", ""); return true; })()`);
        await sleep(300);
        try { await rig.click("[data-journey-press]", what); } catch (err) {
          if (process.env.CRITIQUE_SHOT) writeFileSync(process.env.CRITIQUE_SHOT, Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
          throw err;
        } finally { await b.ev(`(() => { document.querySelector("[data-journey-press]")?.removeAttribute("data-journey-press"); return true; })()`); }
      };
      /** Mark the pin whose title matches `pattern`, or say which pins there were. */
      const markPin = async (pattern, attr, what) => {
        const titles = await b.ev(`(() => {
          document.querySelector("[${attr}]")?.removeAttribute("${attr}");
          const pins = [...document.querySelectorAll(".pin")];
          const p = pins.find((p) => new RegExp(${JSON.stringify(pattern)}).test(p.title));
          if (!p) return pins.map((p) => p.title);
          p.setAttribute("${attr}", "");
          return null;
        })()`);
        if (titles) throw new Error(`no pin for ${what} (/${pattern}/) — the pins read:\n  ${titles.join("\n  ")}`);
      };
      const home = mkdtempSync(path.join(tmpdir(), "isocan-journey-critique-"));
      const fakeAcp = path.join(repo, "packages/cli/test/fake-acp.mjs");
      const act = path.join(home, "act.mjs");
      writeFileSync(path.join(home, "identity.json"), JSON.stringify({ id: "usr_crit_ada", name: "Ada", createdAt: new Date().toISOString() }));
      writeFileSync(path.join(home, "config.json"), JSON.stringify({ adapterEnv: ["FAKE_ACP_*"], acpAdapters: { "claude-code": [process.execPath, fakeAcp] }, defaultHarness: "claude-code" }));
      // The turn's work. Two critics whose notes make one agreement (the
      // price, both "make it larger") and one split (the photo: remove
      // against make it larger) — the scene's own shape.
      writeFileSync(act, `
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
const NOTES = {
  "Inevitable": [["0.5,0.3", "risk", "2", "The photo pulls the eye from the one thing this screen is for. Remove the photo."],
                 ["0.7,0.8", "risk", "1", "The price is too quiet beside the photo. Make the price larger."]],
  "Form Follows Emotion": [["0.52,0.32", "risk", "1", "The photo is the only warmth on the screen, and it is small. Make the photo larger and warmer."],
                           ["0.72,0.79", "risk", "2", "The price whispers. Make the price larger."]],
};
export default async function act({ prompt, cli, cwd }) {
  const who = /^You are (.+?), an agent enrolled/.exec(prompt)?.[1] ?? "";
  const canvasId = /"canvasId":\\s*"([^"]+)"/.exec(prompt)?.[1];
  const threadId = /"threadId":\\s*"([^"]+)"/.exec(prompt)?.[1];
  const payload = JSON.parse(prompt.slice(prompt.indexOf("returns):\\n") + 10));
  const run = (...args) => execFileSync(process.execPath, [cli, "--canvas", canvasId, ...args], { encoding: "utf8" });
  if (NOTES[who]) {
    const item = payload.item?.id;
    for (const [at, kind, q, text] of NOTES[who]) run("critique", "note", item, "--at", at, "--kind", kind, "--question", q, text);
    run("critique", "done", item);
    return;
  }
  const strings = [];
  const walk = (v) => { if (typeof v === "string") strings.push(v); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  walk(payload);
  const brief = strings.find((s) => s.includes("build both sides of this split"));
  if (!brief) return;
  const ideas = ["without the photo", "the photo larger and warmer"];
  const sides = [...brief.matchAll(/--title "([^"]+)" --prop parent=(\\S+) --prop critique\\.answers=([^\\s\`]+)/g)];
  sides.forEach(([, title, parent, answers], i) => {
    const file = path.join(cwd, "variation-" + (i + 1) + ".html");
    writeFileSync(file, "<main><h1>Acme checkout</h1><p>" + ideas[i] + "</p><button>Pay</button></main>");
    run("add", file, "--title", title.replace("<the idea>", ideas[i]), "--prop", "parent=" + parent, "--prop", "critique.answers=" + answers);
  });
  if (threadId) run("comment", "reply", threadId, "Built both: one " + ideas[0] + ", one with " + ideas[1] + ".");
}
`);
      const daemon = await startDaemon(home);
      const { origin } = daemon;
      // The harness variables of whoever runs this must not decide who the
      // CLI speaks as: the person is the home's identity, the agents are the rc's.
      const env = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(origin).port, FAKE_ACP_ACT: act, FAKE_ACP_CLI: cli };
      for (const name of ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_ENTRYPOINT", "ISOCAN_SESSION_ID", "ISOCAN_HARNESS", "CODEX_SANDBOX", "CODEX_THREAD_ID"]) delete env[name];
      const runCli = (...args) => {
        const out = execFileSync(process.execPath, [cli, "--json", ...args], { cwd: home, encoding: "utf8", env });
        return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out;
      };
      let rc = null;
      let rcOut = "";
      try {
        const id = runCli("canvas", "create", "Acme critique").canvasId;
        const screenFile = path.join(home, "checkout.html");
        writeFileSync(screenFile, "<main><img alt='a loaf' src='data:,'><h1>Acme checkout</h1><p class='price'>$12</p><button>Pay</button></main>");
        const screen = runCli("--canvas", id, "add", screenFile, "--title", "Checkout", "--size", "390x700").itemId;
        const scoutDir = path.join(home, "scout");
        execFileSync("mkdir", ["-p", scoutDir]);
        runCli("--canvas", id, "rc", "add", "Scout", "--dir", scoutDir);
        const snapshot = () => b.ev(`fetch('/api/projects/${id}/canvas', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json()).then(r => r.canvas)`);

        // The runner, parked: every agent's turn is the scripted harness.
        rc = spawn(process.execPath, [cli, "--canvas", id, "rc"], { cwd: home, env, stdio: ["ignore", "pipe", "pipe"] });
        rc.stdout.on("data", (c) => (rcOut += c));
        rc.stderr.on("data", (c) => (rcOut += c));

        // Ada, in the browser, with the experiment on.
        const { address } = runCli("--canvas", id, "pass");
        await b.send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
        const loaded = b.once("Page.loadEventFired");
        await b.send("Page.navigate", { url: origin });
        await Promise.race([loaded, sleep(15_000)]);
        await b.ev(`(() => { localStorage.clear(); localStorage.setItem("isocan.experiments", JSON.stringify(["critique"])); return true; })()`);
        await b.send("Page.navigate", { url: address });
        await sleep(2500);
        await until(b, `!!document.querySelector('.item[data-item-id="${screen}"]')`, "the Checkout screen on Ada's canvas", 20_000);
        try {
          await until(b, `fetch('/api/projects/${id}/rc', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json()).then(r => r.parked)`, "Ada's rc to park", 20_000);
        } catch (err) {
          const seen = await b.ev(`fetch('/api/projects/${id}/rc', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(async r => r.status + " " + await r.text())`);
          throw new Error(`${err.message} — the page reads ${seen}\n${rcOut.slice(-2000)}`);
        }
        const versionBefore = (await snapshot()).items[screen].currentVersionId;

        // 1. Critics, from the palette: add two from the roster.
        await rig.press("k", { meta: true });
        await until(b, `!!document.querySelector('.palette')`, "the launcher");
        await rig.type("Critics");
        await rig.clickText(".palette-row", "Critics", "the Critics entry");
        await until(b, `!!document.querySelector('button[aria-label="Add Inevitable"]')`, "the roster in the Critics dialog — read from the daemon", 10_000);
        await rig.click('button[aria-label="Add Inevitable"]', "Add Inevitable");
        await until(b, `!!document.querySelector('button[aria-label="Inevitable is on this canvas"]')`, "Inevitable added", 10_000);
        await rig.click('button[aria-label="Add Form Follows Emotion"]', "Add Form Follows Emotion");
        await until(b, `!!document.querySelector('button[aria-label="Form Follows Emotion is on this canvas"]')`, "Form Follows Emotion added", 10_000);
        const cards = runCli("--canvas", id, "critic", "ls");
        const names = cards.critics.map((c) => c.agentName).sort();
        if (JSON.stringify(names) !== JSON.stringify(["Form Follows Emotion", "Inevitable"])) throw new Error(`critic ls reads ${JSON.stringify(names)} after the dialog's two adds`);
        // The same card the terminal writes: the pack's lens, its headings included.
        const inevitable = cards.critics.find((c) => c.agentName === "Inevitable");
        if (inevitable.questions.length !== 3 || !inevitable.credit.endsWith("; not affiliated")) throw new Error(`the web's Inevitable is not the roster's: ${JSON.stringify(inevitable)}`);
        await rig.press("Escape");
        await until(b, `!document.querySelector('.modal-backdrop')`, "the Critics dialog to close");

        // 2. Right-click the screen → Critique with… → both. Adding a card
        // glided the camera to it, so first the whole canvas, as a person would.
        await rig.click(".zoom-pct", "the zoom menu");
        await rig.clickText(".zoom-menu-row", "Zoom to Fit", "Zoom to Fit");
        await sleep(800);
        const centre = await b.ev(`(() => { const r = document.querySelector('.item[data-item-id="${screen}"]').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height * 0.6) }; })()`);
        const mouse = (type, button) => b.send("Input.dispatchMouseEvent", { type, x: centre.x, y: centre.y, button, buttons: type === "mousePressed" ? (button === "right" ? 2 : 1) : 0, clickCount: 1 });
        await mouse("mousePressed", "left");
        await mouse("mouseReleased", "left");
        await mouse("mousePressed", "right");
        await mouse("mouseReleased", "right");
        await sleep(500);
        const menuText = await b.ev(`[...document.querySelectorAll('.context-menu [role=menuitem]')].map(e => e.textContent.trim()).join(' | ')`);
        await rig.clickText(".context-menu [role=menuitem]", "Critique with", `Critique with… in the screen's menu (it offers: ${menuText})`);
        await until(b, `document.querySelectorAll('.crit-pick input[type=checkbox]').length === 2`, "both critics offered", 10_000);
        await b.ev(`(() => { document.querySelectorAll('.crit-pick label.crit-row').forEach((l, i) => l.setAttribute('data-crit', String(i))); return true; })()`);
        await rig.click('label[data-crit="0"] input', "the first critic's box");
        await rig.click('label[data-crit="1"] input', "the second critic's box");
        await pressButton(".crit-actions button", "Ask 2 critics", "Ask 2 critics");
        await until(b, `!document.querySelector('.modal-backdrop')`, "the ask to land and the dialog to close", 40_000);

        // 3. Both enrolled on Ada's runner, capped, and their notes pinned in their colours.
        await until(b, `fetch('/api/projects/${id}/canvas', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json()).then(r => Object.values(r.canvas.agents ?? {}).filter(a => a.ceiling === 'note').length === 2)`, "both critics enrolled and capped at notes", 30_000);
        try {
          await until(b, `fetch('/api/projects/${id}/canvas', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json()).then(r => Object.values(r.canvas.threads).some(t => t.comments.some(c => c.body.includes('every critic asked here is done'))))`, "the last critic to say the read is ready", 60_000);
        } catch (err) {
          // What the request thread holds instead: two "Done — " lines and
          // no ready line is the critics racing each other, not a slow rc.
          const said = Object.values((await snapshot()).threads)
            .filter((t) => t.comments.some((c) => /^Done — /.test(c.body)))
            .flatMap((t) => t.comments.map((c) => `${c.author.name}: ${c.body.split("\n").join(" / ").slice(0, 160)}`));
          throw new Error(`${err.message} — the request thread reads:\n  ${said.join("\n  ") || "(no thread with a done line)"}\n--- rc ---\n${rcOut.slice(-1500)}`);
        }
        const canvas = await snapshot();
        const critics = Object.values(canvas.agents).filter((a) => a.ceiling === "note");
        const colours = await b.ev(`fetch('/api/colors').then(r => r.json())`);
        const wanted = { Inevitable: "#0071e3" };
        for (const c of critics) if (wanted[c.actor.name] && colours[c.actor.id]?.toLowerCase() !== wanted[c.actor.name]) throw new Error(`${c.actor.name} wears ${colours[c.actor.id]}, not its card's ${wanted[c.actor.name]}`);
        const noteThreads = Object.values(canvas.threads).filter((t) => t.anchorItemId === screen && /^\*\*Risk\*\* · question/.test(t.comments[0].body));
        if (noteThreads.length !== 4) throw new Error(`${noteThreads.length} notes on the screen, not 4`);
        const pinColours = await b.ev(`(() => [...new Set([...document.querySelectorAll('.pin')].filter(p => /Risk/.test(p.title)).map(p => getComputedStyle(p.querySelector('.pin-avatar')).backgroundColor))])()`);
        if (pinColours.length !== 2) throw new Error(`the notes' pins wear ${JSON.stringify(pinColours)} — not two colours`);

        // A pin opens its note where it is pinned — once the arrival toasts,
        // which sit over the screen's corner, have said their piece.
        await until(b, `!document.querySelector('.toast-said')`, "the comment toasts to clear", 30_000);
        await markPin("^(?=[\\s\\S]*Inevitable)(?=[\\s\\S]*question 2)", "data-journey-pin", "Inevitable's question-2 note");
        const pinAt = await b.ev(`(() => { const r = document.querySelector('[data-journey-pin]').getBoundingClientRect(); return { x: r.left, y: r.top }; })()`);
        // Two critics pinned one region, so the later pin overlaps this one:
        // pressed on its uncovered top-left, where a person would aim.
        await rig.click("[data-journey-pin]", "Inevitable's photo note", { x: 0.2, y: 0.2 });
        await until(b, `/Remove the photo/.test(document.querySelector('.thread-popover')?.textContent ?? '')`, "the note opened");
        const pop = await b.ev(`(() => { const r = document.querySelector('.thread-popover').getBoundingClientRect(); return { x: r.left, y: r.top }; })()`);
        if (Math.abs(pop.x - pinAt.x) > 340 || Math.abs(pop.y - pinAt.y) > 240) throw new Error(`the note opened at ${JSON.stringify(pop)}, far from its pin at ${JSON.stringify(pinAt)}`);
        await rig.press("Escape");

        // 4. The request thread: post the read; it carries a split. Its pin
        // shows its newest comment: the last critic's done with the ready line
        // folded in, or, when the two critics finished at once, the ready line
        // on its own (`owesReadyLine`, 14 Oct 2026).
        await markPin("what do you make of|Done — |every critic", "data-journey-request", "the request thread");
        await rig.click("[data-journey-request]", "the request thread's pin");
        await pressButton(".thread-popover button", "Post the read", "Post the read… under the ready line");
        await until(b, `/They split/.test(document.querySelector('.crit-read')?.textContent ?? '')`, "the read, with its split, in the dialog", 10_000);
        await b.ev(`(() => { const t = document.querySelector('.crit-say textarea'); t.setAttribute('data-journey-say', ''); return true; })()`);
        await rig.click("[data-journey-say]", "the words field");
        await rig.type("Reduction against warmth: one would cut the photo, one would make it the voice.");
        await pressButton(".crit-actions button", "Post the read", "Post the read");
        await until(b, `!document.querySelector('.modal-backdrop')`, "the read posted");
        // The thread closed for the dialog; open it again from its pin.
        await until(b, `!document.querySelector('.toast-said')`, "the comment toasts to clear", 30_000);
        await markPin("what do you make of|Done — |every critic|They agree|Reduction", "data-journey-request", "the request thread, again");
        await rig.click("[data-journey-request]", "the request thread's pin, again");
        await until(b, `[...document.querySelectorAll('.thread-popover .comment')].some(c => /They split/.test(c.textContent) && /Reduction against warmth/.test(c.textContent))`, "the posted read in the request thread", 10_000);

        // 5. Build both.
        await pressButton(".thread-popover button", "Build both", "Build both… under the posted read");
        await until(b, `!!document.querySelector('.crit-pick input[type=radio]:checked')`, "a builder chosen", 10_000);
        const builder = await b.ev(`document.querySelector('.crit-pick input[type=radio]:checked').closest('label').textContent`);
        if (!/Scout/.test(builder)) throw new Error(`the builder offered is ${builder}, not Scout — a critic must never be`);
        if (await b.ev(`[...document.querySelectorAll('.crit-pick label')].some(l => /Inevitable|Form Follows/.test(l.textContent))`)) throw new Error("a critic is offered as a builder");
        await pressButton(".crit-actions button", "Build both", "Build both");
        await until(b, `!document.querySelector('.modal-backdrop')`, "the ask to build both sent");
        await until(b, `fetch('/api/projects/${id}/canvas', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json()).then(r => Object.values(r.canvas.items).filter(i => i.properties.parent === '${screen}' && i.properties['critique.answers']).length === 2)`, "two variations of the screen", 60_000);
        const after = await snapshot();
        const variations = Object.values(after.items).filter((i) => i.properties.parent === screen);
        const answered = new Set(variations.map((v) => v.properties["critique.answers"]));
        const authors = new Set([...answered].map((t) => after.threads[t]?.comments[0].author.name));
        if (answered.size !== 2 || authors.size !== 2) throw new Error(`the variations answer ${[...answered]} by ${[...authors]} — not one note per critic`);
        for (const v of variations) await until(b, `!!document.querySelector('.item[data-item-id="${v.id}"]')`, `${v.title} on Ada's canvas`, 10_000);
        if (versionBefore && after.items[screen].currentVersionId !== versionBefore) throw new Error("the screen's version moved — critics and the builder must leave it as it is");
        const errors = b.takeErrors();
        if (errors.length > 0) throw new Error(`the page threw: ${errors[0]}`);
        return { critics: critics.map((c) => c.actor.name), pins: pinColours, variations: variations.map((v) => v.title) };
      } catch (err) {
        if (process.env.CRITIQUE_RC_LOG) writeFileSync(process.env.CRITIQUE_RC_LOG, rcOut);
        throw err;
      } finally {
        if (rc) {
          rc.kill("SIGINT");
          await new Promise((r) => { rc.once("exit", r); setTimeout(r, 3000); });
          if (rc.exitCode === null) rc.kill("SIGKILL");
        }
        await daemon.stop();
        rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        await b.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
      }
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
    name: "proactive-proposal",
    /**
     * **A proposal, and a delete that teaches** (proactive-agent phase 1,
     * journey scene 1, `docs/projects/proactive-agent/phases.md`).
     *
     * The agent is a stub: the terminal speaking as Kit — `propose`, a parked
     * `wait`, and `taste` — not a model. What is under test is the canvas:
     * the proposal hangs beneath its source with its chip, ⌫ trashes it, a
     * comment carrying `deleted` reaches the parked author, and the line it
     * writes lands in the pinned taste note; then, with nothing parked for
     * Kit, a second delete still happens and the toast says the note was not
     * taken. Screenshots of both moments are returned for a person.
     */
    what: "a proposal hangs beneath its source; Delete trashes it, reaches its author, and the taste note gains a line",
    async run(rig) {
      const env = { ...process.env, ISOCAN_HOME: rig.home, ISOCAN_PORT: new URL(rig.origin).port };
      const runCli = (args, extra = {}) =>
        execFileSync(process.execPath, [cli, ...args], { cwd: rig.home, encoding: "utf8", env: { ...env, ...extra } });
      const shot = async (name) => {
        const file = path.join(tmpdir(), `isocan-proactive-${name}-${Date.now()}.png`);
        writeFileSync(file, Buffer.from((await rig.b.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
        return file;
      };

      writeFileSync(path.join(rig.home, "identity.json"), JSON.stringify({ id: "usr_pp_maya", name: "Maya", createdAt: new Date().toISOString() }));
      runCli(["bench", "add", "Kit", "--actor", "usr_pp_kit", "--harness", "pi"]);
      const kit = { ISOCAN_SESSION_ID: "journey-kit" };
      runCli(["identity", "--as", "usr_pp_kit", "--name", "Kit"], kit);

      const id = JSON.parse(runCli(["--json", "canvas", "create", "Acme Bakery"])).canvasId;
      const page = path.join(rig.home, "checkout.html");
      writeFileSync(page, "<!doctype html><title>Checkout</title><body style='font:16px system-ui;padding:24px'><h1>Checkout</h1><p>Sourdough loaf × 1</p><p><b>Total $8</b></p><p>Pickup: Saturday 9:00</p></body>");
      const source = JSON.parse(runCli(["--json", "--canvas", id, "add", page, "--at", "0,0", "--size", "390x520", "--title", "Checkout"])).itemId;
      const ask = JSON.parse(runCli(["--json", "--canvas", id, "comment", "add", "people miss the pickup slot", "--at", "420,40"]));
      const commentId = ask.commentId ?? ask.comment?.id;
      if (!commentId) throw new Error(`comment add named no comment: ${JSON.stringify(ask)}`);

      const better = path.join(rig.home, "checkout-pickup-first.html");
      writeFileSync(better, "<!doctype html><title>Checkout</title><body style='font:16px system-ui;padding:24px'><h1>Checkout</h1><p><b>Pickup: Saturday 9:00</b></p><p>Sourdough loaf × 1</p><p>Total $8</p></body>");
      const why = "Summary before detail: the pickup time is what the person must check, so it comes first.";
      const first = JSON.parse(runCli(["--json", "--canvas", id, "propose", source, better, "--cites", `comment:${commentId}`, "--why", why], kit)).itemId;

      const { address } = JSON.parse(runCli(["--json", "--canvas", id, "pass"]));
      await rig.b.ev(`(() => { localStorage.clear(); return true; })()`);
      await rig.b.send("Page.navigate", { url: address });
      await sleep(2500);
      await until(rig.b, `!!document.querySelector(".world")`, "the canvas to open for Maya");
      const mark = `document.querySelector('[data-proposal="${first}"]')`;
      await until(rig.b, `!!${mark}?.querySelector(".proposal-chip")`, "the proposal's mark and chip", 10_000);
      const chip = await rig.b.ev(`${mark}.querySelector(".proposal-chip").textContent`);
      if (!/Maya's comment, “people miss the pickup slot”/.test(chip)) throw new Error(`the chip does not name its trigger: ${chip}`);
      const geometry = await rig.b.ev(`(() => {
        const s = document.querySelector('[data-item-id="${source}"]').getBoundingClientRect();
        const p = document.querySelector('[data-item-id="${first}"]').getBoundingClientRect();
        return { below: p.top >= s.bottom, overlap: !(p.right <= s.left || p.left >= s.right || p.bottom <= s.top || p.top >= s.bottom) };
      })()`);
      if (!geometry.below || geometry.overlap) throw new Error(`the proposal does not hang beneath its source: ${JSON.stringify(geometry)}`);
      const terms = await rig.b.ev(`[...${mark}.querySelectorAll(".proposal-term")].map(t => t.firstChild.textContent)`);
      if (!terms.includes("Summary before detail")) throw new Error(`the why underlines nothing: ${JSON.stringify(terms)}`);
      const beneath = await shot("beneath");

      // Kit appears and parks — the stub agent's lap, so the delete has somebody to reach.
      runCli(["--canvas", id, "session", "start", "--label", "Kit 🤖"], kit);
      const parked = spawn(process.execPath, [cli, "--canvas", id, "wait", "--json", "--timeout", "60"], { cwd: rig.home, env: { ...env, ...kit }, stdio: ["ignore", "pipe", "pipe"] });
      let woke = "";
      parked.stdout.on("data", (c) => (woke += c));
      const exited = new Promise((r) => parked.once("exit", r));
      await sleep(3000);

      await rig.type("v");
      await rig.click(`[data-item-id="${first}"] .item-titlebar .chrome-left`, "the proposal's title");
      await until(rig.b, `!!document.querySelector('[data-item-id="${first}"].selected')`, "the proposal selected");
      await rig.press("Delete");
      await until(rig.b, `!document.querySelector('[data-item-id="${first}"]')`, "the proposal to leave the canvas");
      await until(rig.b, `!!document.querySelector(".proposal-toast")`, "the delete's toast");
      const taken = await rig.b.ev(`document.querySelector(".proposal-toast p").textContent`);
      if (!/Kit will note what it taught/.test(taken)) throw new Error(`the toast does not say Kit will take the note: ${taken}`);
      await rig.click(".proposal-toast input", "the toast's reason");
      await rig.type("it pushed the total down");
      await rig.press("Enter");
      await Promise.race([exited, sleep(15_000)]);
      if (!/"deleted":\s*"/.test(woke) || !woke.includes(first)) throw new Error(`Kit's wait did not wake on the delete's comment: ${woke.slice(0, 400)}`);
      if (!woke.includes("it pushed the total down")) throw new Error("the reason did not travel with the comment");

      // Kit answers the way the guide says: one line in the taste note.
      runCli(["--canvas", id, "taste", "Keep the total near the button; move the pickup up, not the price down."], kit);
      // Read back from the home: the note sits above everything, which may be
      // off this viewport, and an item off screen is not drawn.
      const note = JSON.parse(runCli(["--json", "--canvas", id, "taste"]));
      if (!note.text.includes("- Keep the total near the button")) throw new Error(`the taste note did not gain the line: ${note.text}`);
      const shown = JSON.parse(runCli(["--json", "--canvas", id, "show", note.itemId]));
      if (shown.properties.taste !== "1" || shown.properties.context !== "pinned") throw new Error(`the taste note is not pinned: ${JSON.stringify(shown.properties)}`);

      // Nobody parked now: the second delete still happens, and says the note was not taken.
      runCli(["--canvas", id, "session", "end"], kit);
      const second = JSON.parse(runCli(["--json", "--canvas", id, "propose", source, better, "--cites", `comment:${commentId}`, "--why", "Proximity: price beside the button.", "--hunch"], kit)).itemId;
      await until(rig.b, `!!document.querySelector('[data-proposal="${second}"] .proposal-chip')`, "the second proposal's mark", 10_000);
      await rig.click(`[data-item-id="${second}"] .item-titlebar .chrome-left`, "the second proposal's title");
      await until(rig.b, `!!document.querySelector('[data-item-id="${second}"].selected')`, "the second proposal selected");
      await rig.press("Delete");
      await until(rig.b, `!document.querySelector('[data-item-id="${second}"]')`, "the second proposal to leave the canvas");
      await until(rig.b, `/not taken/.test(document.querySelector(".proposal-toast p")?.textContent ?? "")`, "the toast to say the note was not taken");
      const untaken = await shot("untaken");
      const trash = JSON.parse(runCli(["--json", "--canvas", id, "trash", "ls"]));
      const trashed = JSON.stringify(trash);
      if (!trashed.includes(first) || !trashed.includes(second)) throw new Error("the deletes did not reach the trash");
      const errors = rig.b.takeErrors();
      if (errors.length > 0) throw new Error(`the page threw: ${errors[0]}`);
      return { screenshots: { beneath, untaken } };
    },
  },
  {
    name: "proactive-night-watch",
    /**
     * **The night watch** (proactive-agent phase 2, journey scene 2,
     * `docs/projects/proactive-agent/phases.md`).
     *
     * Its own home and daemon, because it writes a `config.json` naming the
     * scripted harness: **no model runs**. `packages/cli/test/fake-acp.mjs`
     * is Kit's harness and its `FAKE_ACP_ACT` hook is Kit — summoned by the
     * real `isocan rc` on every Chat message, reading the night with
     * `isocan goodnight read`, answering in the thread, and only after
     * "That's the plan" writing the note and the promised frames, then
     * filling what is still ticked and posting the brief.
     *
     * Maya types `/goodnight` in the Chat, steers once (naming Checkout for a
     * rework), presses **That's the plan**, sees the note and a promised
     * frame, and unticks the contrast check — its frame goes. The night fills
     * the basket's frame and edits Checkout, the one original she named, and
     * nothing else of hers. Then, with Kit dismissed, a second `/goodnight`
     * writes a note that promises nothing and says why. Screenshots of the
     * conversation and of the note with its frame are returned for a person.
     */
    what: "/goodnight opens a talk with the lead; That's the plan writes the note and frames; untick takes a frame; with nobody to answer the note promises nothing",
    async run(rig) {
      const { b } = rig;
      const home = mkdtempSync(path.join(tmpdir(), "isocan-journey-night-"));
      const kitDir = path.join(home, "kit");
      const fakeAcp = path.join(repo, "packages/cli/test/fake-acp.mjs");
      const act = path.join(home, "act.mjs");
      execFileSync("mkdir", ["-p", kitDir]);
      writeFileSync(path.join(home, "identity.json"), JSON.stringify({ id: "usr_night_maya", name: "Maya", createdAt: new Date().toISOString() }));
      writeFileSync(path.join(home, "config.json"), JSON.stringify({ adapterEnv: ["FAKE_ACP_*"], acpAdapters: { "claude-code": [process.execPath, fakeAcp] }, defaultHarness: "claude-code" }));
      // Kit, scripted: the conversation's three turns and the night's work.
      writeFileSync(act, `
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
export default async function act({ prompt, cli, cwd }) {
  const canvasId = /"canvasId":\\s*"([^"]+)"/.exec(prompt)?.[1];
  const run = (...args) => execFileSync(process.execPath, [cli, "--canvas", canvasId, ...args], { encoding: "utf8" });
  const json = (...args) => JSON.parse(execFileSync(process.execPath, [cli, "--json", "--canvas", canvasId, ...args], { encoding: "utf8" }));
  const read = json("goodnight", "read");
  if (!read.youLead || !read.conversation) return;
  const listed = json("comment", "ls");
  const main = (Array.isArray(listed) ? listed : listed.threads).find((t) => t.main);
  const at = main.comments.findIndex((c) => c.id === read.conversation.askId);
  const kitSaid = main.comments.slice(at + 1).some((c) => c.author.name === "Kit");
  if (read.conversation.planned) {
    json("goodnight", "note",
      "--promise", "Basket | three takes on the empty basket, one a sketch | three takes",
      "--promise", "Order history | check the red against contrast | one take",
      "--edit", "Checkout | pickup first | one new version",
      "--thought", "The basket is the first thing a regular sees on a slow week.");
    run("comment", "reply", main.id, "The note is on the canvas: untick anything you do not want. I start in a moment.");
    const go = path.join(cwd, "night-go");
    for (let i = 0; i < 240 && !existsSync(go); i++) await new Promise((r) => setTimeout(r, 250));
    const now = json("goodnight", "show", "--for", "Maya");
    for (const line of now.lines.filter((l) => l.ticked)) {
      const file = path.join(cwd, "take-" + line.n + ".html");
      if (line.edit) {
        writeFileSync(file, "<!doctype html><title>Checkout</title><body style='font:16px system-ui;padding:24px'><h1>Checkout</h1><p><b>Pickup: Saturday 9:00</b></p><p>Sourdough loaf × 1</p><p>Total $8</p></body>");
        run("goodnight", "fill", line.on, file);
      } else {
        writeFileSync(file, "<!doctype html><title>Basket</title><body style='font:16px system-ui;padding:24px'><h1>Your basket is empty</h1><p>Today's loaf: sourdough. Order by Friday.</p></body>");
        run("goodnight", "fill", line.frame, file, "--hunch", "--why", "Empty states teach: show the first step, not the void.");
      }
    }
    run("goodnight", "done", "One hunch on the empty basket. Checkout reworked, pickup first. You unticked the contrast check, so I left it alone.");
    return;
  }
  const settled = read.settled.map((s) => s.what).join("; ") || "nothing yet";
  const open = read.open.map((s) => s.what).join("; ") || "nothing";
  if (!kitSaid) {
    run("comment", "reply", main.id, "**Settled today:** " + settled + ". **Left open:** " + open + ". **Tonight I could try:** three takes on the empty Basket, one a sketch (an empty state should teach the first step); a contrast check of the red on Order history; and a rework of Checkout with the pickup time first, but only if you name it for editing.");
    return;
  }
  run("comment", "reply", main.id, "The plan as it stands: three takes on the Basket, beside it; the contrast check on Order history; Checkout reworked, pickup first, because you named it. Say that's the plan when it is right.");
}
`);
      const daemon = await startDaemon(home);
      const { origin } = daemon;
      const env = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(origin).port, FAKE_ACP_ACT: act, FAKE_ACP_CLI: cli };
      for (const name of ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_ENTRYPOINT", "ISOCAN_SESSION_ID", "ISOCAN_HARNESS", "CODEX_SANDBOX", "CODEX_THREAD_ID"]) delete env[name];
      const runCli = (...args) => {
        const out = execFileSync(process.execPath, [cli, "--json", ...args], { cwd: home, encoding: "utf8", env });
        return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out;
      };
      const shot = async (name) => {
        const file = path.join(tmpdir(), `isocan-night-${name}-${Date.now()}.png`);
        writeFileSync(file, Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
        return file;
      };
      let rc = null;
      let rcOut = "";
      try {
        const id = runCli("canvas", "create", "Acme Bakery").canvasId;
        const screens = {};
        for (const [i, title, words] of [[0, "Basket", "Your basket is empty."], [1, "Checkout", "Sourdough loaf × 1 · Total $8 · Pickup: Saturday 9:00"], [2, "Order history", "Last week: two loaves"]]) {
          const file = path.join(home, `screen-${i}.html`);
          writeFileSync(file, `<!doctype html><title>${title}</title><body style='font:16px system-ui;padding:24px'><h1>${title}</h1><p>${words}</p></body>`);
          screens[title] = runCli("--canvas", id, "add", file, "--title", title, "--size", "390x520", "--at", `${i * 470},0`).itemId;
        }
        runCli("--canvas", id, "comment", "add", "/ask Should the empty basket suggest a loaf?", "--item", screens.Basket);
        runCli("--canvas", id, "rc", "add", "Kit", "--dir", kitDir);
        runCli("--canvas", id, "canvas", "edit", "--prop", "proactive=Kit");
        const versions = (itemId) => runCli("--canvas", id, "show", itemId).versions.length;
        const before = { Basket: versions(screens.Basket), Checkout: versions(screens.Checkout), "Order history": versions(screens["Order history"]) };

        rc = spawn(process.execPath, [cli, "--canvas", id, "rc"], { cwd: home, env, stdio: ["ignore", "pipe", "pipe"] });
        rc.stdout.on("data", (c) => (rcOut += c));
        rc.stderr.on("data", (c) => (rcOut += c));

        const { address } = runCli("--canvas", id, "pass");
        await b.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
        const loaded = b.once("Page.loadEventFired");
        await b.send("Page.navigate", { url: origin });
        await Promise.race([loaded, sleep(15_000)]);
        await b.ev(`(() => { localStorage.clear(); return true; })()`);
        await b.send("Page.navigate", { url: address });
        await sleep(2500);
        await until(b, `!!document.querySelector('.item[data-item-id="${screens.Basket}"]')`, "the Basket screen on Maya's canvas", 20_000);
        await until(b, `fetch('/api/projects/${id}/rc', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json()).then(r => r.parked)`, "Maya's rc to park", 20_000);
        const chatText = () => b.ev(`document.querySelector(".main-panel .main-msgs")?.textContent ?? ""`);

        // 1. /goodnight, in the Chat: Kit opens with what it read.
        await rig.click(".main-panel form textarea", "the Chat's input");
        await rig.type("/goodnight long day, the basket bugs me");
        await rig.press("Enter");
        await until(b, `(document.querySelector(".main-panel .main-msgs")?.textContent ?? "").includes("Tonight I could try")`, "Kit's opener in the Chat", 45_000);
        const opener = await chatText();
        if (!/Left open:.*Should the empty basket suggest a loaf\?/.test(opener)) throw new Error(`the opener does not say what is left open: ${opener.slice(-600)}`);

        // 2. She steers, naming Checkout; Kit restates the plan.
        await rig.click(".main-panel form textarea", "the Chat's input");
        await rig.type("rework the checkout screen too, pickup first");
        await rig.press("Enter");
        await until(b, `(document.querySelector(".main-panel .main-msgs")?.textContent ?? "").includes("The plan as it stands")`, "Kit restating the plan", 45_000);
        let early = null;
        try { early = runCli("--canvas", id, "goodnight", "show"); } catch { /* no note yet: the point */ }
        if (early) throw new Error("a note was written before Maya said that's the plan");
        await until(b, `!!document.querySelector(".goodnight-plan button")`, "the That's the plan control under the conversation");
        const conversation = await shot("conversation");

        // 3. That's the plan: the note, and a promised frame under each line's item.
        await rig.click(".goodnight-plan button", "That's the plan");
        await until(b, `!!document.querySelector("[data-handoff]") && document.querySelectorAll('[data-promise="promised"]').length === 2`, "the note and its two promised frames", 45_000);
        const note = runCli("--canvas", id, "goodnight", "show");
        const [basketLine, contrastLine, reworkLine] = note.lines;
        if (!basketLine.frame || !contrastLine.frame || reworkLine.frame || !reworkLine.edit) throw new Error(`the note's lines are not as agreed: ${JSON.stringify(note.lines)}`);
        const under = await b.ev(`(() => {
          const s = document.querySelector('[data-item-id="${screens.Basket}"]').getBoundingClientRect();
          const f = document.querySelector('[data-item-id="${basketLine.frame}"]').getBoundingClientRect();
          return f.top >= s.bottom && Math.abs(f.left - s.left) < 2;
        })()`);
        if (!under) throw new Error("the promised frame does not hang beneath the Basket");
        await rig.click(".zoom-pct", "the zoom menu");
        await rig.clickText(".zoom-menu-row", "Zoom to Fit", "Zoom to Fit");
        await sleep(800);
        const noteShot = await shot("note-and-frame");

        // 3b. No note covers anything (the 33% screenshot, 14 Oct 2026): each
        // proposal's note and tonight's list, measured against every item drawn
        // and every other note, at Fit, 100%, 51% and 33% — light, and dark.
        const apart = async (at) => {
          const hits = await b.ev(`(() => {
            const box = (e) => e.getBoundingClientRect();
            const hit = (a, c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
            const notes = [...document.querySelectorAll(".proposal-note")].filter((n) => box(n).width > 0 && box(n).height > 0)
              .map((n) => ({ of: n.closest("[data-proposal]")?.dataset.proposal ?? n.dataset.handoff, r: box(n) }));
            const items = [...document.querySelectorAll(".item[data-item-id]")].map((e) => ({ id: e.dataset.itemId, r: box(e) }));
            const out = [];
            for (const n of notes) {
              for (const i of items) if (i.id !== n.of && hit(n.r, i.r)) out.push(n.of + " over item " + i.id);
              for (const m of notes) if (m !== n && hit(n.r, m.r)) out.push(n.of + " over note " + m.of);
            }
            return { out, notes: notes.length };
          })()`);
          if (hits.notes === 0) throw new Error(`no note is drawn at ${at}`);
          if (hits.out.length) throw new Error(`a note covers something at ${at}: ${hits.out.join("; ")}`);
        };
        const zoomTo = async (label, outs) => {
          await rig.click(".zoom-pct", "the zoom menu");
          await rig.clickText(".zoom-menu-row", label, label);
          for (let i = 0; i < outs; i++) await rig.click('.zoom-step[title="Zoom out"]', "zoom out");
          await sleep(600);
        };
        const themed = async (name) => {
          const files = {};
          for (const theme of ["light", "dark"]) {
            await b.ev(`(() => { document.documentElement.dataset.theme = ${JSON.stringify(theme)}; return true; })()`);
            await sleep(200);
            files[theme] = await shot(`${name}-${theme}`);
          }
          await b.ev(`(() => { document.documentElement.dataset.theme = "light"; return true; })()`);
          return files;
        };
        await apart("Zoom to Fit");
        // 100%, centred on the Basket's promised frame (selected, framed, then
        // let go, so its note is placed rather than opened).
        await rig.click(`[data-item-id="${basketLine.frame}"] .item-titlebar .chrome-left`, "the Basket's promised frame");
        await zoomTo("Zoom to Selection", 0);
        await zoomTo("Zoom to 100%", 0);
        await rig.press("Escape");
        await sleep(400);
        await apart("100%");
        const at100 = await themed("night-100");
        await zoomTo("Zoom to 100%", 3);
        await apart("51%");
        await zoomTo("Zoom to Fit", 0);
        await zoomTo("Zoom to 100%", 5);
        await apart("33%");
        const at33 = await themed("night-33");
        await zoomTo("Zoom to Fit", 0);

        // 4. She unticks the contrast check: its frame goes, the line stays as an offer.
        // At this zoom tonight's list may stand as its chip alone (pointing at
        // it opens it) or not at all (selecting the note opens it).
        const listMode = await b.ev(`document.querySelector("[data-handoff]").closest("[data-card]").dataset.card`);
        if (listMode === "chip") {
          const tonight = await b.ev(`(() => { const r = document.querySelector("[data-handoff] .proposal-chip").getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
          await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: tonight.x, y: tonight.y });
        } else if (listMode === "none") {
          await rig.click(`[data-item-id="${note.itemId}"] .item-titlebar .chrome-left`, "the goodnight note");
        }
        await sleep(200);
        await rig.click(`[data-handoff] [data-line="2"] input`, "the contrast check's box");
        await until(b, `!document.querySelector('[data-item-id="${contrastLine.frame}"]')`, "the contrast check's frame to go");
        const unticked = runCli("--canvas", id, "goodnight", "show").lines[1];
        if (unticked.ticked || unticked.frame) throw new Error(`line 2 is still a promise: ${JSON.stringify(unticked)}`);

        // 5. The night: Kit fills what is still ticked, and says so.
        writeFileSync(path.join(kitDir, "night-go"), "go");
        await until(b, `fetch('/api/projects/${id}/canvas', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json()).then(r => Object.values(r.canvas.threads).some(t => t.main && t.comments.some(c => c.goodnight?.step === "brief")))`, "the night's brief in the Chat", 60_000);
        const frame = runCli("--canvas", id, "show", basketLine.frame);
        if (frame.properties.proposal !== "hunch") throw new Error(`the basket's frame was not filled as a hunch: ${JSON.stringify(frame.properties)}`);
        const after = { Basket: versions(screens.Basket), Checkout: versions(screens.Checkout), "Order history": versions(screens["Order history"]) };
        if (after.Checkout !== before.Checkout + 1) throw new Error(`Checkout, named for editing, has ${after.Checkout} versions — not one more than ${before.Checkout}`);
        if (after.Basket !== before.Basket || after["Order history"] !== before["Order history"]) throw new Error(`the night edited an original nobody named: ${JSON.stringify({ before, after })}`);
        if (JSON.stringify(runCli("--canvas", id, "ls")).includes(contrastLine.frame)) throw new Error("the unticked line's frame came back");

        // 6. Kit dismissed: a second goodnight promises nothing, and says why.
        runCli("--canvas", id, "rc", "remove", "Kit");
        await rig.click(".main-panel form textarea", "the Chat's input");
        await rig.type("/goodnight again");
        await rig.press("Enter");
        await until(b, `/Nothing can answer overnight/.test(document.querySelector(".main-panel [role=alert]")?.textContent ?? "")`, "the Chat to say nothing can answer", 20_000);
        const quiet = runCli("--canvas", id, "goodnight", "show");
        if (quiet.itemId === note.itemId || quiet.lines.length !== 0 || !/Nothing can answer overnight: "Kit" is named to lead here/.test(quiet.nothing ?? "")) throw new Error(`the second note does not promise nothing with its reason: ${JSON.stringify(quiet)}`);
        const errors = b.takeErrors();
        if (errors.length > 0) throw new Error(`the page threw: ${errors[0]}`);
        return { screenshots: { conversation, note: noteShot, at100, at33 } };
      } catch (err) {
        throw new Error(`${err.message}\n--- rc ---\n${rcOut.slice(-3000)}`);
      } finally {
        if (rc) {
          rc.kill("SIGINT");
          await new Promise((r) => { rc.once("exit", r); setTimeout(r, 3000); });
          if (rc.exitCode === null) rc.kill("SIGKILL");
        }
        await daemon.stop();
        rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    },
  },
  {
    name: "proactive-morning",
    /**
     * **The morning review** (proactive-agent phase 3, journey scene 3,
     * `docs/projects/proactive-agent/phases.md`).
     *
     * The night watch's fixture — its own home, the real `isocan rc`, and
     * `packages/cli/test/fake-acp.mjs` as Kit, so **no model runs** — with
     * Maya's half driven from her terminal: she opens the canvas in the
     * browser (her seen mark), says `/goodnight`, names Checkout for a
     * rework and says that's the plan. Kit promises two takes beside the
     * Basket and a regroup of Order history, edits Checkout, fills the
     * Basket's frames (one sure, one a hunch), fails the regroup with its
     * reason and the take it would have shown, and posts the brief with
     * what it left alone, ready-by now.
     *
     * She comes back (a reload: her mark is older than ready-by): the
     * desktop "While you were away" panel leads with the brief, then the
     * proposals highest confidence first, the failed promise with its
     * reason, Left alone, and Checkout with the version before; her other
     * screens are byte for byte what they were. Seeing it closes the note.
     * After a visit newer than ready-by (`isocan seen --mark`) there is no
     * review. Screenshots of the panel, light and dark, for a person.
     */
    what: "back after /goodnight: the desktop away panel leads with the brief, ≤5 proposals sure-first, a failed promise with its reason, Left alone, the named original's version before; a newer seen mark shows none",
    async run(rig) {
      const { b } = rig;
      const home = mkdtempSync(path.join(tmpdir(), "isocan-journey-morning-"));
      const kitDir = path.join(home, "kit");
      const fakeAcp = path.join(repo, "packages/cli/test/fake-acp.mjs");
      const act = path.join(home, "act.mjs");
      execFileSync("mkdir", ["-p", kitDir]);
      writeFileSync(path.join(home, "identity.json"), JSON.stringify({ id: "usr_morning_maya", name: "Maya", createdAt: new Date().toISOString() }));
      writeFileSync(path.join(home, "config.json"), JSON.stringify({ adapterEnv: ["FAKE_ACP_*"], acpAdapters: { "claude-code": [process.execPath, fakeAcp] }, defaultHarness: "claude-code" }));
      // Kit, scripted: open, restate, then — on "That's the plan" — the note and the whole night.
      writeFileSync(act, `
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
export default async function act({ prompt, cli, cwd }) {
  const canvasId = /"canvasId":\\s*"([^"]+)"/.exec(prompt)?.[1];
  const run = (...args) => execFileSync(process.execPath, [cli, "--canvas", canvasId, ...args], { encoding: "utf8" });
  const json = (...args) => JSON.parse(execFileSync(process.execPath, [cli, "--json", "--canvas", canvasId, ...args], { encoding: "utf8" }));
  const read = json("goodnight", "read");
  if (!read.youLead || !read.conversation) return;
  const listed = json("comment", "ls");
  const main = (Array.isArray(listed) ? listed : listed.threads).find((t) => t.main);
  const at = main.comments.findIndex((c) => c.id === read.conversation.askId);
  const kitSaid = main.comments.slice(at + 1).some((c) => c.author.name === "Kit");
  if (read.conversation.planned) {
    if (main.comments.some((c) => c.goodnight?.step === "brief")) return;
    const note = json("goodnight", "note",
      "--promise", "Basket | a finished take on the empty basket | one take",
      "--promise", "Basket | a sketch of the empty basket | one sketch",
      "--promise", "Order history | group past orders by week | one take",
      "--edit", "Checkout | pickup first | one new version",
      "--ready", new Date().toISOString());
    const page = (title, body) => "<!doctype html><title>" + title + "</title><body style='font:16px system-ui;padding:24px'><h1>" + title + "</h1>" + body + "</body>";
    for (const line of note.lines) {
      const file = path.join(cwd, "take-" + line.n + ".html");
      if (line.edit) {
        writeFileSync(file, page("Checkout", "<p><b>Pickup: Saturday 9:00</b></p><p>Sourdough loaf × 1</p><p>Total $8</p>"));
        run("goodnight", "fill", line.on, file);
      } else if (line.n === 1) {
        writeFileSync(file, page("Your basket is empty", "<p>Today's loaf: sourdough. Order by Friday.</p>"));
        run("goodnight", "fill", line.frame, file, "--why", "Empty states teach: show the first step, not the void.");
      } else if (line.n === 2) {
        writeFileSync(file, page("Nothing here yet", "<p>A loaf, sketched.</p>"));
        run("goodnight", "fill", line.frame, file, "--hunch", "--why", "A sketch first: the warmth of the empty state is the open question.");
      } else {
        writeFileSync(file, page("Order history", "<p>Week of 6 Oct: two loaves</p>"));
        run("goodnight", "fill", line.frame, file, "--failed", "every take broke the list's scan line");
      }
    }
    run("goodnight", "done", "Two takes on the basket: one I'm sure of, one hunch. Checkout reworked, pickup first. The order-history regroup did not work.",
      "--left", "Ravi's note about delivery | a business decision, not a design one");
    return;
  }
  if (!kitSaid) {
    run("comment", "reply", main.id, "**Tonight I could try:** two takes on the empty Basket, one a sketch; a regroup of Order history by week; and Checkout reworked with the pickup time first, if you name it for editing.");
    return;
  }
  run("comment", "reply", main.id, "The plan as it stands: two takes on the Basket, beside it; the Order history regroup; Checkout reworked, pickup first, because you named it. Say that's the plan when it is right.");
}
`);
      const daemon = await startDaemon(home);
      const { origin } = daemon;
      const env = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(origin).port, FAKE_ACP_ACT: act, FAKE_ACP_CLI: cli };
      for (const name of ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_ENTRYPOINT", "ISOCAN_SESSION_ID", "ISOCAN_HARNESS", "CODEX_SANDBOX", "CODEX_THREAD_ID"]) delete env[name];
      const runCli = (...args) => {
        const out = execFileSync(process.execPath, [cli, "--json", ...args], { cwd: home, encoding: "utf8", env });
        return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out;
      };
      const shot = async (name) => {
        const file = path.join(tmpdir(), `isocan-morning-${name}-${Date.now()}.png`);
        writeFileSync(file, Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
        return file;
      };
      const chat = (id) => {
        const listed = runCli("--canvas", id, "comment", "ls");
        return ((Array.isArray(listed) ? listed : listed.threads).find((t) => t.main)?.comments ?? []);
      };
      const waitFor = async (test, what, ms = 45_000) => {
        for (const end = Date.now() + ms; Date.now() < end; await sleep(400)) if (test()) return;
        throw new Error(`timed out waiting for ${what}`);
      };
      let rc = null;
      let rcOut = "";
      try {
        const id = runCli("canvas", "create", "Acme Bakery").canvasId;
        const screens = {};
        for (const [i, title, words] of [[0, "Basket", "Your basket is empty."], [1, "Checkout", "Sourdough loaf × 1 · Total $8 · Pickup: Saturday 9:00"], [2, "Order history", "Last week: two loaves"], [3, "Menu", "Sourdough, rye, focaccia"]]) {
          const file = path.join(home, `screen-${i}.html`);
          writeFileSync(file, `<!doctype html><title>${title}</title><body style='font:16px system-ui;padding:24px'><h1>${title}</h1><p>${words}</p></body>`);
          screens[title] = runCli("--canvas", id, "add", file, "--title", title, "--size", "390x520", "--at", `${i * 470},0`).itemId;
        }
        runCli("--canvas", id, "rc", "add", "Kit", "--dir", kitDir);
        runCli("--canvas", id, "canvas", "edit", "--prop", "proactive=Kit");
        const current = (itemId) => { const s = runCli("--canvas", id, "show", itemId); return { versions: s.versions.length, current: s.currentVersionId, hash: s.versions.find((v) => v.id === s.currentVersionId)?.blobHash ?? null }; };
        const before = Object.fromEntries(Object.entries(screens).map(([t, itemId]) => [t, current(itemId)]));

        rc = spawn(process.execPath, [cli, "--canvas", id, "rc"], { cwd: home, env, stdio: ["ignore", "pipe", "pipe"] });
        rc.stdout.on("data", (c) => (rcOut += c));
        rc.stderr.on("data", (c) => (rcOut += c));

        // The evening visit: Maya's seen mark is written now, before the night.
        const { address } = runCli("--canvas", id, "pass");
        await b.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
        const loaded = b.once("Page.loadEventFired");
        await b.send("Page.navigate", { url: origin });
        await Promise.race([loaded, sleep(15_000)]);
        await b.ev(`(() => { localStorage.clear(); localStorage.setItem("isocan.theme", "light"); return true; })()`);
        await b.send("Page.navigate", { url: address });
        await sleep(2500);
        await until(b, `!!document.querySelector('.item[data-item-id="${screens.Basket}"]')`, "the Basket screen on Maya's canvas", 20_000);
        await until(b, `fetch('/api/projects/${id}/rc', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json()).then(r => r.parked)`, "Maya's rc to park", 20_000);
        if (await b.ev(`!!document.querySelector("[data-away-panel]")`)) throw new Error("a morning review showed before any goodnight");
        await sleep(1500); // the visit's mark lands

        // The goodnight, from her terminal: a talk, Checkout named, that's the plan.
        const asked = runCli("--canvas", id, "goodnight", "start", "the basket bugs me");
        await waitFor(() => chat(id).some((c) => /Tonight I could try/.test(c.body)), "Kit's opener");
        runCli("--canvas", id, "comment", "reply", asked.threadId, "rework the checkout screen too, pickup first");
        await waitFor(() => chat(id).some((c) => /The plan as it stands/.test(c.body)), "Kit restating the plan");
        runCli("--canvas", id, "goodnight", "plan");
        await waitFor(() => chat(id).some((c) => c.goodnight?.step === "brief"), "the night's brief", 90_000);
        const review = runCli("--canvas", id, "goodnight", "review");
        if (!review.due) throw new Error(`the review is not due after the night: ${review.notDue}`);

        // The morning: she comes back. The panel leads with the brief.
        await b.send("Page.reload", {});
        await sleep(2500);
        await until(b, `!!document.querySelector("[data-away-panel] [data-morning]")`, "the morning review in the desktop away panel", 20_000);
        const panel = await b.ev(`(() => {
          const p = document.querySelector("[data-away-panel]");
          const m = p.querySelector("[data-morning]");
          const first = p.querySelector("details > :not(summary)");
          return {
            leads: first === m,
            brief: m.querySelector("[data-morning-brief]")?.textContent ?? "",
            headline: m.querySelector("[data-morning-headline]")?.textContent ?? null,
            proposals: [...m.querySelectorAll("[data-morning-proposal]")].map((li) => [li.dataset.morningProposal, li.textContent]),
            left: m.querySelector("[data-morning-left]")?.textContent ?? "",
            edited: [...m.querySelectorAll("[data-morning-edited]")].map((li) => li.dataset.morningEdited),
            digest: !!p.querySelector("[data-change-seq]"),
          };
        })()`);
        if (!panel.leads) throw new Error("the brief does not lead the away panel");
        if (!/Two takes on the basket/.test(panel.brief)) throw new Error(`the brief is not Kit's: ${panel.brief}`);
        if (panel.headline) throw new Error(`a night that made things carries a failure line: ${panel.headline}`);
        const states = panel.proposals.map(([s]) => s);
        if (JSON.stringify(states) !== JSON.stringify(["sure", "hunch", "failed"])) throw new Error(`the proposals are not highest confidence first: ${JSON.stringify(panel.proposals)}`);
        if (panel.proposals.length > 5) throw new Error("more than five proposals in one morning");
        if (!/every take broke the list's scan line/.test(panel.proposals[2][1])) throw new Error(`the failed promise does not say why: ${panel.proposals[2][1]}`);
        if (!/Ravi's note about delivery — a business decision/.test(panel.left)) throw new Error(`Left alone is missing Kit's reason: ${panel.left}`);
        if (JSON.stringify(panel.edited) !== JSON.stringify([screens.Checkout])) throw new Error(`the edited originals are not just Checkout: ${JSON.stringify(panel.edited)}`);
        if (!panel.digest) throw new Error("the digest of what everyone did does not follow the brief");
        const after = Object.fromEntries(Object.entries(screens).map(([t, itemId]) => [t, current(itemId)]));
        for (const t of ["Basket", "Order history", "Menu"]) {
          if (JSON.stringify(after[t]) !== JSON.stringify(before[t])) throw new Error(`“${t}” changed overnight: ${JSON.stringify({ before: before[t], after: after[t] })}`);
        }
        if (after.Checkout.versions !== before.Checkout.versions + 1 || after.Checkout.hash === before.Checkout.hash) throw new Error(`Checkout, named for editing, is not one new version: ${JSON.stringify(after.Checkout)}`);
        // Closing the note is not her act: the review renders, the note closes,
        // and one ⌘Z on arrival does not reopen it.
        await waitFor(() => runCli("--canvas", id, "goodnight", "review").reviewed, "the note to close once its review was seen", 10_000);
        // Focus the canvas first (an empty spot of it), so the chord reaches the page.
        for (const type of ["mousePressed", "mouseReleased"]) await b.send("Input.dispatchMouseEvent", { type, x: 1200, y: 820, button: "left", clickCount: 1 });
        await rig.press("z", { meta: true });
        await sleep(1500);
        if (!runCli("--canvas", id, "goodnight", "review").reviewed) throw new Error("one ⌘Z on arrival reopened the night's note");
        if (!(await b.ev(`!!document.querySelector("[data-away-panel] [data-morning]")`))) throw new Error("the review went away on ⌘Z");
        const lightShot = await shot("away-light");
        await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
        await b.ev(`(() => { localStorage.setItem("isocan.theme", "dark"); document.documentElement.dataset.theme = "dark"; return true; })()`);
        await sleep(600);
        const darkShot = await shot("away-dark");
        await b.send("Emulation.setEmulatedMedia", { features: [] });
        await b.ev(`(() => { localStorage.setItem("isocan.theme", "light"); document.documentElement.dataset.theme = "light"; return true; })()`);

        // The version before: the existing compare inspector.
        await rig.click(`[data-morning-edited="${screens.Checkout}"] [data-morning-before]`, "See the version before");
        await until(b, `!!document.querySelector("[data-version-compare]")`, "the version compare to open");
        await rig.press("Escape");

        // A visit newer than ready-by: no review.
        runCli("--canvas", id, "seen", "--mark");
        const later = runCli("--canvas", id, "goodnight", "review");
        if (later.due || later.notDue !== "you have been back since its ready-by") throw new Error(`a seen mark newer than ready-by still owes a review: ${JSON.stringify({ due: later.due, notDue: later.notDue })}`);
        await b.send("Page.reload", {});
        await sleep(2500);
        await until(b, `!!document.querySelector('.item[data-item-id="${screens.Basket}"]')`, "the canvas again", 20_000);
        await sleep(1500);
        if (await b.ev(`!!document.querySelector("[data-away-panel]")`)) throw new Error("the review showed again after a visit newer than ready-by");
        const errors = b.takeErrors();
        if (errors.length > 0) throw new Error(`the page threw: ${errors[0]}`);
        return { screenshots: { light: lightShot, dark: darkShot } };
      } catch (err) {
        throw new Error(`${err.message}\n--- rc ---\n${rcOut.slice(-3000)}`);
      } finally {
        if (rc) {
          rc.kill("SIGINT");
          await new Promise((r) => { rc.once("exit", r); setTimeout(r, 3000); });
          if (rc.exitCode === null) rc.kill("SIGKILL");
        }
        await daemon.stop();
        rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    },
  },
  {
    name: "proactive-explain",
    /**
     * **Explain this item** (proactive-agent phase 4, journey scene 4,
     * `docs/projects/proactive-agent/phases.md`).
     *
     * Its own home and daemon with the real `isocan rc` and
     * `packages/cli/test/fake-acp.mjs` as Kit, the canvas's lead — **no model
     * runs**. A synthetic Acme Checkout with a few versions, two variations
     * (each announced in a comment) and a `choose`; a DESIGN.md that moved on
     * afterwards; a comment saying "make it more obvious".
     *
     * Maya opens Explain from the item's menu: a panel beside the live
     * canvas, the canvas and her selection where they were. It names the
     * choice with its comment, the losing variation in the trash, the newer
     * DESIGN.md and the speak-design pair, in all three depths. Escape
     * closes it, and nothing was written. Opened again from ⌘K, **Critique**
     * summons Kit, whose critique arrives in the panel with its proposal
     * citing `explain:` beneath Checkout; **Copy as rationale** puts a note
     * beside it. With Kit dismissed, Critique is off and the panel says why.
     * Screenshots of the panel at each depth, light and dark, for a person.
     */
    what: "Explain opens beside the canvas and Escape closes it; nothing is written until Critique or Copy as rationale is pressed",
    async run(rig) {
      const { b } = rig;
      const home = mkdtempSync(path.join(tmpdir(), "isocan-journey-explain-"));
      const kitDir = path.join(home, "kit");
      const fakeAcp = path.join(repo, "packages/cli/test/fake-acp.mjs");
      const act = path.join(home, "act.mjs");
      execFileSync("mkdir", ["-p", kitDir]);
      writeFileSync(path.join(home, "identity.json"), JSON.stringify({ id: "usr_explain_maya", name: "Maya", createdAt: new Date().toISOString() }));
      writeFileSync(path.join(home, "config.json"), JSON.stringify({ adapterEnv: ["FAKE_ACP_*"], acpAdapters: { "claude-code": [process.execPath, fakeAcp] }, defaultHarness: "claude-code" }));
      // Kit, scripted: asked for a critique, it reads the deep story and answers in one command.
      writeFileSync(act, `
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
export default async function act({ prompt, cli, cwd }) {
  const canvasId = /"canvasId":\\s*"([^"]+)"/.exec(prompt)?.[1];
  const itemId = /Critique, please: “[^”]*” \\((itm_[\\w-]+)\\)/.exec(prompt)?.[1];
  if (!canvasId || !itemId) return;
  const run = (...args) => execFileSync(process.execPath, [cli, "--canvas", canvasId, ...args], { encoding: "utf8" });
  const deep = JSON.parse(execFileSync(process.execPath, [cli, "--json", "--canvas", canvasId, "explain", itemId, "--depth", "deep"], { encoding: "utf8" }));
  if (deep.story.critique) return;
  const file = path.join(cwd, "try.html");
  writeFileSync(file, "<!doctype html><title>Checkout</title><body style='font:16px system-ui;padding:24px'><h1>Checkout</h1><p>Pickup: Saturday 9:00</p><p>Sourdough loaf × 1</p><p><b>Total $8</b> <button>Pay</button></p></body>");
  run("explain", itemId, "--critique",
    "--working", "The pickup slot leads, so the one thing a regular must check comes first.",
    "--risk", "The total sits below the fold on a small phone.",
    "--try", "Proximity: put the total beside the Pay button.",
    "--speak", "make it more obvious => raise the total in the visual hierarchy",
    "--propose", file);
}
`);
      const daemon = await startDaemon(home);
      const { origin } = daemon;
      const env = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(origin).port, FAKE_ACP_ACT: act, FAKE_ACP_CLI: cli };
      for (const name of ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_ENTRYPOINT", "ISOCAN_SESSION_ID", "ISOCAN_HARNESS", "CODEX_SANDBOX", "CODEX_THREAD_ID"]) delete env[name];
      const runCli = (...args) => {
        const out = execFileSync(process.execPath, [cli, "--json", ...args], { cwd: home, encoding: "utf8", env });
        return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out;
      };
      const page = (name, words) => {
        const file = path.join(home, `${name}.html`);
        writeFileSync(file, `<!doctype html><title>${name}</title><body style='font:16px system-ui;padding:24px'><h1>Checkout</h1><p>${words}</p></body>`);
        return file;
      };
      const shot = async (name) => {
        const file = path.join(tmpdir(), `isocan-explain-${name}-${Date.now()}.png`);
        writeFileSync(file, Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
        return file;
      };
      const panel = `document.querySelector("[data-explain-panel]")`;
      const panelText = () => b.ev(`${panel}?.textContent ?? ""`);
      const served = async (id) => b.ev(`fetch('/api/projects/${id}/canvas', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json()).then(r => JSON.stringify([r.canvas.items, r.canvas.threads, r.canvas.trash]))`);
      let rc = null;
      let rcOut = "";
      try {
        const id = runCli("canvas", "create", "Acme Bakery").canvasId;
        const ds = path.join(home, "DESIGN.md");
        writeFileSync(ds, "# Acme Bakery\n\nPrimary: #b5523b\n");
        const system = runCli("--canvas", id, "add", ds, "--title", "DESIGN.md", "--at", "1000,0", "--prop", "role=design-system").itemId;
        const checkout = runCli("--canvas", id, "add", page("checkout", "Sourdough loaf × 1 · Total $8 · Pickup: Saturday 9:00"), "--title", "Checkout", "--size", "390x520", "--at", "0,0").itemId;
        runCli("--canvas", id, "edit", checkout, page("checkout-2", "Sourdough loaf × 1 · Pickup: Saturday 9:00 · Total $8"));
        const takes = {};
        for (const [i, title, words] of [[0, "Checkout A", "A: one long page"], [1, "Checkout B", "B: shorter form, pickup slot first"]]) {
          takes[title] = runCli("--canvas", id, "add", page(`take-${i}`, title), "--title", title, "--size", "390x520", "--at", `${i * 470},700`, "--prop", `parent=${checkout}`).itemId;
          runCli("--canvas", id, "comment", "add", `${words} #${takes[title]}`, "--item", takes[title]);
        }
        runCli("--canvas", id, "choose", takes["Checkout B"]);
        writeFileSync(ds, "# Acme Bakery\n\nPrimary: #a3412c\n");
        runCli("--canvas", id, "edit", system, ds);
        runCli("--canvas", id, "comment", "add", "make it more obvious where the total is", "--item", checkout);
        const basket = runCli("--canvas", id, "add", page("basket", "Your basket is empty."), "--title", "Basket", "--size", "390x520", "--at", "500,0").itemId;
        runCli("--canvas", id, "rc", "add", "Kit", "--dir", kitDir);
        runCli("--canvas", id, "canvas", "edit", "--prop", "proactive=Kit");
        rc = spawn(process.execPath, [cli, "--canvas", id, "rc"], { cwd: home, env, stdio: ["ignore", "pipe", "pipe"] });
        rc.stdout.on("data", (c) => (rcOut += c));
        rc.stderr.on("data", (c) => (rcOut += c));

        const { address } = runCli("--canvas", id, "pass");
        await b.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
        const loaded = b.once("Page.loadEventFired");
        await b.send("Page.navigate", { url: origin });
        await Promise.race([loaded, sleep(15_000)]);
        await b.ev(`(() => { localStorage.clear(); return true; })()`);
        await b.send("Page.navigate", { url: address });
        await sleep(2500);
        const sel = (itemId) => `'.item[data-item-id="${itemId}"]'`;
        await until(b, `!!document.querySelector(${sel(checkout)})`, "Checkout on Maya's canvas", 20_000);
        await until(b, `fetch('/api/projects/${id}/rc', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json()).then(r => r.parked)`, "Kit's rc to park", 20_000);
        await sleep(1500);

        // 1. Explain, from the item's menu: a real right-click on Checkout, a real press.
        await rig.click(`[data-item-id="${checkout}"] .item-titlebar .chrome-left`, "Checkout's title");
        await until(b, `!!document.querySelector('[data-item-id="${checkout}"].selected')`, "Checkout selected");
        const before = await served(id);
        const world = await b.ev(`document.querySelector(".world")?.getAttribute("style") ?? ""`);
        const mouse = (type, x, y, button = "left") => b.send("Input.dispatchMouseEvent", { type, x, y, button, buttons: type === "mousePressed" ? (button === "right" ? 2 : 1) : 0, clickCount: 1 });
        const at = await b.ev(`(() => { const r = document.querySelector(${sel(checkout)}).getBoundingClientRect(); return { x: Math.round(r.left + 20), y: Math.round(r.bottom - 20) }; })()`);
        await mouse("mouseMoved", at.x, at.y, "none");
        await mouse("mousePressed", at.x, at.y, "right");
        await mouse("mouseReleased", at.x, at.y, "right");
        const row = `[...document.querySelectorAll(".context-menu button")].find((el) => el.textContent.trim() === "Explain")`;
        await until(b, `!!${row}`, `the item menu, offering "Explain"`, 4000);
        const r = await b.ev(`(() => { const r = ${row}.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
        await mouse("mousePressed", r.x, r.y);
        await mouse("mouseReleased", r.x, r.y);
        await until(b, `!!${panel}?.querySelector('[data-explain-section="how"] li')`, "the Explain panel, with how it got here", 10_000);

        // Beside the canvas, not over it: the canvas still drawn, the panel on the right.
        const beside = await b.ev(`(() => { const p = ${panel}.getBoundingClientRect(); return { left: p.left, right: p.right, w: innerWidth, world: !!document.querySelector(".world"), modal: !!document.querySelector("[aria-modal=true]") }; })()`);
        if (!beside.world || beside.modal || beside.left < beside.w / 2 || beside.right > beside.w) throw new Error(`the panel is not beside the canvas: ${JSON.stringify(beside)}`);
        const plain = await panelText();
        for (const want of ["Maya chose “Checkout B” over 1 other take — “B: shorter form, pickup slot first", "“Checkout A”, a variation by Maya, in the trash", "the design system “DESIGN.md” changed since", "“make it more obvious” — a designer would say “visual hierarchy”"]) {
          if (!plain.includes(want)) throw new Error(`the panel does not say ${JSON.stringify(want)}: ${plain.slice(0, 900)}`);
        }
        if (!(await b.ev(`!!${panel}.querySelector('[data-explain-trash]')`))) throw new Error("the road not taken has no way to be seen again");

        // 2. Each depth, light and dark.
        const shots = {};
        for (const depth of ["plain", "designer", "deep"]) {
          await rig.click(`[data-explain-depth="${depth}"]`, `the ${depth} depth`);
          await until(b, `${panel}.querySelector('[data-explain-depth="${depth}"]').getAttribute("aria-pressed") === "true"`, `${depth} pressed`);
          const text = await panelText();
          if (depth === "designer" && !/v3 · Maya converged on the variation “Checkout B”/.test(text)) throw new Error(`Designer does not name the move: ${text.slice(0, 600)}`);
          if (depth === "deep" && !/comment cmt_/.test(text)) throw new Error(`Deep dive does not cite its comments: ${text.slice(0, 600)}`);
          for (const theme of ["light", "dark"]) {
            await b.ev(`(() => { document.documentElement.dataset.theme = ${JSON.stringify(theme)}; return true; })()`);
            await sleep(250);
            shots[`${depth}-${theme}`] = await shot(`${depth}-${theme}`);
          }
          await b.ev(`(() => { document.documentElement.dataset.theme = "light"; return true; })()`);
        }
        await rig.click(`[data-explain-depth="plain"]`, "back to Plain");

        // 3. Escape closes it; her place and her selection are where they were, and nothing was written.
        await rig.press("Escape");
        await until(b, `!${panel}`, "Escape to close the panel", 3000);
        if (!(await b.ev(`!!document.querySelector('[data-item-id="${checkout}"].selected')`))) throw new Error("closing Explain lost the selection");
        const worldAfter = await b.ev(`document.querySelector(".world")?.getAttribute("style") ?? ""`);
        if (worldAfter !== world) throw new Error(`Explain moved the canvas: ${world} → ${worldAfter}`);
        if ((await served(id)) !== before) throw new Error("opening Explain, switching depths and closing it wrote to the canvas");

        // 4. ⌘K → Explain this item; Critique summons Kit, whose critique and proposal arrive in the panel.
        await rig.press("k", { meta: true });
        await until(b, `!!document.querySelector(".command-palette input, [data-palette] input, .palette input")`, "the launcher", 3000);
        await rig.type("Explain this item");
        await sleep(200);
        await rig.press("Enter");
        await until(b, `!!${panel}?.querySelector("[data-explain-critique]") && !${panel}.querySelector("[data-explain-critique]").disabled`, "Critique, offered with Kit to answer", 10_000);
        if ((await served(id)) !== before) throw new Error("opening Explain from ⌘K wrote to the canvas");
        await rig.click("[data-explain-critique]", "Critique");
        await until(b, `(${panel}?.textContent ?? "").includes("Kit's critique") && (${panel}.textContent).includes("a proposal beneath it")`, "Kit's critique and its proposal in the panel", 60_000);
        const critique = await panelText();
        if (!/Working: The pickup slot leads/.test(critique) || !/A risk: The total sits below the fold/.test(critique)) throw new Error(`the critique is not in the panel: ${critique.slice(-800)}`);
        if (!critique.includes("“make it more obvious” — a designer would say “raise the total in the visual hierarchy”")) throw new Error(`Kit's speak-design pair is not in the panel: ${critique.slice(0, 900)}`);
        const story = runCli("--canvas", id, "explain", checkout).story;
        const proposal = runCli("--canvas", id, "show", story.critique.proposal.itemId);
        const cites = JSON.parse(proposal.properties.proposalCites);
        if (cites[0]?.kind !== "explain" || cites[0]?.ref !== story.critique.commentId) throw new Error(`the proposal does not cite the critique: ${JSON.stringify(cites)}`);
        await until(b, `!!document.querySelector('[data-proposal="${proposal.id ?? story.critique.proposal.itemId}"] .proposal-chip')`, "the proposal's mark beneath Checkout", 10_000);
        const critiqued = await shot("critique");

        // 5. Copy as rationale: one note beside Checkout.
        const items = Object.keys(JSON.parse(await served(id))[0]).length;
        await rig.click("[data-explain-rationale]", "Copy as rationale");
        await until(b, `fetch('/api/projects/${id}/canvas', {headers:{'x-isocan-features':'canvas-groups-v4'}}).then(r => r.json()).then(r => Object.values(r.canvas.items).some(i => i.title === "Why “Checkout” looks like this"))`, "the rationale note on the canvas", 10_000);
        if (Object.keys(JSON.parse(await served(id))[0]).length !== items + 1) throw new Error("Copy as rationale wrote more than one item");
        await rig.click(".explain-close", "the panel's close");

        // 6. Kit dismissed: Critique is off, and the panel says why; the history stands.
        runCli("--canvas", id, "rc", "remove", "Kit");
        await rig.click(`[data-item-id="${basket}"] .item-titlebar .chrome-left`, "Basket's title");
        await rig.press("k", { meta: true });
        await until(b, `!!document.querySelector(".command-palette input, [data-palette] input, .palette input")`, "the launcher", 3000);
        await rig.type("Explain this item");
        await sleep(200);
        await rig.press("Enter");
        await until(b, `!!${panel}?.querySelector("[data-explain-cannot]")`, "the panel to say why nothing can critique", 10_000);
        const cannot = await b.ev(`${panel}.querySelector("[data-explain-cannot]").textContent`);
        if (!/No critique: .*Kit/.test(cannot)) throw new Error(`the panel does not say why: ${cannot}`);
        if (!(await b.ev(`${panel}.querySelector("[data-explain-critique]").disabled`))) throw new Error("Critique is offered with nobody to answer");
        if (!(await panelText()).includes("Maya made it")) throw new Error("the history does not stand without a critique");
        await rig.press("Escape");
        const errors = b.takeErrors();
        if (errors.length > 0) throw new Error(`the page threw: ${errors[0]}`);
        return { screenshots: { ...shots, critique: critiqued } };
      } catch (err) {
        throw new Error(`${err.message}\n--- rc ---\n${rcOut.slice(-3000)}`);
      } finally {
        if (rc) {
          rc.kill("SIGINT");
          await new Promise((r) => { rc.once("exit", r); setTimeout(r, 3000); });
          if (rc.exitCode === null) rc.kill("SIGKILL");
        }
        await daemon.stop();
        rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    },
  },
  {
    name: "proactive-brief-card",
    /**
     * **The brief, as a card** (proactive-agent phase 5, journey scene 5,
     * `docs/projects/proactive-agent/phases.md`).
     *
     * Its own home and daemon with the real `isocan rc` and
     * `packages/cli/test/fake-acp.mjs` as Kit, the canvas's lead — **no model
     * runs**. A synthetic Acme pre-order app: Menu, Checkout and Basket, and
     * a design request whose brief says some lines (For, Should feel) and
     * assumes one (Never). Asked, Kit leaves a proposal beneath Checkout that
     * cites the For line, and its chip says so.
     *
     * The brief's item wears the card: said lines solid, inferred ones pencil
     * with Right / Wrong. Maya presses **Right** on Never: it turns solid, and
     * the brief's history names her as its source. She changes **For**:
     * nothing on the canvas changes (every screen byte for byte), Checkout is
     * sorted under *assumed the old line* (its proposal cites For), Kit's
     * re-read puts Menu under *matters more now* and asks ONE question. With
     * Kit dismissed, an edit still lands and the card says the re-read waits.
     * Screenshots of the card, light and dark, before and after the edit.
     */
    what: "the brief card: Right turns a pencil line solid with Maya as its source; an edit changes no screen, sorts them, and Kit asks one question",
    async run(rig) {
      const { b } = rig;
      const home = mkdtempSync(path.join(tmpdir(), "isocan-journey-brief-"));
      const kitDir = path.join(home, "kit");
      const fakeAcp = path.join(repo, "packages/cli/test/fake-acp.mjs");
      const act = path.join(home, "act.mjs");
      execFileSync("mkdir", ["-p", kitDir]);
      writeFileSync(path.join(home, "identity.json"), JSON.stringify({ id: "usr_brief_maya", name: "Maya", createdAt: new Date().toISOString() }));
      writeFileSync(path.join(home, "config.json"), JSON.stringify({ adapterEnv: ["FAKE_ACP_*"], acpAdapters: { "claude-code": [process.execPath, fakeAcp] }, defaultHarness: "claude-code" }));
      // Kit, scripted: asked about Checkout, it proposes against the For line;
      // asked for a re-read, it reads the card and answers in one command.
      writeFileSync(act, `
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
export default async function act({ prompt, cli, cwd }) {
  const canvasId = /"canvasId":\\s*"([^"]+)"/.exec(prompt)?.[1];
  if (!canvasId) return;
  const run = (...args) => execFileSync(process.execPath, [cli, "--canvas", canvasId, ...args], { encoding: "utf8" });
  const json = (...args) => JSON.parse(execFileSync(process.execPath, [cli, "--json", "--canvas", canvasId, ...args], { encoding: "utf8" }));
  const byTitle = (title) => json("ls").find((i) => i.title === title);
  if (prompt.includes("what would you change on Checkout")) {
    const file = path.join(cwd, "pickup-first.html");
    writeFileSync(file, "<!doctype html><title>Checkout</title><body style='font:16px system-ui;padding:24px'><h1>Checkout</h1><p><b>Pickup: Saturday 9:00</b></p><p>Sourdough loaf × 1</p><p>Total $8</p></body>");
    run("propose", byTitle("Checkout").id, file, "--cites", "brief:for", "--why", "Summary before detail: a regular checks the pickup slot first.");
    return;
  }
  if (prompt.includes("Brief re-read, please (")) {
    const card = json("design", "card");
    if (!card.reread || card.reread.answer) return;
    run("design", "card", "--reread", "--matters", byTitle("Menu").id, "--question", "As well as regulars, or instead?");
  }
}
`);
      const daemon = await startDaemon(home);
      const { origin } = daemon;
      const env = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(origin).port, FAKE_ACP_ACT: act, FAKE_ACP_CLI: cli };
      for (const name of ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_ENTRYPOINT", "ISOCAN_SESSION_ID", "ISOCAN_HARNESS", "CODEX_SANDBOX", "CODEX_THREAD_ID"]) delete env[name];
      const runCli = (...args) => {
        const out = execFileSync(process.execPath, [cli, "--json", ...args], { cwd: home, encoding: "utf8", env });
        return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out;
      };
      const page = (name, words) => {
        const file = path.join(home, `${name}.html`);
        writeFileSync(file, `<!doctype html><meta charset="utf-8"><title>${name}</title><body style='font:16px system-ui;padding:24px'><h1>${name}</h1><p>${words}</p></body>`);
        return file;
      };
      // The card itself, magnified: at the canvas's fitted zoom it is too small to read in a picture.
      const shot = async (name) => {
        const file = path.join(tmpdir(), `isocan-brief-card-${name}-${Date.now()}.png`);
        const r = await b.ev(`(() => { const r = document.querySelector('[data-item-id="itm_acme_brief"]').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()`);
        const clip = { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 30), width: r.width + 16, height: Math.min(r.height + 38, 900 - Math.max(0, r.y - 30)), scale: 2.5 };
        writeFileSync(file, Buffer.from((await b.send("Page.captureScreenshot", { format: "png", clip })).data, "base64"));
        return file;
      };
      const card = `document.querySelector("[data-brief-card]")`;
      const line = (cite) => `${card}?.querySelector('[data-brief-line="${cite}"]')`;
      // A canvas holding a design request is served only to a reader that says it can decode one.
      const features = "canvas-groups-v4,questionnaires-v1,design-requests-v1,design-requests-v2,design-decisions-v1,design-repairs-v1";
      const served = async (id) => b.ev(`fetch('/api/projects/${id}/canvas', {headers:{'x-isocan-features':'${features}'}}).then(r => r.json()).then(r => JSON.stringify(r.canvas?.items ?? r))`);
      let rc = null;
      let rcOut = "";
      try {
        const id = runCli("canvas", "create", "Acme Bakery").canvasId;
        const screens = {};
        for (const [i, title, words] of [[0, "Menu", "Sourdough · Rye · Croissant"], [1, "Checkout", "Sourdough loaf × 1 · Total $8 · Pickup: Saturday 9:00"], [2, "Basket", "Your basket is empty."]]) {
          screens[title] = runCli("--canvas", id, "add", page(title, words), "--title", title, "--size", "390x520", "--at", `${560 + i * 470},0`).itemId;
        }
        const start = path.join(home, "start.json");
        writeFileSync(start, JSON.stringify({
          requestId: "req_acme_brief", itemId: "itm_acme_brief", versionId: "ver_acme_brief_1", title: "The brief", width: 480, height: 820, placement: { x: 0, y: 0 },
          source: { entrance: "external-agent", externalRequestId: "acme-brief" },
          fields: {
            intent: "refine", fidelity: "designed", delivery: "html-node", targetItemId: null, groupId: null,
            audience: "regulars who order weekly", primaryTask: "a pre-order app", constraints: ["pickup only"],
            facts: [
              { id: "feel", name: "Should feel", value: "warm, quick", origin: "supplied", sources: [] },
              { id: "never", name: "Never", value: "pushy", origin: "assumed", sources: [] },
            ],
            references: [], outstandingDecisionIds: [], outputIds: [],
          },
        }));
        if (runCli("--canvas", id, "design", "start", start).status !== "accepted") throw new Error("the design request was not admitted");
        runCli("--canvas", id, "rc", "add", "Kit", "--dir", kitDir);
        runCli("--canvas", id, "canvas", "edit", "--prop", "proactive=Kit");
        rc = spawn(process.execPath, [cli, "--canvas", id, "rc"], { cwd: home, env, stdio: ["ignore", "pipe", "pipe"] });
        rc.stdout.on("data", (c) => (rcOut += c));
        rc.stderr.on("data", (c) => (rcOut += c));

        const { address } = runCli("--canvas", id, "pass");
        await b.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
        const loaded = b.once("Page.loadEventFired");
        await b.send("Page.navigate", { url: origin });
        await Promise.race([loaded, sleep(15_000)]);
        await b.ev(`(() => { localStorage.clear(); return true; })()`);
        await b.send("Page.navigate", { url: address });
        await sleep(2500);
        await until(b, `fetch('/api/projects/${id}/rc', {headers:{'x-isocan-features':'${features}'}}).then(r => r.json()).then(r => r.parked)`, "Kit's rc to park", 20_000);
        await sleep(1500);

        // 0. Kit, asked, proposes beneath Checkout against the For line; the chip says which line.
        runCli("--canvas", id, "comment", "add", "@Kit what would you change on Checkout for our regulars?", "--item", screens.Checkout);
        await until(b, `!!document.querySelector('[data-proposal] .proposal-chip')`, "Kit's proposal beneath Checkout, with its chip", 60_000);
        const chip = await b.ev(`document.querySelector('[data-proposal] .proposal-chip').textContent`);
        if (!/cites · For/.test(chip)) throw new Error(`the chip does not name the brief's line: ${chip}`);

        // 1. The card: said lines solid, inferred ones pencil — and, once Maya
        // steps inside it (a real double-click, the canvas's way into any
        // item's content), Right / Wrong beside the pencil ones.
        await until(b, `!!${card}?.querySelector("[data-brief-enter]")`, "the brief card, saying how to answer its pencil lines", 20_000);
        const enterAt = await b.ev(`(() => { const r = ${card}.querySelector("header").getBoundingClientRect(); const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2); const top = document.elementFromPoint(x, y); return { x, y, hit: !!top && !!top.closest('[data-item-id="itm_acme_brief"]'), over: top ? (top.className?.toString?.() || top.tagName) : "nothing" }; })()`);
        if (!enterAt.hit) throw new Error(`the brief card is covered by ${enterAt.over} where a person would double-click it`);
        for (const clickCount of [1, 2]) {
          await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: enterAt.x, y: enterAt.y, button: "left", buttons: 1, clickCount });
          await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: enterAt.x, y: enterAt.y, button: "left", buttons: 0, clickCount });
          await sleep(150);
        }
        await until(b, `!!${line("never")}?.querySelector("[data-brief-right]")`, "Right and Wrong beside Never once inside the card", 20_000);
        const ruled = await b.ev(`(() => { const rule = (c) => { const el = ${card}.querySelector('[data-brief-line="' + c + '"]'); const s = getComputedStyle(el); return [el.hasAttribute("data-said") ? "said" : el.hasAttribute("data-inferred") ? "inferred" : "empty", s.borderBottomStyle]; }; return { for: rule("for"), feel: rule("feel"), never: rule("never"), now: rule("now") }; })()`);
        if (ruled.for.join() !== "said,solid" || ruled.feel.join() !== "said,solid" || ruled.never.join() !== "inferred,dashed" || ruled.now.join() !== "inferred,dashed") throw new Error(`the rules do not say who said what: ${JSON.stringify(ruled)}`);
        if (await b.ev(`!!${line("for")}.querySelector("[data-brief-right]")`)) throw new Error("a said line offers Right");
        await b.ev(`(() => { ${card}.scrollIntoView({ block: "start" }); return true; })()`);
        const shots = {};
        for (const theme of ["light", "dark"]) {
          await b.ev(`(() => { document.documentElement.dataset.theme = ${JSON.stringify(theme)}; return true; })()`);
          await sleep(250);
          shots[`card-${theme}`] = await shot(`card-${theme}`);
        }
        await b.ev(`(() => { document.documentElement.dataset.theme = "light"; return true; })()`);

        // 2. Right: the pencil line turns solid, and the brief's history names Maya.
        await rig.click(`[data-brief-line="never"] [data-brief-right]`, "Right on Never");
        await until(b, `${line("never")}?.hasAttribute("data-said")`, "Never to turn solid", 10_000);
        const read = runCli("--canvas", id, "design", "brief", "req_acme_brief").requests[0];
        const never = read.brief.facts.find((f) => f.id === "never");
        if (never?.origin !== "supplied") throw new Error(`Right did not make Never supplied: ${JSON.stringify(never)}`);
        if (!read.brief.continuation.factProvenance.some((p) => p.field === "facts.never" && p.actorId === "usr_brief_maya" && p.kind === "direct")) throw new Error(`the brief's history does not name Maya: ${JSON.stringify(read.brief.continuation.factProvenance)}`);
        const versions = runCli("--canvas", id, "show", "itm_acme_brief").versions;
        if (versions.at(-1).createdBy.name !== "Maya") throw new Error(`the brief's new version is not Maya's: ${JSON.stringify(versions.at(-1).createdBy)}`);

        // 3. Maya changes For: nothing on the canvas changes; the screens are sorted; Kit asks one question.
        const screensOf = (items) => JSON.stringify(Object.values(JSON.parse(items)).filter((i) => i.id !== "itm_acme_brief").map((i) => [i.id, i.currentVersionId, i.versions.length, i.x, i.y, i.properties]));
        const before = screensOf(await served(id));
        await rig.click(`[data-brief-line="for"] [data-brief-edit]`, "Edit on For");
        await until(b, `!!${line("for")}?.querySelector("input")`, "For's editor");
        await rig.selectAll();
        await rig.type("regulars, and weekend first-timers");
        await rig.click(`[data-brief-line="for"] [data-brief-save]`, "Save For");
        await until(b, `(${line("for")}?.textContent ?? "").includes("weekend first-timers")`, "For's new words on the card", 10_000);
        await until(b, `!!${card}.querySelector('[data-reread="old"] [data-reread-item="${screens.Checkout}"]')`, "Checkout under assumed the old line", 15_000);
        await until(b, `!!${card}.querySelector("[data-reread-question]")`, "Kit's one question on the card", 60_000);
        const reread = await b.ev(`${card}.querySelector("[data-brief-reread]").textContent`);
        for (const want of ["Assumed the old line", "its proposal “Checkout — proposal” cites For", "Matters more now", "Menu", "Still holds", "Basket", "Kit asks: As well as regulars, or instead?"]) {
          if (!reread.includes(want)) throw new Error(`the re-read does not say ${JSON.stringify(want)}: ${reread}`);
        }
        if (!(await b.ev(`!!${card}.querySelector('[data-reread="more"] [data-reread-item="${screens.Menu}"]')`))) throw new Error("Menu is not under matters more now");
        if (screensOf(await served(id)) !== before) throw new Error("editing the brief changed something on the canvas besides the brief");
        await b.ev(`(() => { ${card}.querySelector("[data-brief-reread]").scrollIntoView({ block: "end" }); return true; })()`);
        for (const theme of ["light", "dark"]) {
          await b.ev(`(() => { document.documentElement.dataset.theme = ${JSON.stringify(theme)}; return true; })()`);
          await sleep(250);
          shots[`reread-${theme}`] = await shot(`reread-${theme}`);
        }
        await b.ev(`(() => { document.documentElement.dataset.theme = "light"; return true; })()`);
        const printed = runCli("--canvas", id, "design", "card");
        if (printed.reread?.answer?.question !== "As well as regulars, or instead?") throw new Error(`the terminal does not read the same re-read: ${JSON.stringify(printed.reread)}`);

        // 4. Kit dismissed: an edit still lands, writes no screen, and the card says the re-read waits.
        runCli("--canvas", id, "rc", "remove", "Kit");
        await sleep(1000);
        await rig.click(`[data-brief-line="constraints"] [data-brief-edit]`, "Edit on Constraints");
        await until(b, `!!${line("constraints")}?.querySelector("input")`, "Constraints' editor");
        await rig.selectAll();
        await rig.type("pickup only · no accounts");
        await rig.click(`[data-brief-line="constraints"] [data-brief-save]`, "Save Constraints");
        await until(b, `!!${card}.querySelector("[data-reread-waits]")`, "the card to say the re-read waits", 15_000);
        const waits = await b.ev(`${card}.querySelector("[data-reread-waits]").textContent`);
        if (!/^The re-read waits: /.test(waits)) throw new Error(`the card does not say the re-read waits: ${waits}`);
        if (screensOf(await served(id)) !== before) throw new Error("an edit with nobody to answer changed the canvas");
        const errors = b.takeErrors();
        if (errors.length > 0) throw new Error(`the page threw: ${errors[0]}`);
        return { screenshots: shots };
      } catch (err) {
        // What the brief's item was showing, so a failure names the face rather than a timeout.
        const face = await b.ev(`(document.querySelector("[data-design-record]")?.textContent ?? "no design record face on screen").slice(0, 1200)`).catch(() => "");
        throw new Error(`${err.message}\n--- the brief's face ---\n${face}\n--- rc ---\n${rcOut.slice(-3000)}`);
      } finally {
        if (rc) {
          rc.kill("SIGINT");
          await new Promise((r) => { rc.once("exit", r); setTimeout(r, 3000); });
          if (rc.exitCode === null) rc.kill("SIGKILL");
        }
        await daemon.stop();
        rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
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
  {
    name: "semantic-zoom-text",
    /**
     * **Semantic Zoom, phase 1: a long note far away shows a summary**
     * (`docs/projects/semantic-zoom/phases.md`, phase 1's proof). Its own
     * daemon, because the shared one has no text model: this one's model is a
     * stub on loopback (`ISOCAN_TEXT_ENDPOINT`) that records what it was asked
     * and answers a fixed summary — never a real model — and its quiet period
     * is 2.5 s rather than 30 so the walk does not wait half a minute.
     *
     * Flag off, zoomed out: no request to the summaries route, no chunk of the
     * experiment's, nothing asked of the stub, and the node shows its opening
     * words. Flag on: the summary shows, marked ≈ and named "Summary of …".
     * An edit: the old summary stays with its updating mark, then the new one
     * replaces it, and at no sampled frame in between is the mark missing.
     */
    what: "flag off asks nothing; flag on, a far-away long note shows its ≈ summary; an edit keeps the old one, marked updating, until the new one lands",
    async run(rig) {
      const { b } = rig;
      const asked = [];
      const stub = createServer((req, res) => {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          const sent = JSON.parse(body || "{}");
          asked.push(sent);
          const prompt = JSON.stringify(sent.messages ?? []);
          const summary = /Ravi adds a revision/.test(prompt) ? `Acme summary ${asked.length}: revised plan, Ravi adds a revision.` : `Acme summary ${asked.length}: launch slips two weeks; Ravi owns pricing.`;
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ id: "msg_stub", type: "message", role: "assistant", model: sent.model, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ summary }) }] }));
        });
      });
      await new Promise((r) => stub.listen(0, "127.0.0.1", r));
      const home = mkdtempSync(path.join(tmpdir(), "isocan-journey-sz-"));
      const daemon = await startDaemon(home, {
        ISOCAN_TEXT_API_KEY: "sk-ant-journey-stub-not-a-key",
        ISOCAN_TEXT_PROVIDER: "anthropic",
        ISOCAN_TEXT_ENDPOINT: `http://127.0.0.1:${stub.address().port}/v1/messages`,
        ISOCAN_SUMMARY_QUIET_MS: "2500",
        ISOCAN_SUMMARY_MODEL: "",
        ISOCAN_TEXT_MODEL: "",
      });
      const { origin } = daemon;
      try {
        const env = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(origin).port, ISOCAN_SESSION_ID: "acme-semantic-zoom-journey", ISOCAN_HARNESS: "test" };
        const runCli = (...args) => {
          const out = execFileSync(process.execPath, [cli, "--json", ...args], { cwd: home, encoding: "utf8", env });
          return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out;
        };
        runCli("identity", "--session", "--name", "Acme Notes CLI");
        const id = runCli("canvas", "create", "Acme semantic zoom").canvasId;
        const words = (extra = "") => `# Notes\n\n${"The Acme launch slips two weeks while Ravi rewrites the pricing page and the team settles the open question on data residency. ".repeat(3)}${extra}`;
        const file = path.join(home, "notes.md");
        writeFileSync(file, words());
        const note = runCli("--canvas", id, "text", "-f", file, "--at", "0,0").itemId;
        const sel = JSON.stringify(`.item[data-item-id="${note}"]`);

        await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
        const loaded = b.once("Page.loadEventFired");
        await b.send("Page.navigate", { url: origin });
        await Promise.race([loaded, sleep(15_000)]);
        await throughTheDoor(b, origin, "Journey", "journeys-semantic-zoom");
        const open = async () => {
          await b.send("Page.navigate", { url: `${origin}/p/${id}` });
          await until(b, `!!document.querySelector(${sel})`, "the note on the canvas", 15_000);
        };
        const scale = () => b.ev(`parseFloat(getComputedStyle(document.querySelector(".world")).getPropertyValue("--scale")) || 1`);
        const zoomOut = async () => {
          for (let n = 0; (await scale()) > 0.15 && n < 80; n++) {
            const at = await b.ev(`(() => { const r = document.querySelector(${sel}).getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
            await b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: Math.min(Math.max(at.x, 200), 1080), y: Math.min(Math.max(at.y, 200), 700), deltaX: 0, deltaY: 120, modifiers: 2 });
            await sleep(40);
          }
          await until(b, `!!document.querySelector(${sel} + " .text-mark")`, "the note too small to read, drawn as its mark", 4000);
        };
        const summaryRequests = () => b.ev(`performance.getEntriesByType("resource").filter((e) => e.name.includes("/summaries")).length`);
        const chunk = () => b.ev(`performance.getEntriesByType("resource").some((e) => /SemanticZoom-/.test(e.name)) || [...document.querySelectorAll("script[src],link[href]")].some((e) => /SemanticZoom-/.test(e.src || e.href))`);

        // 1. Flag off: nothing asked, nothing loaded, the opening words.
        await b.ev(`(() => { localStorage.removeItem("isocan.experiments"); return true; })()`);
        await open();
        await zoomOut();
        await sleep(3000);
        if (await summaryRequests()) throw new Error("with the flag off the page still asked the summaries route");
        if (await chunk()) throw new Error("with the flag off the Semantic Zoom chunk loaded anyway");
        if (asked.length) throw new Error(`with the flag off the model was asked ${asked.length} time(s)`);
        if (await b.ev(`!!document.querySelector(".sz-gist")`)) throw new Error("with the flag off a summary is drawn");
        const opening = await b.ev(`document.querySelector(${sel} + " .text-mark").textContent.trim()`);
        if (opening !== "Notes") throw new Error(`with the flag off the far-away note says "${opening}", not its opening words`);

        // 2. Flag on: the summary, marked as one.
        await b.ev(`(() => { localStorage.setItem("isocan.experiments", JSON.stringify(["semantic.zoom"])); return true; })()`);
        await open();
        await zoomOut();
        const gist = sel + ' + " .sz-gist"';
        await until(b, `/Acme summary \\d+: launch slips/.test(document.querySelector(${gist})?.textContent ?? "") && !document.querySelector(${gist}).hasAttribute("data-stale")`, "the note's summary, current", 20_000);
        const first = await b.ev(`(() => { const g = document.querySelector(${gist}); return { text: g.textContent.trim(), name: g.getAttribute("aria-label"), role: g.getAttribute("role") }; })()`);
        if (!first.text.startsWith("≈")) throw new Error(`the summary is not marked ≈: "${first.text}"`);
        if (first.name !== "Summary of Notes") throw new Error(`the summary's accessible name is "${first.name}", not "Summary of Notes"`);
        if (asked.length !== 1) throw new Error(`one note, ${asked.length} model calls`);
        if (asked[0].model !== "claude-haiku-5-5") throw new Error(`the summary asked ${asked[0].model}, not the cheap tier`);
        if (!/too far away to read/.test(String(asked[0].system))) throw new Error("the summary was asked under the copywriter's system line");

        // 3. An edit: the old summary stays, marked updating, until the new one replaces it — never an empty frame.
        await b.ev(`(() => {
          window.__szGaps = 0; window.__szWatch = true;
          const look = () => { if (!document.querySelector(${gist})) window.__szGaps++; };
          new MutationObserver(look).observe(document.querySelector(".world"), { subtree: true, childList: true, characterData: true, attributes: true });
          const frame = () => { if (!window.__szWatch) return; look(); requestAnimationFrame(frame); };
          requestAnimationFrame(frame);
          return true;
        })()`);
        writeFileSync(file, words("\n\nRavi adds a revision to the plan."));
        runCli("--canvas", id, "edit", note, file);
        await until(b, `document.querySelector(${gist})?.hasAttribute("data-stale") && /launch slips/.test(document.querySelector(${gist}).textContent) && !!document.querySelector(${gist} + " .sz-updating")`, "the old summary kept, marked as being updated", 10_000);
        await until(b, `/revised plan/.test(document.querySelector(${gist})?.textContent ?? "") && !document.querySelector(${gist}).hasAttribute("data-stale")`, "the new summary in the old one's place", 20_000);
        const gaps = await b.ev(`(() => { window.__szWatch = false; return window.__szGaps; })()`);
        if (gaps !== 0) throw new Error(`the summary mark was missing on ${gaps} sampled frame(s) between the old summary and the new`);
        if (asked.length !== 2) throw new Error(`one edit, ${asked.length - 1} more model calls`);
        return { note, calls: asked.length, first: first.text, then: await b.ev(`document.querySelector(${gist}).textContent.trim()`) };
      } finally {
        await daemon.stop();
        stub.close();
        rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        await b.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
      }
    },
  },
  {
    name: "semantic-zoom-board",
    /**
     * **Semantic Zoom, phase 2: a board's areas say what they hold**
     * (`docs/projects/semantic-zoom/phases.md`, phase 2's proof). Its own
     * daemon with a recording stub on loopback, as `semantic-zoom-text`: the
     * stub answers each prompt with the frame's title and its members' titles
     * as it was sent them, so what a card says IS what the home collected.
     *
     * A board of three areas — on a groups canvas an area is a group (`isocan
     * area new`), so its members are explicit — plus a fourth group holding a
     * note excluded from context. Zoomed out until the cards cannot be read:
     * four summary cards, ≈ and "Summary of …", one model call each, the
     * excluded note's words in none of them. Then a person drags a card from
     * To do into Doing: both summaries keep their old words marked updating,
     * never an empty frame, until the quiet period has passed and both are
     * replaced by what the frames now hold — two more calls, nothing else.
     *
     * Then phase 3b, looking at pictures: a picture is added to Onboarding.
     * With the setting off the stub is sent no image, and the card says what
     * the words say. With it on, the stub is sent the picture as an image
     * block and the card shows the summary made from it. Turned off again,
     * the card never shows that summary: a viewer with vision off never reads
     * a vision summary.
     */
    what: "a three-area board far away shows three ≈ summaries; a card dragged across changes both after the quiet period; an excluded note never reaches the model; a picture is sent only with looking at pictures on, and its summary is read only then",
    async run(rig) {
      const { b } = rig;
      const asked = [];
      const stub = createServer((req, res) => {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          const sent = JSON.parse(body || "{}");
          asked.push(sent);
          const content = sent.messages?.[0]?.content;
          const blocks = Array.isArray(content) ? content : [];
          const prompt = String(blocks.find((one) => one.type === "text")?.text ?? content ?? "");
          const title = /titled "([^"]+)"/.exec(prompt)?.[1] ?? "?";
          const members = [...prompt.matchAll(/^- (?:Note|Card|Screen|Picture) "([^"]+)"/gm)].map((m) => m[1]);
          const seen = blocks.filter((one) => one.type === "image").length;
          const summary = `Acme ${title} holds ${members.join(" and ") || "nothing"}${seen ? `, ${seen} seen` : ""}`;
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ id: "msg_stub", type: "message", role: "assistant", model: sent.model, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ summary }) }] }));
        });
      });
      await new Promise((r) => stub.listen(0, "127.0.0.1", r));
      const home = mkdtempSync(path.join(tmpdir(), "isocan-journey-szb-"));
      const daemon = await startDaemon(home, {
        ISOCAN_TEXT_API_KEY: "sk-ant-journey-stub-not-a-key",
        ISOCAN_TEXT_PROVIDER: "anthropic",
        ISOCAN_TEXT_ENDPOINT: `http://127.0.0.1:${stub.address().port}/v1/messages`,
        ISOCAN_SUMMARY_QUIET_MS: "2500",
        ISOCAN_SUMMARY_MODEL: "",
        ISOCAN_TEXT_MODEL: "",
      });
      const { origin } = daemon;
      try {
        const env = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(origin).port, ISOCAN_SESSION_ID: "acme-semantic-board-journey", ISOCAN_HARNESS: "test" };
        const runCli = (...args) => {
          const out = execFileSync(process.execPath, [cli, "--json", ...args], { cwd: home, encoding: "utf8", env });
          return /^[\[{]/.test(out.trim()) ? JSON.parse(out) : out;
        };
        runCli("identity", "--session", "--name", "Acme Board CLI");
        const id = runCli("canvas", "create", "Acme sprint board").canvasId;
        const frames = {};
        for (const [n, title] of ["To do", "Doing", "Done", "Onboarding"].entries()) {
          frames[title] = runCli("--canvas", id, "canvas", "group", "new", title, "--at", `${n * 800},0`, "--size", "700x900").itemId;
        }
        const cards = {};
        const note = (frame, title, words) => {
          const file = path.join(home, `${title.replace(/\W+/g, "-")}.md`);
          writeFileSync(file, `# ${title}\n\n${words}\n`);
          cards[title] = runCli("--canvas", id, "text", "-f", file, "--in", frames[frame]).itemId;
        };
        note("To do", "Billing migration", "Ravi moves Acme billing to the new ledger.");
        note("To do", "Copy fix", "Ana rewrites the empty state.");
        note("Doing", "Safari crash", "Ana is on the Safari crash.");
        note("Done", "Pricing page", "Ravi shipped the pricing page.");
        note("Onboarding", "Sign up", "Sign up asks for a work email.");
        note("Onboarding", "Margins", "ACME-CONFIDENTIAL margins are forty percent.");
        runCli("--canvas", id, "context", "exclude", cards.Margins);
        // Every source quiet before the browser looks, so the first summaries are made at once.
        await sleep(2800);

        await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
        const loaded = b.once("Page.loadEventFired");
        await b.send("Page.navigate", { url: origin });
        await Promise.race([loaded, sleep(15_000)]);
        await throughTheDoor(b, origin, "Journey", "journeys-semantic-board");
        await b.ev(`(() => { localStorage.setItem("isocan.experiments", JSON.stringify(["semantic.zoom"])); return true; })()`);
        await b.send("Page.navigate", { url: `${origin}/p/${id}` });
        const frameSel = (title) => JSON.stringify(`.item[data-item-id="${frames[title]}"]`);
        await until(b, Object.keys(frames).map((t) => `!!document.querySelector(${frameSel(t)})`).join(" && "), "the four frames on the canvas", 15_000);

        // Zoomed out around the board's middle until a card's words are under 5px and the whole board is on screen.
        const scale = () => b.ev(`parseFloat(getComputedStyle(document.querySelector(".world")).getPropertyValue("--scale")) || 1`);
        const box = () => b.ev(`(() => { const rs = [${Object.keys(frames).map(frameSel).join(",")}].map((s) => document.querySelector(s).getBoundingClientRect()); return { left: Math.min(...rs.map((r) => r.left)), right: Math.max(...rs.map((r) => r.right)), top: Math.min(...rs.map((r) => r.top)), bottom: Math.max(...rs.map((r) => r.bottom)) }; })()`);
        const zoomOut = async () => {
          for (let n = 0; (await scale()) > 0.24 && n < 80; n++) {
            const r = await box();
            await b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: Math.min(Math.max(Math.round((r.left + r.right) / 2), 200), 1080), y: Math.min(Math.max(Math.round((r.top + r.bottom) / 2), 200), 700), deltaX: 0, deltaY: 120, modifiers: 2 });
            await sleep(40);
          }
        };
        await zoomOut();
        const at = await box();
        if (at.left < 0 || at.right > 1280 || at.top < 0 || at.bottom > 900) throw new Error(`zoomed out to ${await scale()}, the board is not all on screen: ${JSON.stringify(at)}`);

        // 1. Four summary cards, each marked and named, current.
        const cardOf = (title) => `${frameSel(title)} + " .sz-card"`;
        const current = (title) => `(() => { const c = document.querySelector(${cardOf(title)}); return !!c && !c.hasAttribute("data-stale"); })()`;
        await until(b, Object.keys(frames).map(current).join(" && "), "a current summary card in each of the four frames", 20_000);
        const read = (title) => b.ev(`(() => { const c = document.querySelector(${cardOf(title)}); return { text: c.textContent.trim(), name: c.getAttribute("aria-label"), role: c.getAttribute("role"), raised: getComputedStyle(c.closest(".item")).zIndex }; })()`);
        const first = {};
        for (const title of Object.keys(frames)) {
          const c = (first[title] = await read(title));
          if (!c.text.startsWith("≈")) throw new Error(`${title}'s summary is not marked ≈: "${c.text}"`);
          if (c.name !== `Summary of ${title}`) throw new Error(`${title}'s summary is named "${c.name}"`);
          if (c.role !== "note") throw new Error(`${title}'s summary has role ${c.role}`);
          // The frame rises over its members while its card shows, so the card is not painted under them.
          if (c.raised !== "1") throw new Error(`${title}'s frame stays at z-index ${c.raised} under its members`);
        }
        // Members are listed by id, so in either order.
        if (!/holds (Billing migration and Copy fix|Copy fix and Billing migration)$/.test(first["To do"].text)) throw new Error(`To do says "${first["To do"].text}"`);
        if (!/holds Safari crash$/.test(first.Doing.text)) throw new Error(`Doing says "${first.Doing.text}"`);
        if (asked.length !== 4) throw new Error(`four frames, ${asked.length} model calls`);
        const prompts = () => asked.map((a) => JSON.stringify(a.messages));
        if (!prompts().every((p) => /This is a group on a canvas/.test(p))) throw new Error("a call was not a group's summary");
        if (prompts().some((p) => /CONFIDENTIAL|forty percent|Margins/.test(p))) throw new Error("the excluded note reached the model");
        if (/Margins/.test(first.Onboarding.text) || !/holds Sign up$/.test(first.Onboarding.text)) throw new Error(`Onboarding says "${first.Onboarding.text}"`);

        // 2. A person drags Copy fix from To do into Doing.
        await b.ev(`(() => {
          window.__szbGaps = 0; window.__szbWatch = true;
          const look = () => { if (!document.querySelector(${cardOf("To do")}) || !document.querySelector(${cardOf("Doing")})) window.__szbGaps++; };
          new MutationObserver(look).observe(document.querySelector(".world"), { subtree: true, childList: true, characterData: true, attributes: true });
          const frame = () => { if (!window.__szbWatch) return; look(); requestAnimationFrame(frame); };
          requestAnimationFrame(frame);
          return true;
        })()`);
        const from = await b.ev(`(() => { const r = document.querySelector(${JSON.stringify(`.item[data-item-id="${cards["Copy fix"]}"]`)}).getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
        const into = await b.ev(`(() => { const r = document.querySelector(${frameSel("Doing")}).getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.bottom - r.height / 4) }; })()`);
        const hit = await b.ev(`document.elementFromPoint(${from.x}, ${from.y})?.closest(".item")?.dataset.itemId ?? null`);
        if (hit !== cards["Copy fix"]) throw new Error(`a press on Copy fix lands on ${hit} — under its frame's summary card, a person could not grab it`);
        // At the canvas's level a press on a member takes its whole group; ⌘ (Ctrl off a Mac) reaches the one card, as a person does.
        const MOD = process.platform === "darwin" ? 4 : 2;
        const mouse = (type, x, y, buttons) => b.send("Input.dispatchMouseEvent", { type, x: Math.round(x), y: Math.round(y), modifiers: MOD, buttons, button: "left", clickCount: type === "mouseMoved" ? 0 : 1 });
        await mouse("mousePressed", from.x, from.y, 1);
        for (let s = 1; s <= 12; s++) {
          await mouse("mouseMoved", from.x + ((into.x - from.x) * s) / 12, from.y + ((into.y - from.y) * s) / 12, 1);
          await sleep(30);
        }
        await mouse("mouseReleased", into.x, into.y, 0);
        const parent = () => runCli("--canvas", id, "show", cards["Copy fix"]).containerId ?? null;
        for (let n = 0; parent() !== frames.Doing && n < 20; n++) await sleep(250);
        if (parent() !== frames.Doing) throw new Error(`the drag left Copy fix in ${parent()}, not in Doing (${frames.Doing})`);
        await until(b, `(() => { const c = document.querySelector(${cardOf("To do")}); return !!c && c.hasAttribute("data-stale") && /Copy fix/.test(c.textContent) && !!c.querySelector(".sz-updating"); })()`, "To do's old summary kept, marked as being updated", 10_000);
        await until(b, `(() => { const c = document.querySelector(${cardOf("Doing")}); return !!c && c.hasAttribute("data-stale") && /holds Safari crash/.test(c.textContent); })()`, "Doing's old summary kept, marked as being updated", 10_000);
        await until(b, `${current("To do")} && /holds Billing migration$/.test(document.querySelector(${cardOf("To do")}).textContent)`, "To do's new summary, without Copy fix", 20_000);
        await until(b, `${current("Doing")} && /Copy fix and Safari crash|Safari crash and Copy fix/.test(document.querySelector(${cardOf("Doing")}).textContent)`, "Doing's new summary, with Copy fix", 20_000);
        const gaps = await b.ev(`(() => { window.__szbWatch = false; return window.__szbGaps; })()`);
        if (gaps !== 0) throw new Error(`a frame's summary card was missing on ${gaps} sampled frame(s) between the old summary and the new`);
        if (asked.length !== 6) throw new Error(`one drag across two frames, ${asked.length - 4} more model calls`);
        if (prompts().some((p) => /CONFIDENTIAL|forty percent|Margins/.test(p))) throw new Error("the excluded note reached the model");
        const after = { todo: (await read("To do")).text, doing: (await read("Doing")).text };

        // 3. Looking at pictures (phase 3b). A picture joins Onboarding; with the setting off, no image is sent.
        const images = () => asked.reduce((n, a) => n + (Array.isArray(a.messages?.[0]?.content) ? a.messages[0].content.filter((one) => one.type === "image").length : 0), 0);
        const shot = path.join(home, "acme-sign-up.png");
        writeFileSync(shot, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
        runCli("--canvas", id, "add", shot, "--in", frames.Onboarding, "--title", "Sign up shot");
        await until(b, `${current("Onboarding")} && /Sign up shot/.test(document.querySelector(${cardOf("Onboarding")}).textContent)`, "Onboarding's text-only summary, naming the picture by title", 20_000);
        if (images() !== 0) throw new Error(`with looking at pictures off, ${images()} image(s) were sent`);
        if (/seen/.test((await read("Onboarding")).text)) throw new Error("with looking at pictures off, the card shows a summary made from pictures");
        const textOnly = asked.length;

        // With it on: the picture goes as an image block, and the card shows what was made from it.
        const reopen = async (flags) => {
          await b.ev(`(() => { localStorage.setItem("isocan.experiments", ${JSON.stringify(JSON.stringify(flags))}); return true; })()`);
          await b.send("Page.navigate", { url: `${origin}/p/${id}` });
          await until(b, Object.keys(frames).map((t) => `!!document.querySelector(${frameSel(t)})`).join(" && "), "the four frames, reopened", 15_000);
          await zoomOut();
        };
        await reopen(["semantic.zoom", "semantic.zoom.vision"]);
        await until(b, `${current("Onboarding")} && /1 seen/.test(document.querySelector(${cardOf("Onboarding")}).textContent)`, "Onboarding's summary made looking at its picture", 20_000);
        if (images() !== 1) throw new Error(`looking at pictures, ${images()} image(s) were sent, not the one picture`);
        if (asked.length !== textOnly + 1) throw new Error(`looking at pictures cost ${asked.length - textOnly} calls, not one`);
        if (!/\(picture 1\)/.test(prompts().at(-1))) throw new Error("the prompt does not say which member the picture is of");
        const looked = (await read("Onboarding")).text;

        // Off again: the vision summary is never read, though it is cached.
        await reopen(["semantic.zoom"]);
        await until(b, `${current("Onboarding")} && /Sign up shot/.test(document.querySelector(${cardOf("Onboarding")}).textContent)`, "Onboarding's text-only summary again", 20_000);
        await sleep(1500);
        if (/seen/.test((await read("Onboarding")).text)) throw new Error("with looking at pictures off again, the card shows the summary made from pictures");
        if (asked.length !== textOnly + 1) throw new Error(`turning looking at pictures off made ${asked.length - textOnly - 1} more calls`);
        return { frames: Object.keys(frames).length, calls: asked.length, scale: await scale(), before: first["To do"].text, after, looked, images: images() };
      } finally {
        await daemon.stop();
        stub.close();
        rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        await b.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
      }
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

  // Any daemon a CLI under this run starts for itself (an `rc` or a `wait`
  // whose daemon went away calls `ensureDaemon`) inherits this, and so dies
  // with the run too rather than outliving it unowned.
  process.env.ISOCAN_DAEMON_GUARD_PID = String(process.pid);
  const results = [];
  const why = (err) => (err instanceof Error ? err.message : String(err));
  for (const journey of list) {
    // A rig of the journey's own: see `rig()` for what sharing one cost.
    const booted = Date.now();
    let r = null;
    const result = { name: journey.name, what: journey.what };
    try {
      r = await rig();
    } catch (err) {
      results.push({ ...result, ok: false, ms: Date.now() - booted, why: `the rig did not start: ${why(err)}` });
      continue;
    }
    const started = Date.now();
    try {
      const proof = await journey.run(r);
      Object.assign(result, { ok: true, ms: Date.now() - started, ...(proof ? { proof } : {}) });
    } catch (err) {
      Object.assign(result, { ok: false, ms: Date.now() - started, why: why(err) });
    }
    try {
      await r.close();
    } catch (err) {
      // A walk that passed and left a browser or daemon it could not stop
      // did not pass: the next one would run beside it.
      if (result.ok) Object.assign(result, { ok: false, why: `the walk passed, then its rig would not stop: ${why(err)}` });
    }
    result.setupMs = started - booted;
    results.push(result);
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

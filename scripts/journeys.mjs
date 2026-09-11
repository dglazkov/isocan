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
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
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
   * So: find the control, take its centre, check the browser agrees that
   * point belongs to it, and press THERE. When it does not agree, the thing
   * on top is named in the failure, because "the button did not respond" and
   * "something is sitting over the button" are different bugs.
   */
  const rigClick = async (selector, what = selector) => {
    const box = await b.ev(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return { zero: true };
      const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
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
      // Hold the op POST for longer than anybody would wait.
      await rig.b.ev(`(() => {
        const real = window.fetch;
        window.__realFetch = real;
        window.fetch = async (...a) => {
          const url = typeof a[0] === "string" ? a[0] : a[0]?.url;
          if (String(url).endsWith("/api/ops") && a[1]?.method === "POST") {
            await new Promise(r => setTimeout(r, 9000));
          }
          return real(...a);
        };
        return true;
      })()`);
      /* V rather than clicking the rail: the Select tool is where a presence
         face can overlap the button, which is a separate question from
         whether delete is immediate. */
      await rig.type("v");
      await sleep(300);
      await rig.click(".item", "the item");
      await until(rig.b, `document.querySelectorAll(".item.selected").length === 1`, "a selection");
      await rig.press("Delete");
      await sleep(400);
      const left = await rig.b.ev(`document.querySelectorAll(".item").length`);
      await rig.b.ev(`(() => { window.fetch = window.__realFetch; return true; })()`);
      if (left !== 0) {
        throw new Error("the item is still on screen 400ms after Delete — the write has no echo");
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
        await journey.run(r);
        results.push({ name: journey.name, what: journey.what, ok: true, ms: Date.now() - started });
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

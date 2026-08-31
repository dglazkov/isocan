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
 *   node scripts/journeys.mjs --json       # for a persona's goal
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
import { browser } from "./lib/browser.mjs";

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
  await until(b, `location.origin === ${JSON.stringify(origin)}`, `the page to be at ${origin}`);
  await b.ev(`(async () => {
    await fetch("/api/door", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrier: "cookie" }) });
    const r = await fetch("/api/ops", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canvasId: null, clientId: "journeys",
        op: { type: "actor.claim", name: "Journey" } }) });
    const j = await r.json();
    localStorage.setItem("isocan.identity", JSON.stringify(j.envelope.actor));
    return true;
  })()`);
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
      const codes = { Enter: { windowsVirtualKeyCode: 13, key: "Enter", text: "\r" } };
      const k = codes[key];
      const mods = meta ? 4 : 0;
      await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", modifiers: mods, ...k });
      await b.send("Input.dispatchKeyEvent", { type: "keyUp", modifiers: mods, ...k });
      await sleep(600);
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

export const JOURNEYS = [
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
    /** The bug: ⌘Enter appeared to add nothing, because the write had no
     *  local echo and the socket was dead. */
    what: "typing text and pressing ⌘Enter puts it on the canvas",
    async run(rig) {
      await makeCanvas(rig, "Text journey");
      const before = await rig.b.ev(`document.querySelectorAll(".item").length`);
      await addText(rig, "a typed note");
      const after = await rig.b.ev(`document.querySelectorAll(".item").length`);
      if (after <= before) throw new Error("⌘Enter added nothing to the canvas");
      const stillText = await rig.b.ev(
        `[...document.querySelectorAll(".tool-btn")].some(b => b.getAttribute("aria-label") === "Text" && /active|on/.test(b.className))`,
      );
      if (!stillText) throw new Error("the Text tool did not stay selected");
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
    name: "history-and-lens",
    /** Both read across canvases; both were built the same day and neither
     *  had ever been opened by anything but a person. */
    what: "the lens lists what somebody made, and every row links somewhere real",
    async run(rig) {
      await makeCanvas(rig, "Lens journey");
      await addText(rig, "made for the lens");
      await rig.go("/lens");
      await until(rig.b, `document.querySelectorAll(".lens-subjects .btn").length > 0`, "a lens roster");
      await rig.click(".lens-subjects .btn", "the first lens subject");
      await sleep(1200);
      const seen = await rig.b.ev(`(() => ({
        rows: document.querySelectorAll(".lens-row").length,
        hrefs: [...document.querySelectorAll(".lens-row")].map(a => a.getAttribute("href")),
        note: document.querySelector(".lens-note")?.textContent ?? "",
      }))()`);
      if (seen.rows === 0) throw new Error("the lens shows nothing for somebody who made something");
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
